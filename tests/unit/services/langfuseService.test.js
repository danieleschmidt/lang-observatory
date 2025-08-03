/**
 * LangfuseTracer Service Unit Tests
 */

const { LangfuseTracer } = require('../../../src/services/langfuseService');

describe('LangfuseTracer', () => {
    let tracer;

    beforeEach(() => {
        tracer = new LangfuseTracer({
            host: 'http://localhost:3000',
            publicKey: 'test-public-key',
            secretKey: 'test-secret-key',
            enabled: true
        });
    });

    afterEach(async () => {
        if (tracer.initialized) {
            await tracer.shutdown();
        }
    });

    describe('initialization', () => {
        it('should initialize successfully with valid config', async () => {
            await tracer.initialize();
            expect(tracer.initialized).toBe(true);
        });

        it('should handle disabled tracer', async () => {
            const disabledTracer = new LangfuseTracer({ enabled: false });
            await disabledTracer.initialize();
            expect(disabledTracer.initialized).toBe(true);
        });

        it('should throw error with missing credentials', async () => {
            const invalidTracer = new LangfuseTracer({
                host: 'http://localhost:3000',
                enabled: true
            });
            
            await expect(invalidTracer.initialize()).rejects.toThrow('Langfuse public key and secret key are required');
        });
    });

    describe('trace management', () => {
        beforeEach(async () => {
            await tracer.initialize();
        });

        it('should start a trace', () => {
            const traceId = tracer.startTrace('test_operation', { user: 'test' });
            
            expect(traceId).toBeDefined();
            expect(typeof traceId).toBe('string');
            expect(tracer.traces.has(traceId)).toBe(true);
        });

        it('should end a trace successfully', () => {
            const traceId = tracer.startTrace('test_operation');
            
            tracer.endTrace(traceId, { success: true, duration: 1000 });
            
            expect(tracer.traces.has(traceId)).toBe(false);
            expect(tracer.pendingEvents.length).toBeGreaterThan(0);
        });

        it('should handle ending non-existent trace', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            tracer.endTrace('non-existent-trace-id');
            
            consoleSpy.mockRestore();
        });
    });

    describe('LLM call recording', () => {
        beforeEach(async () => {
            await tracer.initialize();
        });

        it('should record LLM call', async () => {
            const callData = {
                provider: 'openai',
                model: 'gpt-4',
                input: 'Test input',
                output: 'Test output',
                metadata: { test: true }
            };

            await tracer.recordLLMCall(callData);
            
            expect(tracer.pendingEvents.length).toBeGreaterThan(0);
            
            const event = tracer.pendingEvents.find(e => e.type === 'llm_call');
            expect(event).toBeDefined();
            expect(event.data.provider).toBe('openai');
            expect(event.data.model).toBe('gpt-4');
        });

        it('should sanitize sensitive input data', async () => {
            const longInput = 'a'.repeat(2000);
            const callData = {
                provider: 'openai',
                model: 'gpt-4',
                input: longInput,
                output: 'Test output'
            };

            await tracer.recordLLMCall(callData);
            
            const event = tracer.pendingEvents.find(e => e.type === 'llm_call');
            expect(event.data.input.length).toBeLessThanOrEqual(1000);
        });

        it('should calculate token usage', async () => {
            const callData = {
                provider: 'openai',
                model: 'gpt-4',
                input: 'Test input message',
                output: 'Test output response'
            };

            await tracer.recordLLMCall(callData);
            
            const event = tracer.pendingEvents.find(e => e.type === 'llm_call');
            expect(event.data.tokens).toBeDefined();
            expect(event.data.tokens.input).toBeGreaterThan(0);
            expect(event.data.tokens.output).toBeGreaterThan(0);
            expect(event.data.tokens.total).toBeGreaterThan(0);
        });

        it('should calculate costs', async () => {
            const callData = {
                provider: 'openai',
                model: 'gpt-4',
                input: 'Test input',
                output: 'Test output'
            };

            await tracer.recordLLMCall(callData);
            
            const event = tracer.pendingEvents.find(e => e.type === 'llm_call');
            expect(event.data.cost).toBeDefined();
            expect(event.data.cost.total).toBeGreaterThan(0);
        });
    });

    describe('health check', () => {
        it('should return healthy status when disabled', async () => {
            const disabledTracer = new LangfuseTracer({ enabled: false });
            const health = await disabledTracer.getHealth();
            
            expect(health.healthy).toBe(true);
            expect(health.status).toBe('disabled');
        });

        it('should return health status when enabled', async () => {
            await tracer.initialize();
            const health = await tracer.getHealth();
            
            expect(health).toHaveProperty('healthy');
            expect(health).toHaveProperty('status');
            expect(health).toHaveProperty('pendingEvents');
            expect(health).toHaveProperty('activeTraces');
        });
    });

    describe('batch processing', () => {
        beforeEach(async () => {
            await tracer.initialize();
        });

        it('should flush events when batch size is reached', async () => {
            const originalBatchSize = tracer.config.batchSize;
            tracer.config.batchSize = 2;

            // Add events to reach batch size
            await tracer.recordLLMCall({ provider: 'test1', model: 'test1' });
            expect(tracer.pendingEvents.length).toBe(1);

            await tracer.recordLLMCall({ provider: 'test2', model: 'test2' });
            
            // Should have triggered flush
            expect(tracer.pendingEvents.length).toBe(0);
            
            tracer.config.batchSize = originalBatchSize;
        });
    });

    describe('error handling', () => {
        it('should handle flush errors gracefully', async () => {
            await tracer.initialize();
            
            // Mock submitToLangfuse to throw error
            const originalSubmit = tracer._submitToLangfuse;
            tracer._submitToLangfuse = jest.fn().mockRejectedValue(new Error('Network error'));

            await tracer.recordLLMCall({ provider: 'test', model: 'test' });
            await tracer._flush();

            // Events should be re-queued on error
            expect(tracer.pendingEvents.length).toBeGreaterThan(0);
            
            tracer._submitToLangfuse = originalSubmit;
        });
    });
});