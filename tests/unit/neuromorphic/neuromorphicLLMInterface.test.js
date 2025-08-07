/**
 * Unit tests for NeuromorphicLLMInterface
 * Testing the bridge between LLM observability and neuromorphic processing
 */

const { NeuromorphicLLMInterface } = require('../../../src/neuromorphic/neuromorphicLLMInterface');
const { PhotonProcessor } = require('../../../src/neuromorphic/photonProcessor');

// Mock PhotonProcessor for focused testing
jest.mock('../../../src/neuromorphic/photonProcessor');

describe('NeuromorphicLLMInterface', () => {
    let interface;
    let mockPhotonProcessor;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        mockPhotonProcessor = {
            initialize: jest.fn().mockResolvedValue(true),
            processLLMData: jest.fn().mockResolvedValue({
                original: {},
                neuromorphicEncoding: {},
                processed: {},
                insights: {
                    performanceOptimization: { confidence: 0.8, recommendations: ['Test recommendation'] },
                    costEfficiencyRecommendations: { confidence: 0.7, recommendations: ['Cost optimization'], costEfficiency: 0.85 },
                    qualityImprovements: { confidence: 0.6, recommendations: ['Quality improvement'] },
                    predictiveAnalytics: { confidence: 0.9, predictions: [{ type: 'test', probability: 0.8, timeframe: '5min', mitigation: 'test' }] },
                    quantumCorrelations: { strongCorrelations: 15, totalCorrelations: 50 }
                },
                processingTime: 100,
                timestamp: new Date().toISOString()
            }),
            getProcessingStats: jest.fn().mockReturnValue({
                spikesProcessed: 100,
                photonsEmitted: 500,
                quantumOperations: 200,
                avgProcessingTime: 150
            }),
            getHealth: jest.fn().mockResolvedValue({ healthy: true }),
            shutdown: jest.fn().mockResolvedValue(true),
            on: jest.fn()
        };
        
        PhotonProcessor.mockImplementation(() => mockPhotonProcessor);
        
        interface = new NeuromorphicLLMInterface({
            adaptiveThreshold: 0.6,
            learningEnabled: true,
            realTimeProcessing: false,
            quantumEnhancement: true
        });
    });
    
    afterEach(async () => {
        if (interface.initialized) {
            await interface.shutdown();
        }
    });

    describe('Initialization', () => {
        test('should initialize successfully', async () => {
            await interface.initialize();
            
            expect(interface.initialized).toBe(true);
            expect(mockPhotonProcessor.initialize).toHaveBeenCalled();
            expect(interface.adaptiveModels.size).toBeGreaterThan(0);
        });
        
        test('should handle initialization failure', async () => {
            mockPhotonProcessor.initialize.mockRejectedValue(new Error('Photon processor failed'));
            
            await expect(interface.initialize()).rejects.toThrow('Photon processor failed');
            expect(interface.initialized).toBe(false);
        });
        
        test('should initialize adaptive models for known providers', async () => {
            await interface.initialize();
            
            expect(interface.adaptiveModels.has('openai')).toBe(true);
            expect(interface.adaptiveModels.has('anthropic')).toBe(true);
            expect(interface.adaptiveModels.has('google')).toBe(true);
            expect(interface.adaptiveModels.has('meta')).toBe(true);
            expect(interface.adaptiveModels.has('cohere')).toBe(true);
        });
        
        test('should setup event listeners correctly', async () => {
            await interface.initialize();
            
            expect(mockPhotonProcessor.on).toHaveBeenCalledWith('neuronSpike', expect.any(Function));
            expect(mockPhotonProcessor.on).toHaveBeenCalledWith('quantumStateChange', expect.any(Function));
        });
        
        test('should start real-time processing when enabled', async () => {
            const realTimeInterface = new NeuromorphicLLMInterface({
                realTimeProcessing: true
            });
            
            await realTimeInterface.initialize();
            
            expect(realTimeInterface.config.realTimeProcessing).toBe(true);
            
            await realTimeInterface.shutdown();
        });
    });

    describe('Adaptive Models', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should create neuromorphic profiles for providers', async () => {
            const openaiModel = interface.adaptiveModels.get('openai');
            const profile = openaiModel.neuromorphicProfile;
            
            expect(profile).toHaveProperty('preferredWavelengths');
            expect(profile).toHaveProperty('neuronAffinities');
            expect(profile).toHaveProperty('quantumParameters');
            expect(profile).toHaveProperty('plasticityFactors');
            
            expect(profile.preferredWavelengths).toHaveProperty('primary');
            expect(profile.quantumParameters).toHaveProperty('coherenceTime');
        });
        
        test('should generate different profiles for different providers', async () => {
            const openaiProfile = interface.adaptiveModels.get('openai').neuromorphicProfile;
            const anthropicProfile = interface.adaptiveModels.get('anthropic').neuromorphicProfile;
            
            expect(openaiProfile.preferredWavelengths.primary)
                .not.toBe(anthropicProfile.preferredWavelengths.primary);
        });
        
        test('should create adaptive model for unknown provider', async () => {
            const unknownProvider = 'unknown-llm';
            const model = interface.getOrCreateAdaptiveModel(unknownProvider);
            
            expect(model).toBeDefined();
            expect(model.provider).toBe(unknownProvider);
            expect(model).toHaveProperty('baselineMetrics');
            expect(model).toHaveProperty('adaptiveWeights');
            expect(interface.adaptiveModels.has(unknownProvider)).toBe(true);
        });
        
        test('should hash providers consistently', () => {
            const hash1 = interface.hashProvider('openai');
            const hash2 = interface.hashProvider('openai');
            const hash3 = interface.hashProvider('anthropic');
            
            expect(hash1).toBe(hash2);
            expect(hash1).not.toBe(hash3);
            expect(hash1).toBeGreaterThanOrEqual(0);
        });
    });

    describe('LLM Call Processing', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should process LLM call successfully', async () => {
            const llmCallData = {
                id: 'test-call-1',
                provider: 'openai',
                model: 'gpt-4',
                inputTokens: 100,
                outputTokens: 50,
                duration: 1500,
                cost: 0.03,
                success: true
            };
            
            const result = await interface.processLLMCall(llmCallData);
            
            expect(result).toHaveProperty('neuromorphicResult');
            expect(result).toHaveProperty('adaptiveRecommendations');
            expect(result).toHaveProperty('processingTime');
            expect(result.processingTime).toBeGreaterThan(0);
            
            expect(mockPhotonProcessor.processLLMData).toHaveBeenCalled();
        });
        
        test('should add to queue when real-time processing enabled', async () => {
            const realTimeInterface = new NeuromorphicLLMInterface({
                realTimeProcessing: true
            });
            await realTimeInterface.initialize();
            
            const llmCallData = { id: 'test-call-1', provider: 'openai' };
            const result = await realTimeInterface.processLLMCall(llmCallData);
            
            expect(result).toHaveProperty('queued');
            expect(result.queued).toBe(true);
            expect(realTimeInterface.processingQueue.length).toBe(1);
            
            await realTimeInterface.shutdown();
        });
        
        test('should store call in history', async () => {
            const llmCallData = {
                id: 'test-call-1',
                provider: 'openai',
                inputTokens: 100,
                outputTokens: 50
            };
            
            await interface.processLLMCall(llmCallData);
            
            expect(interface.llmCallHistory.length).toBe(1);
            expect(interface.llmCallHistory[0].id).toBe('test-call-1');
        });
        
        test('should handle processing errors gracefully', async () => {
            mockPhotonProcessor.processLLMData.mockRejectedValue(new Error('Processing failed'));
            
            const llmCallData = { id: 'test-call-1', provider: 'openai' };
            
            await expect(interface.processLLMCall(llmCallData))
                .rejects.toThrow('Processing failed');
        });
        
        test('should throw error when not initialized', async () => {
            const uninitializedInterface = new NeuromorphicLLMInterface();
            const llmCallData = { id: 'test-call-1', provider: 'openai' };
            
            await expect(uninitializedInterface.processLLMCall(llmCallData))
                .rejects.toThrow('Neuromorphic LLM Interface not initialized');
        });
    });

    describe('Data Preparation and Quality Estimation', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should prepare LLM data for neuromorphic processing', () => {
            const llmCallData = {
                provider: 'openai',
                inputTokens: 100,
                outputTokens: 50,
                duration: 1500,
                cost: 0.03
            };
            
            const adaptiveModel = interface.adaptiveModels.get('openai');
            const prepared = interface.prepareLLMDataForNeuromorphic(llmCallData, adaptiveModel);
            
            expect(prepared).toHaveProperty('tokens');
            expect(prepared).toHaveProperty('latency');
            expect(prepared).toHaveProperty('cost');
            expect(prepared).toHaveProperty('quality');
            expect(prepared).toHaveProperty('neuromorphicProfile');
            expect(prepared).toHaveProperty('adaptiveContext');
            
            expect(prepared.tokens).toBe(150); // inputTokens + outputTokens
        });
        
        test('should estimate quality correctly', () => {
            const goodCall = {
                duration: 1000,
                inputTokens: 100,
                outputTokens: 80,
                success: true
            };
            
            const badCall = {
                duration: 8000,
                error: 'API Error'
            };
            
            const goodQuality = interface.estimateQuality(goodCall);
            const badQuality = interface.estimateQuality(badCall);
            
            expect(goodQuality).toBeGreaterThan(badQuality);
            expect(goodQuality).toBeGreaterThan(0.5);
            expect(badQuality).toBeLessThan(0.3);
        });
        
        test('should get historical performance correctly', () => {
            // Add some calls to history
            interface.llmCallHistory.push(
                { provider: 'openai', duration: 1000, cost: 0.01 },
                { provider: 'openai', duration: 1500, cost: 0.02 },
                { provider: 'anthropic', duration: 2000, cost: 0.03 }
            );
            
            const openaiPerf = interface.getHistoricalPerformance('openai');
            const unknownPerf = interface.getHistoricalPerformance('unknown');
            
            expect(openaiPerf.callCount).toBe(2);
            expect(openaiPerf.avgLatency).toBe(1250);
            expect(openaiPerf.avgCost).toBe(0.015);
            
            expect(unknownPerf.callCount).toBe(0);
        });
    });

    describe('Adaptive Recommendations', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should generate comprehensive recommendations', async () => {
            const llmCallData = { provider: 'openai', inputTokens: 100 };
            const result = await interface.processLLMCall(llmCallData);
            
            const recommendations = result.adaptiveRecommendations;
            
            expect(recommendations).toHaveProperty('total');
            expect(recommendations).toHaveProperty('byPriority');
            expect(recommendations).toHaveProperty('recommendations');
            expect(recommendations).toHaveProperty('adaptiveScore');
            
            expect(recommendations.byPriority).toHaveProperty('critical');
            expect(recommendations.byPriority).toHaveProperty('high');
            expect(recommendations.byPriority).toHaveProperty('medium');
            expect(recommendations.byPriority).toHaveProperty('low');
        });
        
        test('should generate recommendations based on confidence levels', async () => {
            // Mock high confidence insights
            mockPhotonProcessor.processLLMData.mockResolvedValue({
                insights: {
                    performanceOptimization: { confidence: 0.9, recommendations: ['High perf rec'] },
                    costEfficiencyRecommendations: { confidence: 0.8, recommendations: ['High cost rec'], costEfficiency: 0.9 },
                    qualityImprovements: { confidence: 0.7, recommendations: ['High quality rec'] },
                    predictiveAnalytics: { confidence: 0.85, predictions: [{ type: 'test', probability: 0.9, timeframe: '1min', mitigation: 'test' }] },
                    quantumCorrelations: { strongCorrelations: 20 }
                }
            });
            
            const llmCallData = { provider: 'openai' };
            const result = await interface.processLLMCall(llmCallData);
            
            const recommendations = result.adaptiveRecommendations.recommendations;
            
            expect(recommendations.length).toBeGreaterThan(0);
            
            const perfRecs = recommendations.filter(r => r.type === 'performance');
            const costRecs = recommendations.filter(r => r.type === 'cost');
            const qualityRecs = recommendations.filter(r => r.type === 'quality');
            const predictiveRecs = recommendations.filter(r => r.type === 'predictive');
            
            expect(perfRecs.length).toBeGreaterThan(0);
            expect(costRecs.length).toBeGreaterThan(0);
            expect(qualityRecs.length).toBeGreaterThan(0);
            expect(predictiveRecs.length).toBeGreaterThan(0);
        });
        
        test('should calculate adaptive score correctly', () => {
            const mockResult = {
                insights: {
                    performanceOptimization: { confidence: 0.2 },
                    costEfficiencyRecommendations: { costEfficiency: 0.8 },
                    qualityImprovements: { confidence: 0.7 },
                    predictiveAnalytics: { confidence: 0.3 }
                }
            };
            
            const score = interface.calculateAdaptiveScore(mockResult);
            
            expect(score).toHaveProperty('overall');
            expect(score).toHaveProperty('components');
            expect(score).toHaveProperty('grade');
            
            expect(score.overall).toBeGreaterThanOrEqual(0);
            expect(score.overall).toBeLessThanOrEqual(1);
            
            expect(score.components).toHaveProperty('performance');
            expect(score.components).toHaveProperty('cost');
            expect(score.components).toHaveProperty('quality');
            expect(score.components).toHaveProperty('predictive');
        });
        
        test('should convert scores to grades correctly', () => {
            expect(interface.scoreToGrade(0.95)).toBe('A+');
            expect(interface.scoreToGrade(0.85)).toBe('A');
            expect(interface.scoreToGrade(0.75)).toBe('B+');
            expect(interface.scoreToGrade(0.65)).toBe('B');
            expect(interface.scoreToGrade(0.55)).toBe('C+');
            expect(interface.scoreToGrade(0.25)).toBe('D');
        });
    });

    describe('Adaptive Model Updates', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should update adaptive model based on call data', async () => {
            const llmCallData = {
                provider: 'openai',
                duration: 2000,
                cost: 0.05,
                inputTokens: 150,
                outputTokens: 100
            };
            
            const initialModel = { ...interface.adaptiveModels.get('openai').baselineMetrics };
            
            const mockNeuromorphicResult = {
                insights: {
                    performanceOptimization: { confidence: 0.8 },
                    costEfficiencyRecommendations: { confidence: 0.7 },
                    qualityImprovements: { confidence: 0.6 }
                }
            };
            
            await interface.updateAdaptiveModel('openai', llmCallData, mockNeuromorphicResult);
            
            const updatedModel = interface.adaptiveModels.get('openai').baselineMetrics;
            
            // Values should have moved towards the new data
            expect(updatedModel.avgLatency).not.toBe(initialModel.avgLatency);
            expect(updatedModel.avgCost).not.toBe(initialModel.avgCost);
        });
        
        test('should normalize adaptive weights after update', async () => {
            const llmCallData = { provider: 'openai', duration: 1000 };
            const mockResult = {
                insights: {
                    performanceOptimization: { confidence: 0.8 },
                    costEfficiencyRecommendations: { confidence: 0.7 },
                    qualityImprovements: { confidence: 0.6 }
                }
            };
            
            await interface.updateAdaptiveModel('openai', llmCallData, mockResult);
            
            const weights = interface.adaptiveModels.get('openai').adaptiveWeights;
            const totalWeight = weights.latency + weights.cost + weights.quality;
            
            expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.001); // Should sum to 1
        });
    });

    describe('Insights Retrieval', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should retrieve LLM insights by call ID', async () => {
            const llmCallData = { id: 'test-call-1', provider: 'openai' };
            await interface.processLLMCall(llmCallData);
            
            const insights = await interface.getLLMInsights('test-call-1');
            
            expect(insights).toBeDefined();
            expect(insights).toHaveProperty('neuromorphicResult');
            expect(insights).toHaveProperty('adaptiveRecommendations');
        });
        
        test('should return undefined for unknown call ID', async () => {
            const insights = await interface.getLLMInsights('unknown-call');
            expect(insights).toBeUndefined();
        });
        
        test('should get provider insights correctly', async () => {
            // Process multiple calls for a provider
            await interface.processLLMCall({ id: 'call-1', provider: 'openai' });
            await interface.processLLMCall({ id: 'call-2', provider: 'openai' });
            await interface.processLLMCall({ id: 'call-3', provider: 'anthropic' });
            
            const openaiInsights = await interface.getProviderInsights('openai', 10);
            
            expect(openaiInsights).toHaveProperty('provider');
            expect(openaiInsights).toHaveProperty('insights');
            expect(openaiInsights).toHaveProperty('adaptiveModel');
            expect(openaiInsights).toHaveProperty('summary');
            
            expect(openaiInsights.provider).toBe('openai');
            expect(openaiInsights.insights.length).toBe(2);
        });
        
        test('should summarize provider insights correctly', () => {
            const mockInsights = [
                {
                    processingTime: 100,
                    adaptiveRecommendations: {
                        adaptiveScore: { overall: 0.8 },
                        recommendations: [
                            { type: 'performance' },
                            { type: 'cost' }
                        ]
                    },
                    timestamp: '2023-01-01T00:00:00.000Z'
                },
                {
                    processingTime: 150,
                    adaptiveRecommendations: {
                        adaptiveScore: { overall: 0.7 },
                        recommendations: [
                            { type: 'performance' },
                            { type: 'quality' }
                        ]
                    },
                    timestamp: '2023-01-01T00:01:00.000Z'
                }
            ];
            
            const summary = interface.summarizeProviderInsights(mockInsights);
            
            expect(summary.avgProcessingTime).toBe(125);
            expect(summary.avgAdaptiveScore).toBe(0.75);
            expect(summary.recommendationTypes.performance).toBe(2);
            expect(summary.recommendationTypes.cost).toBe(1);
            expect(summary.recommendationTypes.quality).toBe(1);
            expect(summary.totalInsights).toBe(2);
        });
    });

    describe('Metrics and Health Monitoring', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should provide neuromorphic metrics', async () => {
            const metrics = await interface.getNeuromorphicMetrics();
            
            expect(metrics).toHaveProperty('photonProcessor');
            expect(metrics).toHaveProperty('interface');
            expect(metrics).toHaveProperty('performance');
            expect(metrics).toHaveProperty('timestamp');
            
            expect(metrics.interface).toHaveProperty('totalLLMCalls');
            expect(metrics.interface).toHaveProperty('queueLength');
            expect(metrics.interface).toHaveProperty('adaptiveModels');
            
            expect(metrics.performance).toHaveProperty('avgInsightGenerationTime');
            expect(metrics.performance).toHaveProperty('adaptiveModelAccuracy');
            expect(metrics.performance).toHaveProperty('neuromorphicEfficiency');
        });
        
        test('should report health status correctly', async () => {
            const health = await interface.getHealth();
            
            expect(health).toHaveProperty('healthy');
            expect(health).toHaveProperty('interface');
            expect(health).toHaveProperty('photonProcessor');
            expect(health).toHaveProperty('metrics');
            
            expect(health.healthy).toBe(true);
            expect(health.interface.initialized).toBe(true);
        });
        
        test('should calculate efficiency metrics', () => {
            // Mock some processing stats
            mockPhotonProcessor.getProcessingStats.mockReturnValue({
                spikesProcessed: 80,
                photonsEmitted: 100
            });
            
            interface.llmCallHistory = [{ id: 'call1' }, { id: 'call2' }];
            interface.neuromorphicInsights.set('call1', {});
            interface.neuromorphicInsights.set('call2', {});
            
            const efficiency = interface.calculateNeuromorphicEfficiency();
            
            expect(efficiency).toBeGreaterThan(0);
            expect(efficiency).toBeLessThanOrEqual(1);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should handle empty insights gracefully', () => {
            const emptyInsights = [];
            const summary = interface.summarizeProviderInsights(emptyInsights);
            
            expect(summary.avgProcessingTime).toBe(0);
            expect(summary.recommendationTypes).toEqual({});
            expect(summary.adaptiveScores).toEqual([]);
        });
        
        test('should handle missing properties in LLM data', async () => {
            const incompleteData = { id: 'incomplete' };
            
            const result = await interface.processLLMCall(incompleteData);
            
            expect(result).toBeDefined();
            expect(interface.llmCallHistory.length).toBe(1);
        });
        
        test('should handle queue processing errors gracefully', async () => {
            const realTimeInterface = new NeuromorphicLLMInterface({
                realTimeProcessing: true
            });
            await realTimeInterface.initialize();
            
            // Mock processing error
            const originalProcessInternal = realTimeInterface.processLLMCallInternal;
            realTimeInterface.processLLMCallInternal = jest.fn().mockRejectedValue(new Error('Processing error'));
            
            // Add item to queue
            realTimeInterface.processingQueue.push({ id: 'error-call' });
            
            // Process queue - should not throw
            await realTimeInterface.processQueue();
            
            // Restore original method
            realTimeInterface.processLLMCallInternal = originalProcessInternal;
            
            await realTimeInterface.shutdown();
        });
        
        test('should handle average calculation with empty arrays', () => {
            const avg = interface.average([]);
            expect(avg).toBe(0);
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            await interface.initialize();
        });
        
        test('should emit llmCallProcessed events', (done) => {
            interface.on('llmCallProcessed', (data) => {
                expect(data).toHaveProperty('callId');
                expect(data).toHaveProperty('insights');
                expect(data).toHaveProperty('neuromorphicActivity');
                done();
            });
            
            interface.processLLMCall({ id: 'test-event-call', provider: 'openai' });
        });
        
        test('should handle neuromorphic activity events', (done) => {
            interface.on('neuromorphicActivity', (data) => {
                expect(data).toHaveProperty('type');
                expect(data).toHaveProperty('data');
                done();
            });
            
            // Simulate photon processor event
            const spikeHandler = mockPhotonProcessor.on.mock.calls
                .find(call => call[0] === 'neuronSpike')[1];
            
            spikeHandler({ neuronId: 'test', timestamp: Date.now() });
        });
    });

    describe('Shutdown and Cleanup', () => {
        test('should shutdown gracefully', async () => {
            await interface.initialize();
            
            expect(interface.initialized).toBe(true);
            
            await interface.shutdown();
            
            expect(interface.initialized).toBe(false);
            expect(interface.llmCallHistory.length).toBe(0);
            expect(interface.processingQueue.length).toBe(0);
            expect(interface.adaptiveModels.size).toBe(0);
            expect(interface.neuromorphicInsights.size).toBe(0);
            expect(mockPhotonProcessor.shutdown).toHaveBeenCalled();
        });
        
        test('should handle shutdown when not initialized', async () => {
            const uninitializedInterface = new NeuromorphicLLMInterface();
            
            // Should not throw error
            await uninitializedInterface.shutdown();
            
            expect(uninitializedInterface.initialized).toBe(false);
        });
    });
});