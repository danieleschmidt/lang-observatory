/**
 * Load and Performance Tests
 * Test system performance under various load conditions
 */

const { LangObservatory } = require('../../src/index');
const { WorkloadBalancer } = require('../../src/concurrency/workloadBalancer');
const { DistributedCache } = require('../../src/performance/distributedCache');
const { ResourcePooler } = require('../../src/optimization/resourcePooler');

describe('Load and Performance Tests', () => {
    let observatory;
    let workloadBalancer;
    let distributedCache;
    let resourcePooler;

    beforeAll(async () => {
        // Initialize with performance-optimized config
        observatory = new LangObservatory({
            langfuse: { enabled: false },
            openlit: { enabled: false },
            metrics: { enabled: false },
            performance: { enableOptimization: true },
            reliability: { enableCircuitBreaker: true }
        });

        workloadBalancer = new WorkloadBalancer({
            algorithm: 'adaptive',
            maxConcurrentRequests: 1000,
            requestTimeout: 5000
        });

        distributedCache = new DistributedCache({
            maxMemoryUsage: 128 * 1024 * 1024, // 128MB
            maxKeys: 10000,
            enableCompression: true
        });

        // Mock resource factory for testing
        resourcePooler = new ResourcePooler({
            minPoolSize: 5,
            maxPoolSize: 20,
            resourceFactory: async () => ({
                id: Math.random().toString(36),
                query: async () => ({ result: 'test data' }),
                close: async () => {}
            }),
            resourceValidator: (resource) => resource && !resource.destroyed
        });

        await Promise.all([
            observatory.initialize(),
            workloadBalancer.initialize(),
            distributedCache.initialize(),
            resourcePooler.initialize()
        ]);
    });

    afterAll(async () => {
        await Promise.all([
            observatory?.shutdown(),
            workloadBalancer?.shutdown(),
            distributedCache?.shutdown(),
            resourcePooler?.destroy()
        ]);
    });

    describe('Observatory Core Performance', () => {
        test('should handle concurrent LLM call recording', async () => {
            const startTime = Date.now();
            const concurrentCalls = 50;
            const promises = [];

            for (let i = 0; i < concurrentCalls; i++) {
                promises.push(
                    observatory.recordLLMCall(
                        'test-provider',
                        'test-model',
                        `Input ${i}`,
                        `Output ${i}`,
                        { testId: i }
                    )
                );
            }

            const results = await Promise.allSettled(promises);
            const duration = Date.now() - startTime;

            // All calls should succeed
            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBe(concurrentCalls);

            // Performance expectations
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
            console.log(`Processed ${concurrentCalls} LLM calls in ${duration}ms`);
        });

        test('should maintain performance with task planning', async () => {
            const tasks = Array.from({ length: 20 }, (_, i) => ({
                id: `task-${i}`,
                priority: Math.random(),
                estimatedDuration: Math.floor(Math.random() * 1000) + 100
            }));

            const startTime = Date.now();
            const plan = await observatory.planTasks(tasks, { maxParallelism: 5 });
            const planningTime = Date.now() - startTime;

            expect(plan.quantumPlan).toBeDefined();
            expect(plan.adaptiveSchedules).toBeDefined();
            expect(planningTime).toBeLessThan(2000); // Planning should be fast

            console.log(`Planned ${tasks.length} tasks in ${planningTime}ms`);
        });

        test('should handle rapid health checks', async () => {
            const startTime = Date.now();
            const healthPromises = [];

            // Simulate rapid health checks
            for (let i = 0; i < 10; i++) {
                healthPromises.push(observatory.getHealthStatus());
            }

            const results = await Promise.allSettled(healthPromises);
            const duration = Date.now() - startTime;

            expect(results.every(r => r.status === 'fulfilled')).toBe(true);
            expect(duration).toBeLessThan(1000); // Should be very fast

            console.log(`Performed 10 health checks in ${duration}ms`);
        });
    });

    describe('Workload Balancer Performance', () => {
        beforeAll(async () => {
            // Add test workers
            for (let i = 1; i <= 5; i++) {
                await workloadBalancer.addWorker(`worker-${i}`, {
                    weight: 1,
                    maxConcurrent: 20,
                    handler: async (request) => {
                        // Simulate work with random delay
                        const delay = Math.random() * 50 + 10;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return { workerId: `worker-${i}`, processed: request };
                    }
                });
            }
        });

        test('should distribute load evenly across workers', async () => {
            const requests = Array.from({ length: 100 }, (_, i) => ({
                id: `request-${i}`,
                data: `test data ${i}`
            }));

            const startTime = Date.now();
            const promises = requests.map(request => 
                workloadBalancer.processRequest(request, { retryCount: 0 })
            );

            const results = await Promise.allSettled(promises);
            const duration = Date.now() - startTime;

            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBeGreaterThan(90); // Allow some failures

            // Check load distribution
            const workerStats = workloadBalancer.getWorkerStats();
            const workerRequests = Object.values(workerStats).map(s => s.totalRequests);
            const maxRequests = Math.max(...workerRequests);
            const minRequests = Math.min(...workerRequests);
            
            // Load should be reasonably distributed (within 50% of each other)
            expect(maxRequests - minRequests).toBeLessThan(maxRequests * 0.5);

            console.log(`Processed 100 requests across 5 workers in ${duration}ms`);
            console.log('Worker distribution:', workerRequests);
        });

        test('should handle worker failures gracefully', async () => {
            // Add a failing worker
            await workloadBalancer.addWorker('failing-worker', {
                handler: async () => {
                    throw new Error('Worker failure simulation');
                }
            });

            const requests = Array.from({ length: 20 }, (_, i) => ({
                id: `request-${i}`,
                data: `test data ${i}`
            }));

            const results = await Promise.allSettled(
                requests.map(request => 
                    workloadBalancer.processRequest(request, { retryCount: 2 })
                )
            );

            // Most requests should still succeed through other workers
            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBeGreaterThan(15);
        });
    });

    describe('Distributed Cache Performance', () => {
        test('should handle high cache throughput', async () => {
            const operations = 1000;
            const keys = Array.from({ length: operations }, (_, i) => `key-${i}`);
            const values = keys.map(key => ({ key, data: `value for ${key}`, timestamp: Date.now() }));

            // Test write performance
            const writeStart = Date.now();
            const writePromises = keys.map((key, i) => 
                distributedCache.set(key, values[i], { ttl: 60000 })
            );
            await Promise.allSettled(writePromises);
            const writeTime = Date.now() - writeStart;

            // Test read performance
            const readStart = Date.now();
            const readPromises = keys.map(key => distributedCache.get(key));
            const readResults = await Promise.allSettled(readPromises);
            const readTime = Date.now() - readStart;

            const successfulReads = readResults.filter(r => 
                r.status === 'fulfilled' && r.value !== undefined
            );

            expect(successfulReads.length).toBeGreaterThan(operations * 0.95); // 95% hit rate
            expect(writeTime).toBeLessThan(operations * 2); // < 2ms per write
            expect(readTime).toBeLessThan(operations); // < 1ms per read

            console.log(`Cache: ${operations} writes in ${writeTime}ms, ${operations} reads in ${readTime}ms`);
            console.log(`Hit rate: ${(successfulReads.length / operations * 100).toFixed(1)}%`);
        });

        test('should maintain performance under memory pressure', async () => {
            // Fill cache to near capacity
            const largeCacheOperations = [];
            for (let i = 0; i < 1000; i++) {
                const largeValue = 'x'.repeat(1000); // 1KB per entry
                largeCacheOperations.push(
                    distributedCache.set(`large-key-${i}`, largeValue)
                );
            }

            await Promise.allSettled(largeCacheOperations);

            // Test performance with full cache
            const startTime = Date.now();
            const testOperations = [];
            
            for (let i = 0; i < 100; i++) {
                testOperations.push(distributedCache.get(`large-key-${i}`));
                testOperations.push(distributedCache.set(`new-key-${i}`, `new-value-${i}`));
            }

            await Promise.allSettled(testOperations);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(1000); // Should still be fast under pressure
            console.log(`Cache operations under memory pressure: ${duration}ms`);
        });

        test('should demonstrate cache hit rate improvement', async () => {
            const testKeys = Array.from({ length: 100 }, (_, i) => `popular-key-${i % 20}`); // 20 unique keys, repeated
            
            // First pass - populate cache
            const firstPassPromises = testKeys.map(key => 
                distributedCache.set(key, `value-${key}`)
            );
            await Promise.allSettled(firstPassPromises);

            // Second pass - should hit cache
            const startTime = Date.now();
            const secondPassPromises = testKeys.map(key => distributedCache.get(key));
            const results = await Promise.allSettled(secondPassPromises);
            const duration = Date.now() - startTime;

            const hits = results.filter(r => r.status === 'fulfilled' && r.value).length;
            const hitRate = hits / testKeys.length;

            expect(hitRate).toBeGreaterThan(0.9); // > 90% hit rate
            expect(duration).toBeLessThan(200); // Fast cache hits

            console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%, duration: ${duration}ms`);
        });
    });

    describe('Resource Pool Performance', () => {
        test('should handle concurrent resource acquisition', async () => {
            const concurrentAcquisitions = 50;
            const acquisitionPromises = [];

            const startTime = Date.now();

            for (let i = 0; i < concurrentAcquisitions; i++) {
                acquisitionPromises.push(
                    (async () => {
                        const resource = await resourcePooler.acquire();
                        expect(resource).toBeDefined();
                        
                        // Simulate work
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                        
                        await resourcePooler.release(resource);
                        return resource;
                    })()
                );
            }

            const results = await Promise.allSettled(acquisitionPromises);
            const duration = Date.now() - startTime;

            const successful = results.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBe(concurrentAcquisitions);
            
            // Should handle concurrent load efficiently
            expect(duration).toBeLessThan(5000);

            const stats = resourcePooler.getStats();
            console.log(`Resource pool handled ${concurrentAcquisitions} concurrent acquisitions in ${duration}ms`);
            console.log(`Pool utilization: ${(stats.utilization * 100).toFixed(1)}%, efficiency: ${(stats.efficiency * 100).toFixed(1)}%`);
        });

        test('should scale pool size dynamically', async () => {
            const initialStats = resourcePooler.getStats();
            const initialSize = initialStats.currentSize;

            // Create sustained load to trigger scaling
            const sustainedLoad = Array.from({ length: 30 }, async (_, i) => {
                const resource = await resourcePooler.acquire(10000); // 10s timeout
                
                // Hold resource for longer to increase utilization
                await new Promise(resolve => setTimeout(resolve, 200));
                
                await resourcePooler.release(resource);
            });

            await Promise.allSettled(sustainedLoad);

            // Allow time for scaling decisions
            await new Promise(resolve => setTimeout(resolve, 1000));

            const finalStats = resourcePooler.getStats();
            
            console.log(`Pool scaling: ${initialSize} -> ${finalStats.currentSize} resources`);
            console.log(`Final utilization: ${(finalStats.utilization * 100).toFixed(1)}%`);
            
            // Pool should have adapted to load
            expect(finalStats.currentSize).toBeGreaterThanOrEqual(initialSize);
        });

        test('should maintain resource health', async () => {
            // Get initial healthy resources
            const resource1 = await resourcePooler.acquire();
            const resource2 = await resourcePooler.acquire();
            
            expect(resource1).toBeDefined();
            expect(resource2).toBeDefined();
            expect(resource1.id).not.toBe(resource2.id);

            // Release resources
            await resourcePooler.release(resource1);
            await resourcePooler.release(resource2);

            // Acquire again - should get healthy resources
            const resource3 = await resourcePooler.acquire();
            const resource4 = await resourcePooler.acquire();
            
            expect(resource3).toBeDefined();
            expect(resource4).toBeDefined();

            await resourcePooler.release(resource3);
            await resourcePooler.release(resource4);

            const stats = resourcePooler.getDetailedStats();
            console.log(`Resource pool health: ${stats.resources.available.length} available, ${stats.resources.inUse.length} in use`);
        });
    });

    describe('End-to-End Performance', () => {
        test('should maintain performance under mixed workload', async () => {
            const startTime = Date.now();
            const mixedWorkload = [];

            // LLM calls
            for (let i = 0; i < 20; i++) {
                mixedWorkload.push(
                    observatory.recordLLMCall(
                        'mixed-provider',
                        'mixed-model',
                        `Mixed input ${i}`,
                        `Mixed output ${i}`
                    )
                );
            }

            // Cache operations
            for (let i = 0; i < 50; i++) {
                mixedWorkload.push(
                    distributedCache.set(`mixed-key-${i}`, `mixed-value-${i}`)
                );
            }

            // Resource pool operations
            for (let i = 0; i < 30; i++) {
                mixedWorkload.push(
                    (async () => {
                        const resource = await resourcePooler.acquire();
                        await new Promise(resolve => setTimeout(resolve, 50));
                        await resourcePooler.release(resource);
                    })()
                );
            }

            // Task planning
            mixedWorkload.push(
                observatory.planTasks([
                    { id: 'mixed-task-1', priority: 0.8, estimatedDuration: 100 },
                    { id: 'mixed-task-2', priority: 0.6, estimatedDuration: 200 },
                    { id: 'mixed-task-3', priority: 0.9, estimatedDuration: 150 }
                ])
            );

            const results = await Promise.allSettled(mixedWorkload);
            const duration = Date.now() - startTime;

            const successful = results.filter(r => r.status === 'fulfilled');
            const successRate = successful.length / results.length;

            expect(successRate).toBeGreaterThan(0.95); // 95% success rate
            expect(duration).toBeLessThan(10000); // Complete within 10 seconds

            console.log(`Mixed workload: ${results.length} operations, ${(successRate * 100).toFixed(1)}% success rate, ${duration}ms duration`);
        });

        test('should demonstrate system resilience under failure conditions', async () => {
            // Simulate some system stress
            const stressOperations = [];
            
            // Create memory pressure
            for (let i = 0; i < 100; i++) {
                stressOperations.push(
                    distributedCache.set(`stress-key-${i}`, 'x'.repeat(10000))
                );
            }

            // Create resource pool pressure
            const resources = [];
            for (let i = 0; i < 15; i++) {
                try {
                    const resource = await resourcePooler.acquire(1000);
                    resources.push(resource);
                } catch (error) {
                    // Some may timeout under pressure
                }
            }

            // System should still function
            const healthStatus = await observatory.getHealthStatus();
            expect(healthStatus.status).toMatch(/healthy|degraded/);

            // Clean up
            for (const resource of resources) {
                await resourcePooler.release(resource);
            }

            console.log(`System resilience test - Health status: ${healthStatus.status}`);
        });
    });
});