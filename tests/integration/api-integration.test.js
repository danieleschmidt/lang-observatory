/**
 * API Integration Tests
 * Test the complete API functionality with real components
 */

const { LangObservatoryServer } = require('../../src/api/server');
const { LangObservatory } = require('../../src/index');
const request = require('supertest');

describe('API Integration Tests', () => {
    let server;
    let app;

    beforeAll(async () => {
        // Create server with minimal config
        server = new LangObservatoryServer({
            port: 0, // Use random port
            observatory: {
                langfuse: { enabled: false },
                openlit: { enabled: false },
                metrics: { enabled: false }
            }
        });

        await server.initialize();
        await server.start();
        app = server.app;
    });

    afterAll(async () => {
        if (server) {
            await server.shutdown();
        }
    });

    describe('Root Endpoint', () => {
        test('should return service information', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.body).toMatchObject({
                service: 'Lang Observatory API',
                version: '0.1.0',
                status: 'running',
                endpoints: expect.any(Object)
            });
        });
    });

    describe('Health Endpoints', () => {
        test('should return health status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('should return detailed health status', async () => {
            const response = await request(app)
                .get('/api/health/detailed')
                .expect(200);

            expect(response.body).toHaveProperty('services');
            expect(response.body).toHaveProperty('reliability');
        });
    });

    describe('Metrics Endpoints', () => {
        test('should return basic metrics', async () => {
            const response = await request(app)
                .get('/api/metrics')
                .expect(200);

            expect(response.body).toHaveProperty('metrics');
            expect(Array.isArray(response.body.metrics)).toBe(true);
        });

        test('should return system metrics', async () => {
            const response = await request(app)
                .get('/api/metrics/system')
                .expect(200);

            expect(response.body).toHaveProperty('cpu');
            expect(response.body).toHaveProperty('memory');
        });
    });

    describe('LLM Endpoints', () => {
        test('should record LLM call', async () => {
            const llmCall = {
                provider: 'test-provider',
                model: 'test-model',
                input: 'Test input',
                output: 'Test output'
            };

            const response = await request(app)
                .post('/api/llm/calls')
                .send(llmCall)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.provider).toBe(llmCall.provider);
        });

        test('should validate required fields', async () => {
            const invalidCall = {
                provider: 'test-provider'
                // missing required fields
            };

            await request(app)
                .post('/api/llm/calls')
                .send(invalidCall)
                .expect(400);
        });
    });

    describe('Error Handling', () => {
        test('should handle 404 errors', async () => {
            const response = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            expect(response.body).toMatchObject({
                error: 'Not Found',
                message: expect.stringContaining('Route /api/nonexistent not found')
            });
        });

        test('should handle invalid JSON', async () => {
            await request(app)
                .post('/api/llm/calls')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
        });
    });

    describe('CORS', () => {
        test('should include CORS headers', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.headers['access-control-allow-origin']).toBe('*');
        });

        test('should handle OPTIONS requests', async () => {
            await request(app)
                .options('/api/health')
                .expect(200);
        });
    });

    describe('Request Validation', () => {
        test('should validate content type for POST requests', async () => {
            await request(app)
                .post('/api/llm/calls')
                .set('Content-Type', 'text/plain')
                .send('invalid data')
                .expect(400);
        });

        test('should handle large payloads', async () => {
            const largePayload = {
                provider: 'test',
                model: 'test',
                input: 'x'.repeat(1000000), // 1MB
                output: 'test'
            };

            // Should handle large but reasonable payloads
            await request(app)
                .post('/api/llm/calls')
                .send(largePayload)
                .expect(413); // Payload too large
        });
    });
});