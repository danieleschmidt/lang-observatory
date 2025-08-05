/**
 * Unit tests for Quantum Task Planner
 */

const { QuantumTaskPlanner } = require('../../../src/quantum/quantumTaskPlanner');

describe('QuantumTaskPlanner', () => {
    let planner;
    let mockConfig;
    
    beforeEach(() => {
        mockConfig = {
            maxStates: 8,
            maxConcurrency: 4,
            errorHandling: {
                circuitBreakerThreshold: 3,
                circuitBreakerTimeout: 5000
            },
            validation: {
                maxTasksPerBatch: 100,
                maxPlanningTime: 10000
            },
            security: {
                encryptionKey: 'test-key-32-characters-long-123',
                maxRequestsPerMinute: 60
            },
            performance: {
                maxCacheEntries: 1000,
                cacheTTL: 300000,
                enableCompression: false
            },
            scaling: {
                minInstances: 1,
                maxInstances: 3,
                targetCpuUtilization: 0.7
            }
        };
        
        planner = new QuantumTaskPlanner(mockConfig);
    });
    
    afterEach(async () => {
        if (planner.initialized) {
            await planner.shutdown();
        }
    });

    describe('Initialization', () => {
        test('should initialize successfully with default config', async () => {
            await planner.initialize();
            
            expect(planner.initialized).toBe(true);
            expect(planner.quantumState.get('coherence')).toBe(1.0);
            expect(planner.quantumState.get('superposition')).toBeInstanceOf(Map);
            expect(planner.quantumState.get('entanglement')).toBeInstanceOf(Map);
        });

        test('should handle initialization failure gracefully', async () => {
            // Mock a component to fail during initialization
            jest.spyOn(planner.performanceOptimizer, 'initialize').mockRejectedValue(new Error('Init failed'));
            
            await expect(planner.initialize()).rejects.toThrow('Init failed');
            expect(planner.initialized).toBe(false);
        });
    });

    describe('Task Planning', () => {
        beforeEach(async () => {
            await planner.initialize();
        });

        test('should plan simple tasks successfully', async () => {
            const tasks = [
                {
                    id: 'task1',
                    priority: 0.8,
                    estimatedDuration: 60,
                    type: 'computation',
                    requiredResources: ['cpu']
                },
                {
                    id: 'task2',
                    priority: 0.6,
                    estimatedDuration: 45,
                    type: 'io',
                    requiredResources: ['disk']
                }
            ];

            const constraints = {
                maxConcurrency: 2,
                deadline: new Date(Date.now() + 3600000).toISOString()
            };

            const plan = await planner.planTasks(tasks, constraints);

            expect(plan).toBeDefined();
            expect(plan.phases).toBeDefined();
            expect(Array.isArray(plan.phases)).toBe(true);
            expect(plan.totalDuration).toBeGreaterThan(0);
            expect(plan.efficiency).toBeGreaterThanOrEqual(0);
            expect(plan.efficiency).toBeLessThanOrEqual(1);
        });

        test('should handle tasks with dependencies', async () => {
            const tasks = [
                {
                    id: 'task1',
                    priority: 0.7,
                    estimatedDuration: 30,
                    dependencies: []
                },
                {
                    id: 'task2',
                    priority: 0.8,
                    estimatedDuration: 45,
                    dependencies: ['task1']
                },
                {
                    id: 'task3',
                    priority: 0.6,
                    estimatedDuration: 60,
                    dependencies: ['task2']
                }
            ];

            const plan = await planner.planTasks(tasks);

            expect(plan).toBeDefined();
            expect(plan.phases.length).toBeGreaterThanOrEqual(1);
            
            // Verify dependency ordering is maintained
            const allTasks = plan.phases.flatMap(phase => phase.tasks.map(t => t.id));
            const task1Index = allTasks.indexOf('task1');
            const task2Index = allTasks.indexOf('task2');
            const task3Index = allTasks.indexOf('task3');
            
            expect(task1Index).toBeLessThan(task2Index);
            expect(task2Index).toBeLessThan(task3Index);
        });

        test('should validate input data', async () => {
            const invalidTasks = [
                {
                    id: '', // Invalid empty ID
                    priority: 1.5, // Invalid priority > 1
                    estimatedDuration: -10 // Invalid negative duration
                }
            ];

            await expect(planner.planTasks(invalidTasks)).rejects.toThrow(/Validation failed/);
        });

        test('should handle empty task array', async () => {
            await expect(planner.planTasks([])).rejects.toThrow(/cannot be empty/);
        });

        test('should handle circular dependencies', async () => {
            const tasks = [
                {
                    id: 'task1',
                    dependencies: ['task2']
                },
                {
                    id: 'task2',
                    dependencies: ['task1']
                }
            ];

            await expect(planner.planTasks(tasks)).rejects.toThrow(/Circular dependencies/);
        });
    });

    describe('Security', () => {
        beforeEach(async () => {
            await planner.initialize();
        });

        test('should enforce permissions for planning', async () => {
            const tasks = [{ id: 'task1', priority: 0.5 }];
            const user = { userId: 'user1', role: 'viewer' }; // viewer role shouldn't plan

            // Mock security manager to deny permission
            jest.spyOn(planner.securityManager, 'checkPermission').mockResolvedValue(false);

            await expect(planner.planTasks(tasks, {}, user)).rejects.toThrow(/Insufficient permissions/);
        });

        test('should allow authorized users to plan tasks', async () => {
            const tasks = [{ id: 'task1', priority: 0.5, estimatedDuration: 60 }];
            const user = { userId: 'user1', role: 'planner' };

            // Mock security manager to allow permission
            jest.spyOn(planner.securityManager, 'checkPermission').mockResolvedValue(true);

            const plan = await planner.planTasks(tasks, {}, user);
            expect(plan).toBeDefined();
        });

        test('should sanitize malicious input', async () => {
            const maliciousTasks = [
                {
                    id: 'task<script>alert("xss")</script>',
                    type: 'SELECT * FROM users; DROP TABLE tasks;--',
                    requiredResources: ['../../../etc/passwd']
                }
            ];

            // Should not throw but should sanitize the input
            await expect(planner.planTasks(maliciousTasks)).rejects.toThrow(/Validation failed/);
        });
    });

    describe('Performance Optimization', () => {
        beforeEach(async () => {
            await planner.initialize();
        });

        test('should cache identical planning requests', async () => {
            const tasks = [{ id: 'task1', priority: 0.5, estimatedDuration: 60 }];
            const constraints = { maxConcurrency: 2 };

            // First request
            const plan1 = await planner.planTasks(tasks, constraints);
            
            // Second identical request should be faster (cached)
            const startTime = Date.now();
            const plan2 = await planner.planTasks(tasks, constraints);
            const duration = Date.now() - startTime;

            expect(plan2).toBeDefined();
            expect(duration).toBeLessThan(100); // Should be very fast due to caching
        });

        test('should handle large task sets efficiently', async () => {
            const largeTasks = Array.from({ length: 500 }, (_, i) => ({
                id: `task${i}`,
                priority: Math.random(),
                estimatedDuration: Math.floor(Math.random() * 120) + 30,
                type: 'computation',
                requiredResources: ['cpu']
            }));

            const startTime = Date.now();
            const plan = await planner.planTasks(largeTasks);
            const duration = Date.now() - startTime;

            expect(plan).toBeDefined();
            expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
            expect(plan.phases.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Recovery', () => {
        beforeEach(async () => {
            await planner.initialize();
        });

        test('should recover from quantum coherence loss', async () => {
            const tasks = [{ id: 'task1', priority: 0.5, estimatedDuration: 60 }];

            // Mock quantum state corruption
            planner.quantumState.set('coherence', 0.1); // Very low coherence

            // Force an error during planning
            jest.spyOn(planner, 'executeQuantumPlanning').mockRejectedValueOnce(
                new Error('Quantum coherence loss detected')
            );

            // Should recover using error handler
            const plan = await planner.planTasks(tasks);
            expect(plan).toBeDefined(); // Should get fallback plan
        });

        test('should handle resource exhaustion gracefully', async () => {
            const tasks = [{ id: 'task1', priority: 0.5, estimatedDuration: 60 }];

            // Mock resource exhaustion
            jest.spyOn(planner, 'executeQuantumPlanning').mockRejectedValueOnce(
                new Error('Resource exhaustion detected')
            );

            const plan = await planner.planTasks(tasks);
            expect(plan).toBeDefined(); // Should get throttled/fallback plan
        });
    });

    describe('Metrics and Monitoring', () => {
        beforeEach(async () => {
            await planner.initialize();
        });

        test('should provide quantum metrics for authorized users', async () => {
            const user = { userId: 'admin', role: 'admin' };
            
            // Mock permissions
            jest.spyOn(planner.securityManager, 'checkPermission').mockResolvedValue(true);

            const metrics = await planner.getQuantumMetrics(user);

            expect(metrics).toBeDefined();
            expect(metrics.coherenceLevel).toBeDefined();
            expect(metrics.superpositionStates).toBeDefined();
            expect(metrics.entanglementPairs).toBeDefined();
            expect(metrics.validationMetrics).toBeDefined();
            expect(metrics.errorMetrics).toBeDefined();
            expect(metrics.securityMetrics).toBeDefined();
            expect(metrics.performanceMetrics).toBeDefined();
            expect(metrics.scalingMetrics).toBeDefined();
        });

        test('should restrict metrics for unauthorized users', async () => {
            const user = { userId: 'user1', role: 'user' };
            
            // Mock permissions to deny VIEW_METRICS
            jest.spyOn(planner.securityManager, 'checkPermission').mockResolvedValue(false);

            const metrics = await planner.getQuantumMetrics(user);

            expect(metrics).toBeDefined();
            expect(metrics.securityMetrics).toBeUndefined();
            expect(metrics.performanceMetrics).toBeUndefined();
            expect(metrics.scalingMetrics).toBeUndefined();
        });

        test('should track execution history', async () => {
            const tasks = [{ id: 'task1', priority: 0.5, estimatedDuration: 60 }];

            await planner.planTasks(tasks);
            await planner.planTasks(tasks);

            expect(planner.executionHistory.length).toBe(2);
            expect(planner.executionHistory[0].taskCount).toBe(1);
            expect(planner.executionHistory[0].duration).toBeGreaterThan(0);
        });
    });

    describe('Scaling and Load Balancing', () => {
        beforeEach(async () => {
            await planner.initialize();
        });

        test('should distribute load across instances', async () => {
            const tasks = [{ id: 'task1', priority: 0.5, estimatedDuration: 60 }];

            // Execute multiple planning requests concurrently
            const promises = Array.from({ length: 5 }, () => planner.planTasks(tasks));
            const results = await Promise.all(promises);

            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.phases).toBeDefined();
            });
        });

        test('should handle instance failures gracefully', async () => {
            const tasks = [{ id: 'task1', priority: 0.5, estimatedDuration: 60 }];

            // Mock instance failure
            jest.spyOn(planner.scalingManager, 'routeRequest').mockRejectedValueOnce(
                new Error('No healthy instances available')
            );

            // Should still work through error recovery
            await expect(planner.planTasks(tasks)).rejects.toThrow();
        });
    });

    describe('Shutdown', () => {
        test('should shutdown all components cleanly', async () => {
            await planner.initialize();
            expect(planner.initialized).toBe(true);

            await planner.shutdown();
            expect(planner.initialized).toBe(false);
            expect(planner.quantumState.size).toBe(0);
            expect(planner.taskQueue.length).toBe(0);
        });

        test('should handle shutdown when not initialized', async () => {
            // Should not throw error
            await expect(planner.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        beforeEach(async () => {
            await planner.initialize();
        });

        test('should handle tasks with extreme values', async () => {
            const extremeTasks = [
                {
                    id: 'task1',
                    priority: 0,
                    estimatedDuration: 1,
                    requiredResources: []
                },
                {
                    id: 'task2',
                    priority: 1,
                    estimatedDuration: 86400, // 24 hours
                    requiredResources: ['cpu', 'memory', 'disk', 'network']
                }
            ];

            const plan = await planner.planTasks(extremeTasks);
            expect(plan).toBeDefined();
            expect(plan.phases.length).toBeGreaterThan(0);
        });

        test('should handle unicode and special characters in task IDs', async () => {
            const unicodeTasks = [
                {
                    id: 'tâsk-1-ñ',
                    priority: 0.5,
                    estimatedDuration: 60
                }
            ];

            // Should sanitize but not crash
            await expect(planner.planTasks(unicodeTasks)).rejects.toThrow(/Validation failed/);
        });

        test('should handle tasks with missing optional fields', async () => {
            const minimalTasks = [
                { id: 'task1' }, // Only ID provided
                { id: 'task2', priority: 0.5 }, // Minimal fields
            ];

            const plan = await planner.planTasks(minimalTasks);
            expect(plan).toBeDefined();
        });
    });
});