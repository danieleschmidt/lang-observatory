/**
 * Lang Observatory API Server
 * RESTful API for the observability stack
 */

const express = require('express');
const { LangObservatory } = require('../index');
const { Logger } = require('../utils/logger');
const healthRoutes = require('../routes/health');
const metricsRoutes = require('../routes/metrics');
const tracesRoutes = require('../routes/traces');
const llmRoutes = require('../routes/llm');
const analyticsRoutes = require('../routes/analytics');

class LangObservatoryServer {
    constructor(config = {}) {
        this.config = {
            port: process.env.PORT || 3000,
            host: process.env.HOST || '0.0.0.0',
            ...config
        };
        
        this.logger = new Logger({ service: 'api-server' });
        this.app = express();
        this.observatory = new LangObservatory(config.observatory || {});
        this.server = null;
    }

    async initialize() {
        try {
            // Initialize Lang Observatory
            await this.observatory.initialize();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup error handling
            this.setupErrorHandling();
            
            this.logger.info('API Server initialized successfully');
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize API server:', error);
            throw error;
        }
    }

    setupMiddleware() {
        // Request logging
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                this.logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            });
            next();
        });

        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupRoutes() {
        // Add observatory instance to request context
        this.app.use((req, res, next) => {
            req.observatory = this.observatory;
            next();
        });

        // API routes
        this.app.use('/api/health', healthRoutes);
        this.app.use('/api/metrics', metricsRoutes);
        this.app.use('/api/traces', tracesRoutes);
        this.app.use('/api/llm', llmRoutes);
        this.app.use('/api/analytics', analyticsRoutes);

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                service: 'Lang Observatory API',
                version: '0.1.0',
                status: 'running',
                endpoints: {
                    health: '/api/health',
                    metrics: '/api/metrics',
                    traces: '/api/traces',
                    llm: '/api/llm',
                    analytics: '/api/analytics'
                },
                timestamp: new Date().toISOString()
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.originalUrl} not found`,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            this.logger.error('Unhandled API error:', error);
            
            const status = error.status || error.statusCode || 500;
            const message = error.message || 'Internal Server Error';
            
            res.status(status).json({
                error: status >= 500 ? 'Internal Server Error' : message,
                message: status >= 500 ? 'An unexpected error occurred' : message,
                timestamp: new Date().toISOString(),
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
        });

        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception:', error);
            this.shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            this.shutdown('unhandledRejection');
        });
    }

    async start() {
        if (this.server) {
            throw new Error('Server is already running');
        }

        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, this.config.host, () => {
                    this.logger.info(`API Server listening on ${this.config.host}:${this.config.port}`);
                    resolve(this);
                });

                this.server.on('error', (error) => {
                    this.logger.error('Server error:', error);
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    async shutdown(reason = 'manual') {
        this.logger.info(`Shutting down API server (reason: ${reason})...`);
        
        const promises = [];

        // Close HTTP server
        if (this.server) {
            promises.push(new Promise((resolve) => {
                this.server.close(() => {
                    this.logger.info('HTTP server closed');
                    resolve();
                });
            }));
        }

        // Shutdown observatory
        promises.push(this.observatory.shutdown());

        await Promise.all(promises);
        this.logger.info('API Server shutdown complete');

        if (reason !== 'manual') {
            process.exit(reason === 'SIGTERM' || reason === 'SIGINT' ? 0 : 1);
        }
    }

    getHealthStatus() {
        return {
            server: {
                status: this.server ? 'running' : 'stopped',
                port: this.config.port,
                host: this.config.host,
                uptime: process.uptime()
            },
            observatory: this.observatory?.getHealthStatus() || { status: 'not_initialized' }
        };
    }
}

module.exports = { LangObservatoryServer };