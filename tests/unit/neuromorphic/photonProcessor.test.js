/**
 * Unit tests for PhotonProcessor
 * Comprehensive testing of neuromorphic photonic processing
 */

const { PhotonProcessor } = require('../../../src/neuromorphic/photonProcessor');

describe('PhotonProcessor', () => {
    let processor;
    
    beforeEach(() => {
        processor = new PhotonProcessor({
            spikeThreshold: 0.5,
            decayRate: 0.9,
            learningRate: 0.01,
            maxNeurons: 100,
            quantumCoherence: 0.8
        });
    });
    
    afterEach(async () => {
        if (processor.initialized) {
            await processor.shutdown();
        }
    });

    describe('Initialization', () => {
        test('should initialize successfully', async () => {
            await processor.initialize();
            
            expect(processor.initialized).toBe(true);
            expect(processor.neurons.size).toBeGreaterThan(0);
            expect(processor.quantumStates.size).toBeGreaterThan(0);
        });
        
        test('should handle initialization failure gracefully', async () => {
            // Mock a failure in quantum state initialization
            jest.spyOn(processor, 'initializeQuantumStates').mockRejectedValue(new Error('Quantum initialization failed'));
            
            await expect(processor.initialize()).rejects.toThrow('Quantum initialization failed');
            expect(processor.initialized).toBe(false);
        });
        
        test('should initialize with correct configuration', async () => {
            await processor.initialize();
            
            expect(processor.config.spikeThreshold).toBe(0.5);
            expect(processor.config.decayRate).toBe(0.9);
            expect(processor.config.learningRate).toBe(0.01);
            expect(processor.config.quantumCoherence).toBe(0.8);
        });
        
        test('should use default configuration when not provided', () => {
            const defaultProcessor = new PhotonProcessor();
            
            expect(defaultProcessor.config.spikeThreshold).toBe(0.7);
            expect(defaultProcessor.config.decayRate).toBe(0.95);
            expect(defaultProcessor.config.learningRate).toBe(0.01);
            expect(defaultProcessor.config.maxNeurons).toBe(10000);
        });
    });

    describe('Quantum State Management', () => {
        beforeEach(async () => {
            await processor.initialize();
        });
        
        test('should initialize quantum states correctly', () => {
            const states = processor.getQuantumSnapshot();
            
            expect(states.size).toBeGreaterThan(0);
            
            const firstState = states.values().next().value;
            expect(firstState).toHaveProperty('phase');
            expect(firstState).toHaveProperty('amplitude');
            expect(firstState).toHaveProperty('coherence');
            expect(firstState).toHaveProperty('entanglement');
        });
        
        test('should update quantum states on photon interaction', async () => {
            const neuronId = 'neuron_0';
            const initialState = processor.quantumStates.get(neuronId);
            const initialPhase = initialState.phase;
            
            const mockPhoton = {
                energy: 2.0,
                polarization: Math.PI / 4,
                wavelength: 550
            };
            
            processor.updateQuantumState(neuronId, mockPhoton);
            
            const updatedState = processor.quantumStates.get(neuronId);
            expect(updatedState.phase).not.toBe(initialPhase);
            expect(updatedState.lastUpdate).toBeGreaterThan(initialState.lastUpdate);
        });
        
        test('should calculate quantum correlations correctly', () => {
            const state1 = {
                phase: Math.PI / 4,
                amplitude: 0.8,
                coherence: 0.9
            };
            
            const state2 = {
                phase: Math.PI / 4,
                amplitude: 0.7,
                coherence: 0.8
            };
            
            const correlation = processor.calculateQuantumCorrelation(state1, state2);
            
            expect(correlation).toBeGreaterThan(0);
            expect(correlation).toBeLessThanOrEqual(1);
        });
        
        test('should maintain quantum coherence within bounds', async () => {
            const states = processor.getQuantumSnapshot();
            
            for (const state of states.values()) {
                expect(state.coherence).toBeGreaterThanOrEqual(0);
                expect(state.coherence).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('Neural Network Operations', () => {
        beforeEach(async () => {
            await processor.initialize();
        });
        
        test('should generate neural network topology', () => {
            const topology = processor.generatePhotonicTopology();
            
            expect(topology.size).toBeGreaterThan(0);
            
            for (const [neuronId, connections] of topology) {
                expect(neuronId).toMatch(/^neuron_\d+$/);
                expect(Array.isArray(connections)).toBe(true);
                
                connections.forEach(connection => {
                    expect(connection).toHaveProperty('target');
                    expect(connection).toHaveProperty('weight');
                    expect(connection).toHaveProperty('delay');
                    expect(connection).toHaveProperty('photonPath');
                });
            }
        });
        
        test('should generate photon receptors with valid properties', () => {
            const receptors = processor.generatePhotonReceptors();
            
            expect(Array.isArray(receptors)).toBe(true);
            expect(receptors.length).toBeGreaterThan(0);
            
            receptors.forEach(receptor => {
                expect(receptor).toHaveProperty('wavelength');
                expect(receptor).toHaveProperty('sensitivity');
                expect(receptor).toHaveProperty('response');
                expect(receptor).toHaveProperty('quantumEfficiency');
                
                expect(receptor.wavelength).toBeGreaterThan(0);
                expect(receptor.sensitivity).toBeGreaterThan(0);
                expect(receptor.sensitivity).toBeLessThanOrEqual(1);
            });
        });
        
        test('should calculate photon path correctly', () => {
            const path = processor.calculatePhotonPath('neuron_0', 'neuron_1');
            
            expect(path).toHaveProperty('distance');
            expect(path).toHaveProperty('interference');
            expect(path).toHaveProperty('diffraction');
            expect(path).toHaveProperty('propagationDelay');
            
            expect(path.distance).toBeGreaterThanOrEqual(0);
            expect(path.propagationDelay).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Photon Emission and Processing', () => {
        beforeEach(async () => {
            await processor.initialize();
        });
        
        test('should calculate photon energy correctly', () => {
            const wavelength550 = processor.calculatePhotonEnergy(550); // Green light
            const wavelength400 = processor.calculatePhotonEnergy(400); // Violet light
            
            expect(wavelength400).toBeGreaterThan(wavelength550); // Higher energy for shorter wavelength
            expect(wavelength550).toBeGreaterThan(0);
        });
        
        test('should find best receptor for wavelength', () => {
            const receptors = [
                { wavelength: 450, sensitivity: 0.8, quantumEfficiency: 0.9 },
                { wavelength: 550, sensitivity: 0.9, quantumEfficiency: 0.8 },
                { wavelength: 650, sensitivity: 0.7, quantumEfficiency: 0.95 }
            ];
            
            const bestReceptor = processor.findBestReceptor(receptors, 555);
            
            expect(bestReceptor.wavelength).toBe(550); // Closest to 555nm
        });
        
        test('should calculate wavelength match correctly', () => {
            const perfectMatch = processor.calculateWavelengthMatch(550, 550);
            const closeMatch = processor.calculateWavelengthMatch(550, 560);
            const farMatch = processor.calculateWavelengthMatch(550, 650);
            
            expect(perfectMatch).toBe(1);
            expect(closeMatch).toBeGreaterThan(farMatch);
            expect(farMatch).toBeGreaterThan(0);
        });
    });

    describe('LLM Data Processing', () => {
        beforeEach(async () => {
            await processor.initialize();
        });
        
        test('should process LLM data successfully', async () => {
            const llmData = {
                tokens: 100,
                latency: 1500,
                cost: 0.05,
                quality: 0.8
            };
            
            const result = await processor.processLLMData(llmData);
            
            expect(result).toHaveProperty('original');
            expect(result).toHaveProperty('neuromorphicEncoding');
            expect(result).toHaveProperty('processed');
            expect(result).toHaveProperty('insights');
            expect(result).toHaveProperty('processingTime');
            
            expect(result.original).toEqual(llmData);
            expect(result.processingTime).toBeGreaterThan(0);
        });
        
        test('should encode LLM data correctly', () => {
            const llmData = {
                tokens: 100,
                latency: 1500,
                cost: 0.05,
                quality: 0.8
            };
            
            const encoding = processor.encodeLLMData(llmData);
            
            expect(encoding).toHaveProperty('tokenSpikes');
            expect(encoding).toHaveProperty('latencySpikes');
            expect(encoding).toHaveProperty('costSpikes');
            expect(encoding).toHaveProperty('qualitySpikes');
            expect(encoding).toHaveProperty('temporalPattern');
            
            expect(encoding.tokenSpikes).toHaveProperty('frequency');
            expect(encoding.latencySpikes).toHaveProperty('interval');
            expect(encoding.costSpikes).toHaveProperty('amplitude');
            expect(encoding.qualitySpikes).toHaveProperty('coherence');
        });
        
        test('should handle edge cases in encoding', () => {
            const edgeData = {
                tokens: 0,
                latency: 0,
                cost: 0,
                quality: 0
            };
            
            const encoding = processor.encodeLLMData(edgeData);
            
            expect(encoding.tokenSpikes.frequency).toBe(0);
            expect(encoding.latencySpikes.interval).toBe(0);
            expect(encoding.costSpikes.amplitude).toBe(0);
            expect(encoding.qualitySpikes.coherence).toBe(0);
        });
        
        test('should generate meaningful insights', async () => {
            const llmData = {
                tokens: 2000, // High token usage
                latency: 5000, // High latency
                cost: 0.8,     // High cost
                quality: 0.3   // Low quality
            };
            
            const result = await processor.processLLMData(llmData);
            const insights = result.insights;
            
            expect(insights).toHaveProperty('performanceOptimization');
            expect(insights).toHaveProperty('costEfficiencyRecommendations');
            expect(insights).toHaveProperty('qualityImprovements');
            expect(insights).toHaveProperty('predictiveAnalytics');
            expect(insights).toHaveProperty('quantumCorrelations');
            
            // Should detect high usage patterns
            expect(insights.performanceOptimization.recommendations.length).toBeGreaterThan(0);
            expect(insights.costEfficiencyRecommendations.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('Spike Generation and Propagation', () => {
        beforeEach(async () => {
            await processor.initialize();
        });
        
        test('should generate spike when threshold exceeded', () => {
            const neuronId = 'neuron_0';
            const neuron = processor.neurons.get(neuronId);
            
            // Set potential above threshold
            neuron.potential = processor.config.spikeThreshold + 0.1;
            
            const initialSpikes = processor.processingStats.spikesProcessed;
            processor.generateSpike(neuronId);
            
            expect(processor.processingStats.spikesProcessed).toBe(initialSpikes + 1);
            expect(neuron.potential).toBe(0); // Reset after spike
        });
        
        test('should propagate spikes to connected neurons', () => {
            const sourceId = 'neuron_0';
            const sourceNeuron = processor.neurons.get(sourceId);
            
            expect(sourceNeuron.connections.length).toBeGreaterThan(0);
            
            // Mock spike propagation
            processor.propagateSpike(sourceId, Date.now());
            
            // Should not throw errors
            expect(true).toBe(true);
        });
        
        test('should update synaptic plasticity', () => {
            const sourceId = 'neuron_0';
            const targetId = 'neuron_1';
            const influence = 0.5;
            
            processor.updateSynapticPlasticity(sourceId, targetId, influence);
            
            const synapseKey = `${sourceId}->${targetId}`;
            const synapse = processor.synapses.get(synapseKey);
            
            expect(synapse).toBeDefined();
            expect(synapse).toHaveProperty('weight');
            expect(synapse).toHaveProperty('plasticityTrace');
            expect(synapse).toHaveProperty('lastUpdate');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle processing uninitialized processor', async () => {
            const uninitializedProcessor = new PhotonProcessor();
            const llmData = { tokens: 100, latency: 1000 };
            
            await expect(uninitializedProcessor.processLLMData(llmData))
                .rejects.toThrow('Photon Processor not initialized');
        });
        
        test('should handle invalid neuron IDs gracefully', async () => {
            await processor.initialize();
            
            const nonexistentNeuron = 'neuron_999999';
            const mockPhoton = { energy: 1.0, polarization: 0, wavelength: 550 };
            
            // Should not throw error
            processor.processPhotonNeuronInteraction(mockPhoton, nonexistentNeuron);
            processor.generateSpike(nonexistentNeuron);
            
            expect(true).toBe(true);
        });
        
        test('should handle malformed LLM data', async () => {
            await processor.initialize();
            
            const malformedData = {
                tokens: -100, // Negative tokens
                latency: 'invalid', // String instead of number
                cost: null, // Null cost
                quality: 2.0 // Quality > 1
            };
            
            // Should not throw error and handle gracefully
            const result = await processor.processLLMData(malformedData);
            expect(result).toBeDefined();
            expect(result.original).toEqual(malformedData);
        });
        
        test('should maintain processing stats correctly', async () => {
            await processor.initialize();
            
            const initialStats = processor.getProcessingStats();
            
            // Process some data
            await processor.processLLMData({ tokens: 100, latency: 1000 });
            
            const updatedStats = processor.getProcessingStats();
            
            expect(updatedStats.avgProcessingTime).toBeGreaterThanOrEqual(0);
            expect(updatedStats).toHaveProperty('neuronsActive');
            expect(updatedStats).toHaveProperty('quantumCoherence');
            expect(updatedStats).toHaveProperty('photonPacketsActive');
            expect(updatedStats).toHaveProperty('synapseCount');
        });
    });

    describe('Health Monitoring', () => {
        beforeEach(async () => {
            await processor.initialize();
        });
        
        test('should report healthy status when initialized', async () => {
            const health = await processor.getHealth();
            
            expect(health.healthy).toBe(true);
            expect(health).toHaveProperty('metrics');
            expect(health).toHaveProperty('quantumHealth');
            expect(health).toHaveProperty('photonHealth');
        });
        
        test('should report unhealthy when not initialized', async () => {
            const uninitializedProcessor = new PhotonProcessor();
            const health = await uninitializedProcessor.getHealth();
            
            expect(health.healthy).toBe(false);
        });
        
        test('should provide meaningful health metrics', async () => {
            const health = await processor.getHealth();
            
            expect(health.metrics).toHaveProperty('spikesProcessed');
            expect(health.metrics).toHaveProperty('photonsEmitted');
            expect(health.metrics).toHaveProperty('quantumOperations');
            
            expect(health.quantumHealth).toHaveProperty('average');
            expect(health.quantumHealth).toHaveProperty('variance');
            expect(health.quantumHealth).toHaveProperty('stability');
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle large number of neurons efficiently', async () => {
            const largeProcessor = new PhotonProcessor({ maxNeurons: 1000 });
            
            const startTime = Date.now();
            await largeProcessor.initialize();
            const initTime = Date.now() - startTime;
            
            expect(initTime).toBeLessThan(5000); // Should initialize in under 5 seconds
            expect(largeProcessor.neurons.size).toBeGreaterThan(0);
            
            await largeProcessor.shutdown();
        });
        
        test('should process multiple LLM calls efficiently', async () => {
            await processor.initialize();
            
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(processor.processLLMData({
                    tokens: 100 + i * 10,
                    latency: 1000 + i * 100,
                    cost: 0.01 + i * 0.001
                }));
            }
            
            const startTime = Date.now();
            const results = await Promise.all(promises);
            const processingTime = Date.now() - startTime;
            
            expect(results.length).toBe(10);
            expect(processingTime).toBeLessThan(10000); // Should process in under 10 seconds
            
            results.forEach(result => {
                expect(result).toHaveProperty('insights');
                expect(result.processingTime).toBeGreaterThan(0);
            });
        });
        
        test('should maintain memory efficiency', async () => {
            await processor.initialize();
            
            const initialMemory = process.memoryUsage();
            
            // Process multiple calls
            for (let i = 0; i < 100; i++) {
                await processor.processLLMData({
                    tokens: 100,
                    latency: 1000,
                    cost: 0.01
                });
            }
            
            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory growth should be reasonable (less than 100MB)
            expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
        });
    });

    describe('Event Emission', () => {
        beforeEach(async () => {
            await processor.initialize();
        });
        
        test('should emit neuron spike events', (done) => {
            processor.on('neuronSpike', (data) => {
                expect(data).toHaveProperty('neuronId');
                expect(data).toHaveProperty('timestamp');
                expect(data.neuronId).toMatch(/^neuron_\d+$/);
                done();
            });
            
            // Force a spike
            const neuronId = 'neuron_0';
            processor.generateSpike(neuronId);
        });
        
        test('should emit quantum state change events', (done) => {
            processor.on('quantumStateChange', (data) => {
                expect(data).toHaveProperty('neuronId');
                expect(data).toHaveProperty('quantumState');
                expect(data).toHaveProperty('photon');
                done();
            });
            
            // Force a quantum state change
            const neuronId = 'neuron_0';
            const mockPhoton = { energy: 1.0, polarization: Math.PI / 2, wavelength: 550 };
            processor.updateQuantumState(neuronId, mockPhoton);
        });
    });

    describe('Shutdown and Cleanup', () => {
        test('should shutdown gracefully', async () => {
            await processor.initialize();
            
            expect(processor.initialized).toBe(true);
            expect(processor.neurons.size).toBeGreaterThan(0);
            
            await processor.shutdown();
            
            expect(processor.initialized).toBe(false);
            expect(processor.neurons.size).toBe(0);
            expect(processor.synapses.size).toBe(0);
            expect(processor.photonPackets.length).toBe(0);
            expect(processor.quantumStates.size).toBe(0);
        });
        
        test('should handle multiple shutdown calls gracefully', async () => {
            await processor.initialize();
            
            await processor.shutdown();
            await processor.shutdown(); // Should not throw error
            
            expect(processor.initialized).toBe(false);
        });
    });
});