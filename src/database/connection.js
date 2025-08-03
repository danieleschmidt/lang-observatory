/**
 * Database Connection Management
 * Handles PostgreSQL connections and connection pooling
 */

const { Pool } = require('pg');
const { Logger } = require('../utils/logger');

class DatabaseConnection {
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env.DATABASE_HOST || 'localhost',
            port: config.port || process.env.DATABASE_PORT || 5432,
            database: config.database || process.env.DATABASE_NAME || 'lang_observatory',
            user: config.user || process.env.DATABASE_USER || 'postgres',
            password: config.password || process.env.DATABASE_PASSWORD || '',
            ssl: config.ssl || process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
            min: config.poolMin || process.env.DATABASE_POOL_MIN || 2,
            max: config.poolMax || process.env.DATABASE_POOL_MAX || 10,
            idleTimeoutMillis: config.idleTimeout || process.env.DATABASE_POOL_IDLE_TIMEOUT || 30000,
            connectionTimeoutMillis: config.connectionTimeout || 5000,
            ...config
        };
        
        this.logger = new Logger({ service: 'DatabaseConnection' });
        this.pool = null;
        this.connected = false;
    }

    async connect() {
        try {
            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                ssl: this.config.ssl,
                min: this.config.min,
                max: this.config.max,
                idleTimeoutMillis: this.config.idleTimeoutMillis,
                connectionTimeoutMillis: this.config.connectionTimeoutMillis
            });

            // Test the connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.connected = true;
            this.logger.info('Database connection established', {
                host: this.config.host,
                database: this.config.database,
                poolSize: this.config.max
            });

            // Set up error handling
            this.pool.on('error', (err) => {
                this.logger.error('Database pool error:', err);
                this.connected = false;
            });

            return this.pool;
        } catch (error) {
            this.logger.error('Failed to connect to database:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.connected = false;
            this.logger.info('Database connection closed');
        }
    }

    async query(text, params = []) {
        if (!this.connected || !this.pool) {
            throw new Error('Database not connected');
        }

        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            this.logger.debug('Query executed', {
                query: text.substring(0, 100),
                duration,
                rows: result.rowCount
            });
            
            return result;
        } catch (error) {
            this.logger.error('Query failed:', {
                query: text.substring(0, 100),
                error: error.message,
                params: params.length
            });
            throw error;
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getClient() {
        if (!this.connected || !this.pool) {
            throw new Error('Database not connected');
        }
        return await this.pool.connect();
    }

    async getStats() {
        if (!this.pool) {
            return null;
        }

        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
            connected: this.connected
        };
    }

    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health_check');
            return {
                healthy: true,
                response_time: Date.now(),
                connected: this.connected,
                stats: await this.getStats()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                connected: false
            };
        }
    }
}

// Singleton instance
let dbInstance = null;

function createConnection(config) {
    if (!dbInstance) {
        dbInstance = new DatabaseConnection(config);
    }
    return dbInstance;
}

function getConnection() {
    if (!dbInstance) {
        throw new Error('Database connection not initialized. Call createConnection() first.');
    }
    return dbInstance;
}

module.exports = {
    DatabaseConnection,
    createConnection,
    getConnection
};