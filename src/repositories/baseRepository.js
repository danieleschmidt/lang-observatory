/**
 * Base Repository Pattern
 * Provides common database operations and patterns
 */

const { getConnection } = require('../database/connection');
const { Logger } = require('../utils/logger');
const { Validators } = require('../utils/validators');

class BaseRepository {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.logger = new Logger({ service: `${tableName}Repository` });
    this.db = null;
  }

  async _getDb() {
    if (!this.db) {
      this.db = getConnection();
    }
    return this.db;
  }

  async findById(id) {
    try {
      const db = await this._getDb();
      const result = await db.query(
        `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Error finding ${this.tableName} by ID ${id}:`, error);
      throw error;
    }
  }

  async findAll(options = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        orderBy = this.primaryKey,
        orderDirection = 'ASC',
        where = {},
        select = '*',
      } = options;

      const db = await this._getDb();

      // Build WHERE clause
      const whereConditions = [];
      const whereValues = [];
      let paramCount = 0;

      for (const [column, value] of Object.entries(where)) {
        paramCount++;
        whereConditions.push(`${column} = $${paramCount}`);
        whereValues.push(value);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const query = `
                SELECT ${select}
                FROM ${this.tableName}
                ${whereClause}
                ORDER BY ${orderBy} ${orderDirection}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

      const result = await db.query(query, [...whereValues, limit, offset]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Error finding all ${this.tableName}:`, error);
      throw error;
    }
  }

  async findOne(where) {
    try {
      const results = await this.findAll({ where, limit: 1 });
      return results[0] || null;
    } catch (error) {
      this.logger.error(`Error finding one ${this.tableName}:`, error);
      throw error;
    }
  }

  async create(data) {
    try {
      const db = await this._getDb();

      // Remove undefined values
      const cleanData = this._cleanData(data);

      // Build INSERT query
      const columns = Object.keys(cleanData);
      const values = Object.values(cleanData);
      const placeholders = values.map((_, index) => `$${index + 1}`);

      const query = `
                INSERT INTO ${this.tableName} (${columns.join(', ')})
                VALUES (${placeholders.join(', ')})
                RETURNING *
            `;

      const result = await db.query(query, values);
      const created = result.rows[0];

      this.logger.debug(`Created ${this.tableName}:`, {
        id: created[this.primaryKey],
      });
      return created;
    } catch (error) {
      this.logger.error(`Error creating ${this.tableName}:`, error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      const db = await this._getDb();

      // Remove undefined values
      const cleanData = this._cleanData(data);
      delete cleanData[this.primaryKey]; // Don't update primary key

      if (Object.keys(cleanData).length === 0) {
        throw new Error('No data provided for update');
      }

      // Build UPDATE query
      const columns = Object.keys(cleanData);
      const values = Object.values(cleanData);
      const setClause = columns.map((col, index) => `${col} = $${index + 1}`);

      const query = `
                UPDATE ${this.tableName}
                SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE ${this.primaryKey} = $${values.length + 1}
                RETURNING *
            `;

      const result = await db.query(query, [...values, id]);

      if (result.rows.length === 0) {
        return null; // Not found
      }

      const updated = result.rows[0];
      this.logger.debug(`Updated ${this.tableName}:`, { id });
      return updated;
    } catch (error) {
      this.logger.error(`Error updating ${this.tableName} ${id}:`, error);
      throw error;
    }
  }

  async delete(id) {
    try {
      const db = await this._getDb();

      const result = await db.query(
        `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return null; // Not found
      }

      this.logger.debug(`Deleted ${this.tableName}:`, { id });
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Error deleting ${this.tableName} ${id}:`, error);
      throw error;
    }
  }

  async count(where = {}) {
    try {
      const db = await this._getDb();

      // Build WHERE clause
      const whereConditions = [];
      const whereValues = [];
      let paramCount = 0;

      for (const [column, value] of Object.entries(where)) {
        paramCount++;
        whereConditions.push(`${column} = $${paramCount}`);
        whereValues.push(value);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const query = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
      const result = await db.query(query, whereValues);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      this.logger.error(`Error counting ${this.tableName}:`, error);
      throw error;
    }
  }

  async exists(where) {
    try {
      const count = await this.count(where);
      return count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking existence in ${this.tableName}:`,
        error
      );
      throw error;
    }
  }

  async bulkCreate(dataArray) {
    try {
      const db = await this._getDb();

      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        return [];
      }

      // Use transaction for bulk operations
      return await db.transaction(async client => {
        const results = [];

        for (const data of dataArray) {
          const cleanData = this._cleanData(data);
          const columns = Object.keys(cleanData);
          const values = Object.values(cleanData);
          const placeholders = values.map((_, index) => `$${index + 1}`);

          const query = `
                        INSERT INTO ${this.tableName} (${columns.join(', ')})
                        VALUES (${placeholders.join(', ')})
                        RETURNING *
                    `;

          const result = await client.query(query, values);
          results.push(result.rows[0]);
        }

        this.logger.debug(
          `Bulk created ${results.length} ${this.tableName} records`
        );
        return results;
      });
    } catch (error) {
      this.logger.error(`Error bulk creating ${this.tableName}:`, error);
      throw error;
    }
  }

  async bulkUpdate(updates) {
    try {
      const db = await this._getDb();

      if (!Array.isArray(updates) || updates.length === 0) {
        return [];
      }

      return await db.transaction(async client => {
        const results = [];

        for (const { id, data } of updates) {
          const cleanData = this._cleanData(data);
          delete cleanData[this.primaryKey];

          if (Object.keys(cleanData).length === 0) {
            continue;
          }

          const columns = Object.keys(cleanData);
          const values = Object.values(cleanData);
          const setClause = columns.map(
            (col, index) => `${col} = $${index + 1}`
          );

          const query = `
                        UPDATE ${this.tableName}
                        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
                        WHERE ${this.primaryKey} = $${values.length + 1}
                        RETURNING *
                    `;

          const result = await client.query(query, [...values, id]);
          if (result.rows.length > 0) {
            results.push(result.rows[0]);
          }
        }

        this.logger.debug(
          `Bulk updated ${results.length} ${this.tableName} records`
        );
        return results;
      });
    } catch (error) {
      this.logger.error(`Error bulk updating ${this.tableName}:`, error);
      throw error;
    }
  }

  async paginate(options = {}) {
    try {
      const {
        page = 1,
        pageSize = 50,
        orderBy = this.primaryKey,
        orderDirection = 'ASC',
        where = {},
      } = options;

      const offset = (page - 1) * pageSize;
      const limit = pageSize;

      const [items, totalCount] = await Promise.all([
        this.findAll({ limit, offset, orderBy, orderDirection, where }),
        this.count(where),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Error paginating ${this.tableName}:`, error);
      throw error;
    }
  }

  async raw(query, params = []) {
    try {
      const db = await this._getDb();
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error(
        `Error executing raw query on ${this.tableName}:`,
        error
      );
      throw error;
    }
  }

  // Helper methods
  _cleanData(data) {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  _buildWhereClause(conditions) {
    const whereConditions = [];
    const values = [];
    let paramCount = 0;

    for (const [column, value] of Object.entries(conditions)) {
      paramCount++;
      if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramCount++}`);
        whereConditions.push(`${column} IN (${placeholders.join(', ')})`);
        values.push(...value);
        paramCount--; // Adjust for the extra increment
      } else {
        whereConditions.push(`${column} = $${paramCount}`);
        values.push(value);
      }
    }

    return {
      clause:
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '',
      values,
      paramCount,
    };
  }
}

module.exports = { BaseRepository };
