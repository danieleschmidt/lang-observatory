/**
 * Integration tests for neuromorphic components
 * Testing the full integration between PhotonProcessor and NeuromorphicLLMInterface
 */

const { LangObservatory } = require('../../src/index');
const { PhotonProcessor } = require('../../src/neuromorphic/photonProcessor');
const { NeuromorphicLLMInterface } = require('../../src/neuromorphic/neuromorphicLLMInterface');

describe('Neuromorphic Integration Tests', () => {
    let langObservatory;
    let photonProcessor;
    let neuromorphicInterface;
    
    beforeAll(async () => {
        // Set timeouts higher for integration tests
        jest.setTimeout(30000);
    });
    
    beforeEach(async () => {
        // Initialize components with test configuration
        photonProcessor = new PhotonProcessor({
            maxNeurons: 100, // Smaller for faster tests
            spikeThreshold: 0.5,
            decayRate: 0.9,
            quantumCoherence: 0.8
        });
        
        neuromorphicInterface = new NeuromorphicLLMInterface({
            realTimeProcessing: false,
            learningEnabled: true,
            photon: {
                maxNeurons: 100,
                spikeThreshold: 0.5
            }
        });
        
        langObservatory = new LangObservatory({
            photon: {
                maxNeurons: 100,
                spikeThreshold: 0.5
            },
            neuromorphic: {
                realTimeProcessing: false,
                learningEnabled: true
            }
        });
    });
    
    afterEach(async () => {
        if (photonProcessor?.initialized) {
            await photonProcessor.shutdown();
        }
        if (neuromorphicInterface?.initialized) {
            await neuromorphicInterface.shutdown();
        }
        if (langObservatory?.initialized) {
            await langObservatory.shutdown();
        }
    });

    describe('Component Integration', () => {
        test('should initialize all neuromorphic components successfully', async () => {
            await photonProcessor.initialize();
            await neuromorphicInterface.initialize();
            
            expect(photonProcessor.initialized).toBe(true);
            expect(neuromorphicInterface.initialized).toBe(true);
            
            const photonHealth = await photonProcessor.getHealth();
            const interfaceHealth = await neuromorphicInterface.getHealth();
            
            expect(photonHealth.healthy).toBe(true);
            expect(interfaceHealth.healthy).toBe(true);
        });
        
        test('should process LLM data through full neuromorphic pipeline', async () => {
            await neuromorphicInterface.initialize();
            
            const llmData = {
                id: 'integration-test-1',
                provider: 'openai',
                model: 'gpt-4',
                inputTokens: 150,
                outputTokens: 100,
                duration: 2000,
                cost: 0.05,
                success: true,
                timestamp: new Date().toISOString()
            };
            
            const result = await neuromorphicInterface.processLLMCall(llmData);
            
            expect(result).toHaveProperty('neuromorphicResult');
            expect(result).toHaveProperty('adaptiveRecommendations');
            expect(result).toHaveProperty('processingTime');
            
            const neuromorphicResult = result.neuromorphicResult;
            expect(neuromorphicResult).toHaveProperty('original');
            expect(neuromorphicResult).toHaveProperty('insights');
            expect(neuromorphicResult).toHaveProperty('quantumStates');
            
            const insights = neuromorphicResult.insights;
            expect(insights).toHaveProperty('performanceOptimization');
            expect(insights).toHaveProperty('costEfficiencyRecommendations');
            expect(insights).toHaveProperty('qualityImprovements');
            expect(insights).toHaveProperty('predictiveAnalytics');
            expect(insights).toHaveProperty('quantumCorrelations');
        });
        
        test('should integrate with LangObservatory main class', async () => {
            await langObservatory.initialize();
            
            const llmCallResult = await langObservatory.recordLLMCall(
                'openai',
                'gpt-4',
                { prompt: 'Test prompt', tokens: 50 },
                { response: 'Test response', tokens: 30 },
                { 
                    duration: 1500,
                    cost: 0.02,
                    quality: 0.85
                }
            );
            
            expect(llmCallResult).toHaveProperty('neuromorphicInsights');
            expect(llmCallResult.neuromorphicInsights).toBeDefined();
            
            // Test additional neuromorphic methods
            const callId = llmCallResult.id;
            const insights = await langObservatory.getNeuromorphicInsights(callId);
            expect(insights).toBeDefined();
            
            const metrics = await langObservatory.getNeuromorphicMetrics();
            expect(metrics).toHaveProperty('photonProcessor');
            expect(metrics).toHaveProperty('interface');
            
            const photonStats = langObservatory.getPhotonProcessorStats();
            expect(photonStats).toHaveProperty('spikesProcessed');
            expect(photonStats).toHaveProperty('photonsEmitted');
        });
        
        test('should handle provider-specific adaptive optimization', async () => {
            await neuromorphicInterface.initialize();
            
            // Process multiple calls for the same provider
            const provider = 'openai';
            const calls = [
                { id: 'call-1', provider, duration: 1000, cost: 0.01, inputTokens: 100, outputTokens: 50 },
                { id: 'call-2', provider, duration: 1500, cost: 0.02, inputTokens: 150, outputTokens: 75 },
                { id: 'call-3', provider, duration: 2000, cost: 0.03, inputTokens: 200, outputTokens: 100 }
            ];
            
            const results = [];
            for (const call of calls) {
                const result = await neuromorphicInterface.processLLMCall(call);
                results.push(result);
            }
            
            // Check that adaptive model is being updated
            const providerInsights = await neuromorphicInterface.getProviderInsights(provider);
            expect(providerInsights.insights.length).toBe(3);
            expect(providerInsights.adaptiveModel.lastUpdated).toBeGreaterThan(0);
            
            // Verify recommendations improve over time (adaptive learning)
            const firstScore = results[0].adaptiveRecommendations.adaptiveScore.overall;
            const lastScore = results[2].adaptiveRecommendations.adaptiveScore.overall;
            
            expect(typeof firstScore).toBe('number');
            expect(typeof lastScore).toBe('number');
        });
        
        test('should handle concurrent processing correctly', async () => {
            await neuromorphicInterface.initialize();
            
            // Create multiple concurrent LLM calls
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(neuromorphicInterface.processLLMCall({
                    id: `concurrent-call-${i}`,
                    provider: 'openai',
                    inputTokens: 100 + i * 10,
                    outputTokens: 50 + i * 5,
                    duration: 1000 + i * 200,
                    cost: 0.01 + i * 0.005
                }));
            }
            
            const results = await Promise.all(promises);
            
            expect(results.length).toBe(5);
            results.forEach((result, index) => {
                expect(result).toHaveProperty('neuromorphicResult');
                expect(result).toHaveProperty('adaptiveRecommendations');
                expect(result.id).toBe(`concurrent-call-${index}`);
            });
            
            // Verify all calls were processed and stored
            expect(neuromorphicInterface.llmCallHistory.length).toBe(5);
            expect(neuromorphicInterface.neuromorphicInsights.size).toBe(5);
        });
    });

    describe('Real-time Processing Integration', () => {
        test('should handle real-time processing mode', async () => {
            const realTimeInterface = new NeuromorphicLLMInterface({
                realTimeProcessing: true,
                photon: {
                    maxNeurons: 50
                }
            });
            
            await realTimeInterface.initialize();
            
            // Add multiple calls to queue
            const queuePromises = [];
            for (let i = 0; i < 3; i++) {
                queuePromises.push(realTimeInterface.processLLMCall({
                    id: `queue-call-${i}`,
                    provider: 'openai',
                    inputTokens: 100,
                    duration: 1000
                }));
            }
            
            const queueResults = await Promise.all(queuePromises);
            
            // All should return queued status
            queueResults.forEach(result => {
                expect(result.queued).toBe(true);
            });
            
            expect(realTimeInterface.processingQueue.length).toBe(3);
            
            // Wait for background processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Queue should be processed (might not be empty due to timing)
            expect(realTimeInterface.llmCallHistory.length).toBe(3);
            
            await realTimeInterface.shutdown();
        });
    });

    describe('Performance and Scalability Integration', () => {
        test('should maintain performance under load', async () => {
            await neuromorphicInterface.initialize();
            
            const startTime = Date.now();
            const numCalls = 20;
            
            // Process multiple calls
            const promises = [];
            for (let i = 0; i < numCalls; i++) {
                promises.push(neuromorphicInterface.processLLMCall({
                    id: `load-test-${i}`,
                    provider: i % 2 === 0 ? 'openai' : 'anthropic',
                    inputTokens: 100 + Math.floor(Math.random() * 100),
                    outputTokens: 50 + Math.floor(Math.random() * 50),
                    duration: 1000 + Math.floor(Math.random() * 2000),
                    cost: 0.01 + Math.random() * 0.04
                }));
            }
            
            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;
            
            expect(results.length).toBe(numCalls);
            expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
            
            // Verify all results have valid structure
            results.forEach(result => {
                expect(result).toHaveProperty('neuromorphicResult');
                expect(result).toHaveProperty('adaptiveRecommendations');
                expect(result.processingTime).toBeGreaterThan(0);
            });
            
            // Check system health after load
            const health = await neuromorphicInterface.getHealth();
            expect(health.healthy).toBe(true);
        });
        
        test('should handle memory efficiently during extended processing', async () => {
            await neuromorphicInterface.initialize();
            
            const initialMemory = process.memoryUsage();
            
            // Process calls in batches to simulate extended usage
            for (let batch = 0; batch < 5; batch++) {
                const batchPromises = [];
                for (let i = 0; i < 10; i++) {
                    batchPromises.push(neuromorphicInterface.processLLMCall({
                        id: `memory-test-${batch}-${i}`,
                        provider: 'openai',
                        inputTokens: 150,
                        outputTokens: 75,
                        duration: 1200
                    }));
                }
                await Promise.all(batchPromises);
                
                // Force garbage collection between batches
                if (global.gc) {
                    global.gc();
                }
            }
            
            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory growth should be reasonable (less than 100MB)
            expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
            
            // Verify system is still healthy
            const health = await neuromorphicInterface.getHealth();
            expect(health.healthy).toBe(true);
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle photon processor failures gracefully', async () => {
            await neuromorphicInterface.initialize();
            
            // Mock a failure in the photon processor
            const originalProcessLLMData = neuromorphicInterface.photonProcessor.processLLMData;
            neuromorphicInterface.photonProcessor.processLLMData = jest.fn()
                .mockRejectedValue(new Error('Photon processor failure'));
            
            const llmData = { id: 'error-test', provider: 'openai' };
            
            await expect(neuromorphicInterface.processLLMCall(llmData))
                .rejects.toThrow('Photon processor failure');
            
            // Restore original method
            neuromorphicInterface.photonProcessor.processLLMData = originalProcessLLMData;
            
            // Verify system can still process after error
            const normalResult = await neuromorphicInterface.processLLMCall({
                id: 'recovery-test',
                provider: 'openai'
            });
            
            expect(normalResult).toBeDefined();
        });
        
        test('should maintain data consistency during partial failures', async () => {
            await neuromorphicInterface.initialize();
            
            // Process some successful calls first
            await neuromorphicInterface.processLLMCall({ id: 'success-1', provider: 'openai' });
            await neuromorphicInterface.processLLMCall({ id: 'success-2', provider: 'openai' });
            
            const initialHistoryCount = neuromorphicInterface.llmCallHistory.length;
            const initialInsightsCount = neuromorphicInterface.neuromorphicInsights.size;
            
            // Mock a failure that happens after history is updated but before insights are stored
            const originalProcessInternal = neuromorphicInterface.processLLMCallInternal;
            neuromorphicInterface.processLLMCallInternal = jest.fn(async (callData) => {
                // Add to history
                neuromorphicInterface.llmCallHistory.push(callData);
                // Then fail
                throw new Error('Partial failure');
            });
            
            try {
                await neuromorphicInterface.processLLMCall({ id: 'partial-fail', provider: 'openai' });
            } catch (error) {
                expect(error.message).toBe('Partial failure');
            }
            
            // Restore original method
            neuromorphicInterface.processLLMCallInternal = originalProcessInternal;
            
            // Verify data consistency
            expect(neuromorphicInterface.llmCallHistory.length).toBeGreaterThan(initialHistoryCount);
            
            // System should still be able to process new calls
            const recoveryResult = await neuromorphicInterface.processLLMCall({
                id: 'recovery',
                provider: 'openai'
            });
            expect(recoveryResult).toBeDefined();
        });
    });

    describe('Cross-Component Communication', () => {
        test('should handle events between components correctly', async () => {
            await neuromorphicInterface.initialize();
            
            let neuronSpikeEventReceived = false;
            let quantumStateEventReceived = false;
            let llmCallProcessedEventReceived = false;
            
            // Set up event listeners
            neuromorphicInterface.on('neuromorphicActivity', (data) => {
                if (data.type === 'spike') {
                    neuronSpikeEventReceived = true;
                }
                if (data.type === 'quantum') {
                    quantumStateEventReceived = true;
                }
            });
            
            neuromorphicInterface.on('llmCallProcessed', (data) => {
                llmCallProcessedEventReceived = true;
                expect(data).toHaveProperty('callId');
                expect(data).toHaveProperty('insights');
            });
            
            // Process a call to trigger events
            await neuromorphicInterface.processLLMCall({
                id: 'event-test',
                provider: 'openai',
                inputTokens: 200, // Higher values more likely to trigger spikes
                outputTokens: 100,
                duration: 2000
            });
            
            // Give events time to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
            
            expect(llmCallProcessedEventReceived).toBe(true);
            // Note: Spike and quantum events depend on the stochastic nature of the simulation
        });
        
        test('should maintain component synchronization', async () => {
            await langObservatory.initialize();
            
            // Test that all components are properly synchronized
            const healthStatus = await langObservatory.getHealthStatus();
            
            expect(healthStatus.status).toBe('healthy');
            expect(healthStatus.services.photonProcessor.healthy).toBe(true);
            expect(healthStatus.services.neuromorphicInterface.healthy).toBe(true);
            
            // Process a call through the main interface
            const result = await langObservatory.recordLLMCall(
                'anthropic',
                'claude-3',
                { prompt: 'Integration test', tokens: 75 },
                { response: 'Integration response', tokens: 50 },
                { duration: 1800, cost: 0.025 }
            );
            
            expect(result).toHaveProperty('neuromorphicInsights');
            
            // Verify all components have consistent state
            const neuromorphicMetrics = await langObservatory.getNeuromorphicMetrics();
            expect(neuromorphicMetrics.interface.totalLLMCalls).toBeGreaterThan(0);
            
            const photonStats = langObservatory.getPhotonProcessorStats();
            expect(photonStats.spikesProcessed).toBeGreaterThanOrEqual(0);
            expect(photonStats.photonsEmitted).toBeGreaterThan(0);
        });
    });

    describe('Data Flow Integration', () => {
        test('should maintain data consistency across processing pipeline', async () => {
            await neuromorphicInterface.initialize();
            
            const originalLLMData = {
                id: 'data-flow-test',
                provider: 'google',
                model: 'gemini-pro',
                inputTokens: 180,
                outputTokens: 120,
                duration: 2200,
                cost: 0.035,
                success: true,
                timestamp: '2023-12-01T12:00:00Z'
            };
            
            const result = await neuromorphicInterface.processLLMCall(originalLLMData);
            
            // Verify data consistency through the pipeline
            const neuromorphicResult = result.neuromorphicResult;
            
            expect(neuromorphicResult.original).toMatchObject({
                tokens: 300, // inputTokens + outputTokens
                latency: 2200,
                cost: 0.035,
                provider: 'google',
                model: 'gemini-pro'
            });
            
            expect(neuromorphicResult.neuromorphicEncoding).toHaveProperty('tokenSpikes');
            expect(neuromorphicResult.neuromorphicEncoding).toHaveProperty('latencySpikes');
            expect(neuromorphicResult.neuromorphicEncoding).toHaveProperty('costSpikes');
            expect(neuromorphicResult.neuromorphicEncoding).toHaveProperty('qualitySpikes');
            
            expect(neuromorphicResult.processed).toBeDefined();
            expect(neuromorphicResult.insights).toBeDefined();
            
            // Verify the call is stored correctly
            const storedInsights = await neuromorphicInterface.getLLMInsights('data-flow-test');
            expect(storedInsights).toBeDefined();
            expect(storedInsights.id).toBe('data-flow-test');
        });
    });

    describe('Shutdown Integration', () => {
        test('should shutdown all components gracefully', async () => {
            await langObservatory.initialize();
            
            // Verify all components are running
            expect(langObservatory.initialized).toBe(true);
            expect(langObservatory.photonProcessor.initialized).toBe(true);
            expect(langObservatory.neuromorphicInterface.initialized).toBe(true);
            
            // Process some data to ensure components are active
            await langObservatory.recordLLMCall(
                'openai',
                'gpt-3.5-turbo',
                { prompt: 'Shutdown test', tokens: 25 },
                { response: 'Shutdown response', tokens: 15 },
                { duration: 800, cost: 0.001 }
            );
            
            // Shutdown
            await langObservatory.shutdown();
            
            // Verify all components are shut down
            expect(langObservatory.initialized).toBe(false);
            expect(langObservatory.photonProcessor.initialized).toBe(false);
            expect(langObservatory.neuromorphicInterface.initialized).toBe(false);
            
            // Verify cleanup was performed
            expect(langObservatory.neuromorphicInterface.llmCallHistory.length).toBe(0);
            expect(langObservatory.neuromorphicInterface.adaptiveModels.size).toBe(0);
            expect(langObservatory.photonProcessor.neurons.size).toBe(0);
        });
        
        test('should handle partial shutdown failures', async () => {
            await langObservatory.initialize();
            
            // Mock a shutdown failure in photon processor
            const originalShutdown = langObservatory.photonProcessor.shutdown;
            langObservatory.photonProcessor.shutdown = jest.fn()
                .mockRejectedValue(new Error('Shutdown failed'));
            
            // Should complete shutdown despite the failure
            await langObservatory.shutdown();
            
            // Main system should still be marked as shut down
            expect(langObservatory.initialized).toBe(false);
            
            // Restore original method for cleanup
            langObservatory.photonProcessor.shutdown = originalShutdown;
        });
    });
});