/**
 * Health Routes Unit Tests
 */

const request = require('supertest');
const express = require('express');
const healthRoutes = require('../../../src/routes/health');
const { createConnection } = require('../../../src/database/connection');

// Mock database connection
jest.mock('../../../src/database/connection');

describe('Health Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use('/health', healthRoutes);
        
        // Reset mocks
        jest.clearAllMocks();
    });

    describe('GET /health', () => {
        it('should return basic health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'healthy',
                version: expect.any(String),
                uptime: expect.any(Number),
                memory: expect.any(Object),
                node: expect.any(String)
            });
            
            expect(response.body.timestamp).toBeDefined();
        });
    });

    describe('GET /health/detailed', () => {
        it('should return detailed health status with healthy database', async () => {
            const mockDb = {
                healthCheck: jest.fn().mockResolvedValue({ healthy: true })
            };
            createConnection.mockReturnValue(mockDb);

            const response = await request(app)
                .get('/health/detailed')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'healthy',
                checks: {
                    database: { healthy: true },
                    memory: { healthy: expect.any(Boolean) },
                    disk: { healthy: true }
                }
            });
        });

        it('should return degraded status with unhealthy database', async () => {
            const mockDb = {
                healthCheck: jest.fn().mockResolvedValue({ healthy: false, error: 'Connection failed' })
            };
            createConnection.mockReturnValue(mockDb);

            const response = await request(app)
                .get('/health/detailed')
                .expect(200);

            expect(response.body.status).toBe('degraded');
            expect(response.body.checks.database.healthy).toBe(false);
        });

        it('should handle database connection errors', async () => {
            createConnection.mockImplementation(() => {
                throw new Error('Database not initialized');
            });

            const response = await request(app)
                .get('/health/detailed')
                .expect(200);

            expect(response.body.status).toBe('unhealthy');
            expect(response.body.checks.database.healthy).toBe(false);
            expect(response.body.checks.database.error).toBe('Database not initialized');
        });
    });

    describe('GET /health/live', () => {
        it('should return liveness probe status', async () => {
            const response = await request(app)
                .get('/health/live')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'alive',
                timestamp: expect.any(String)
            });
        });
    });

    describe('GET /health/ready', () => {
        it('should return ready status when database is healthy', async () => {
            const mockDb = {
                healthCheck: jest.fn().mockResolvedValue({ healthy: true })
            };
            createConnection.mockReturnValue(mockDb);

            const response = await request(app)
                .get('/health/ready')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'ready',
                timestamp: expect.any(String)
            });
        });

        it('should return not ready status when database is unhealthy', async () => {
            const mockDb = {
                healthCheck: jest.fn().mockResolvedValue({ healthy: false })
            };
            createConnection.mockReturnValue(mockDb);

            const response = await request(app)
                .get('/health/ready')
                .expect(503);

            expect(response.body).toMatchObject({
                status: 'not_ready',
                reason: 'Database not healthy'
            });
        });

        it('should handle database errors', async () => {
            createConnection.mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            const response = await request(app)
                .get('/health/ready')
                .expect(503);

            expect(response.body.status).toBe('not_ready');
            expect(response.body.error).toBe('Database connection failed');
        });
    });

    describe('GET /health/startup', () => {
        it('should return started status when all checks pass', async () => {
            const mockDb = {
                query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })
            };
            createConnection.mockReturnValue(mockDb);

            const response = await request(app)
                .get('/health/startup')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'started',
                checks: {
                    database: true,
                    routes: true,
                    services: true
                }
            });
        });

        it('should return starting status when database check fails', async () => {
            const mockDb = {
                query: jest.fn().mockRejectedValue(new Error('Database error'))
            };
            createConnection.mockReturnValue(mockDb);

            const response = await request(app)
                .get('/health/startup')
                .expect(503);

            expect(response.body.status).toBe('starting');
            expect(response.body.checks.database).toBe(false);
        });
    });

    describe('GET /health/info', () => {
        it('should return system information', async () => {
            const response = await request(app)
                .get('/health/info')
                .expect(200);

            expect(response.body).toMatchObject({
                application: {
                    name: 'Lang Observatory',
                    version: expect.any(String),
                    description: expect.any(String)
                },
                runtime: {
                    node: expect.any(String),
                    platform: expect.any(String),
                    uptime: expect.any(Number),
                    memory: expect.any(Object)
                },
                environment: {
                    node_env: expect.any(String)
                },
                features: expect.any(Object)
            });
        });

        it('should include feature flags in response', async () => {
            process.env.LANGFUSE_ENABLED = 'true';
            process.env.OPENLIT_ENABLED = 'true';

            const response = await request(app)
                .get('/health/info')
                .expect(200);

            expect(response.body.features).toMatchObject({
                langfuse: true,
                openlit: true
            });

            // Clean up environment variables
            delete process.env.LANGFUSE_ENABLED;
            delete process.env.OPENLIT_ENABLED;
        });
    });

    describe('error handling', () => {
        it('should handle unexpected errors gracefully', async () => {
            // Mock process.uptime to throw an error
            const originalUptime = process.uptime;
            process.uptime = jest.fn().mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const response = await request(app)
                .get('/health')
                .expect(500);

            expect(response.body).toMatchObject({
                status: 'unhealthy',
                error: 'Unexpected error'
            });

            // Restore original function
            process.uptime = originalUptime;
        });
    });
});