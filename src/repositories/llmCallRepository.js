/**
 * LLM Call Repository
 * Handles database operations for LLM call records
 */

const { BaseRepository } = require('./baseRepository');

class LLMCallRepository extends BaseRepository {
  constructor() {
    super('llm_calls', 'id');
  }

  async findByTraceId(traceId) {
    try {
      return await this.findAll({
        where: { trace_id: traceId },
        orderBy: 'started_at',
        orderDirection: 'ASC',
      });
    } catch (error) {
      this.logger.error(
        `Error finding LLM calls by trace ID ${traceId}:`,
        error
      );
      throw error;
    }
  }

  async findBySession(sessionId, options = {}) {
    try {
      const { limit = 100, offset = 0, startDate, endDate } = options;

      const where = { session_id: sessionId };

      let query = `
                SELECT * FROM ${this.tableName}
                WHERE session_id = $1
            `;
      const params = [sessionId];
      let paramCount = 1;

      if (startDate) {
        paramCount++;
        query += ` AND started_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND started_at <= $${paramCount}`;
        params.push(endDate);
      }

      query += ` ORDER BY started_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const db = await this._getDb();
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error(
        `Error finding LLM calls by session ${sessionId}:`,
        error
      );
      throw error;
    }
  }

  async findByProvider(providerId, options = {}) {
    try {
      const { limit = 100, offset = 0, startDate, endDate, status } = options;

      let query = `
                SELECT lc.*, p.name as provider_name, m.name as model_name
                FROM ${this.tableName} lc
                JOIN models m ON lc.model_id = m.id
                JOIN providers p ON lc.provider_id = p.id
                WHERE lc.provider_id = $1
            `;
      const params = [providerId];
      let paramCount = 1;

      if (startDate) {
        paramCount++;
        query += ` AND lc.started_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND lc.started_at <= $${paramCount}`;
        params.push(endDate);
      }

      if (status) {
        paramCount++;
        query += ` AND lc.status = $${paramCount}`;
        params.push(status);
      }

      query += ` ORDER BY lc.started_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const db = await this._getDb();
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error(
        `Error finding LLM calls by provider ${providerId}:`,
        error
      );
      throw error;
    }
  }

  async getUsageStats(options = {}) {
    try {
      const {
        startDate,
        endDate,
        providerId,
        modelId,
        groupBy = 'day',
      } = options;

      let query = `
                SELECT 
                    DATE_TRUNC('${groupBy}', started_at) as period,
                    COUNT(*) as total_calls,
                    COUNT(*) FILTER (WHERE status = 'success') as successful_calls,
                    COUNT(*) FILTER (WHERE status = 'error') as failed_calls,
                    SUM(total_tokens) as total_tokens,
                    SUM(input_tokens) as total_input_tokens,
                    SUM(output_tokens) as total_output_tokens,
                    SUM(total_cost) as total_cost,
                    AVG(latency_ms) as avg_latency_ms,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
                    AVG(tokens_per_second) as avg_tokens_per_second
                FROM ${this.tableName}
                WHERE 1=1
            `;
      const params = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        query += ` AND started_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND started_at <= $${paramCount}`;
        params.push(endDate);
      }

      if (providerId) {
        paramCount++;
        query += ` AND provider_id = $${paramCount}`;
        params.push(providerId);
      }

      if (modelId) {
        paramCount++;
        query += ` AND model_id = $${paramCount}`;
        params.push(modelId);
      }

      query += ` GROUP BY period ORDER BY period DESC`;

      const db = await this._getDb();
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting usage stats:', error);
      throw error;
    }
  }

  async getCostAnalysis(options = {}) {
    try {
      const { startDate, endDate, groupBy = 'provider' } = options;

      let query;
      const params = [];
      let paramCount = 0;

      if (groupBy === 'provider') {
        query = `
                    SELECT 
                        p.name as provider_name,
                        p.display_name,
                        COUNT(lc.*) as total_calls,
                        SUM(lc.total_cost) as total_cost,
                        AVG(lc.total_cost) as avg_cost_per_call,
                        SUM(lc.total_tokens) as total_tokens
                    FROM ${this.tableName} lc
                    JOIN providers p ON lc.provider_id = p.id
                    WHERE 1=1
                `;
      } else if (groupBy === 'model') {
        query = `
                    SELECT 
                        p.name as provider_name,
                        m.name as model_name,
                        m.display_name as model_display_name,
                        COUNT(lc.*) as total_calls,
                        SUM(lc.total_cost) as total_cost,
                        AVG(lc.total_cost) as avg_cost_per_call,
                        SUM(lc.total_tokens) as total_tokens
                    FROM ${this.tableName} lc
                    JOIN models m ON lc.model_id = m.id
                    JOIN providers p ON lc.provider_id = p.id
                    WHERE 1=1
                `;
      }

      if (startDate) {
        paramCount++;
        query += ` AND lc.started_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND lc.started_at <= $${paramCount}`;
        params.push(endDate);
      }

      if (groupBy === 'provider') {
        query += ` GROUP BY p.id, p.name, p.display_name ORDER BY total_cost DESC`;
      } else if (groupBy === 'model') {
        query += ` GROUP BY p.name, m.name, m.display_name ORDER BY total_cost DESC`;
      }

      const db = await this._getDb();
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting cost analysis:', error);
      throw error;
    }
  }

  async getPerformanceMetrics(options = {}) {
    try {
      const { startDate, endDate, providerId, modelId } = options;

      let query = `
                SELECT 
                    p.name as provider_name,
                    m.name as model_name,
                    COUNT(*) as total_calls,
                    AVG(latency_ms) as avg_latency_ms,
                    MIN(latency_ms) as min_latency_ms,
                    MAX(latency_ms) as max_latency_ms,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as median_latency_ms,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms,
                    AVG(tokens_per_second) as avg_tokens_per_second,
                    AVG(time_to_first_token_ms) as avg_time_to_first_token_ms,
                    COUNT(*) FILTER (WHERE status = 'error') as error_count,
                    ROUND(COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*), 2) as error_rate
                FROM ${this.tableName} lc
                JOIN models m ON lc.model_id = m.id
                JOIN providers p ON lc.provider_id = p.id
                WHERE lc.completed_at IS NOT NULL
            `;
      const params = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        query += ` AND lc.started_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND lc.started_at <= $${paramCount}`;
        params.push(endDate);
      }

      if (providerId) {
        paramCount++;
        query += ` AND lc.provider_id = $${paramCount}`;
        params.push(providerId);
      }

      if (modelId) {
        paramCount++;
        query += ` AND lc.model_id = $${paramCount}`;
        params.push(modelId);
      }

      query += ` GROUP BY p.name, m.name ORDER BY total_calls DESC`;

      const db = await this._getDb();
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  async getRecentErrors(limit = 50) {
    try {
      const query = `
                SELECT 
                    lc.*,
                    p.name as provider_name,
                    m.name as model_name
                FROM ${this.tableName} lc
                JOIN models m ON lc.model_id = m.id
                JOIN providers p ON lc.provider_id = p.id
                WHERE lc.status = 'error'
                ORDER BY lc.started_at DESC
                LIMIT $1
            `;

      const db = await this._getDb();
      const result = await db.query(query, [limit]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error getting recent errors:', error);
      throw error;
    }
  }

  async createWithProviderModel(callData) {
    try {
      const db = await this._getDb();

      return await db.transaction(async client => {
        // Get or create provider
        const providerResult = await client.query(
          'SELECT id FROM providers WHERE name = $1',
          [callData.provider]
        );

        let providerId;
        if (providerResult.rows.length === 0) {
          const newProvider = await client.query(
            'INSERT INTO providers (name, display_name) VALUES ($1, $2) RETURNING id',
            [callData.provider, callData.provider]
          );
          providerId = newProvider.rows[0].id;
        } else {
          providerId = providerResult.rows[0].id;
        }

        // Get or create model
        const modelResult = await client.query(
          'SELECT id FROM models WHERE provider_id = $1 AND name = $2',
          [providerId, callData.model]
        );

        let modelId;
        if (modelResult.rows.length === 0) {
          const newModel = await client.query(
            'INSERT INTO models (provider_id, name, display_name) VALUES ($1, $2, $3) RETURNING id',
            [providerId, callData.model, callData.model]
          );
          modelId = newModel.rows[0].id;
        } else {
          modelId = modelResult.rows[0].id;
        }

        // Create the LLM call record
        const llmCallData = {
          trace_id: callData.traceId,
          session_id: callData.sessionId,
          provider_id: providerId,
          model_id: modelId,
          input_text: callData.input,
          output_text: callData.output,
          input_tokens: callData.tokens?.input,
          output_tokens: callData.tokens?.output,
          total_tokens: callData.tokens?.total,
          input_cost: callData.cost?.input,
          output_cost: callData.cost?.output,
          total_cost: callData.cost?.total,
          latency_ms: callData.latency,
          time_to_first_token_ms: callData.timeToFirstToken,
          tokens_per_second: callData.tokensPerSecond,
          status: callData.status || 'success',
          error_message: callData.error,
          metadata: callData.metadata
            ? JSON.stringify(callData.metadata)
            : null,
          started_at: callData.startedAt || new Date(),
          completed_at: callData.completedAt || new Date(),
        };

        const result = await client.query(
          `
                    INSERT INTO ${this.tableName} (
                        trace_id, session_id, provider_id, model_id,
                        input_text, output_text, input_tokens, output_tokens, total_tokens,
                        input_cost, output_cost, total_cost,
                        latency_ms, time_to_first_token_ms, tokens_per_second,
                        status, error_message, metadata, started_at, completed_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
                    ) RETURNING *
                `,
          Object.values(llmCallData)
        );

        return result.rows[0];
      });
    } catch (error) {
      this.logger.error('Error creating LLM call with provider/model:', error);
      throw error;
    }
  }
}

module.exports = { LLMCallRepository };
