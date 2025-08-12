/**
 * Performance tests for Quantum Task Planning System
 */

const { QuantumTaskPlanner } = require('../../src/quantum/quantumTaskPlanner');
const { performance } = require('perf_hooks');

describe('Quantum Task Planner Performance Tests', () => {
  let planner;
  const performanceConfig = {
    maxStates: 16,
    errorHandling: {
      circuitBreakerThreshold: 10,
    },
    performance: {
      maxCacheEntries: 5000,
      cacheTTL: 300000,
      enableCompression: true,
      batchSize: 100,
    },
    scaling: {
      minInstances: 2,
      maxInstances: 8,
      targetCpuUtilization: 0.6,
    },
  };

  beforeAll(async () => {
    planner = new QuantumTaskPlanner(performanceConfig);
    await planner.initialize();
  });

  afterAll(async () => {
    if (planner) {
      await planner.shutdown();
    }
  });

  describe('Throughput Tests', () => {
    test('should handle 100 small tasks within performance threshold', async () => {
      const tasks = Array.from({ length: 100 }, (_, i) => ({
        id: `small-task-${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 30) + 15,
        type: 'computation',
        requiredResources: ['cpu'],
      }));

      const startTime = performance.now();
      const result = await planner.planTasks(tasks);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.quantumPlan.efficiency).toBeGreaterThan(0.3);

      console.log(`100 small tasks planned in ${duration.toFixed(2)}ms`);
    });

    test('should handle 500 medium tasks within reasonable time', async () => {
      const tasks = Array.from({ length: 500 }, (_, i) => ({
        id: `medium-task-${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 120) + 60,
        type: 'data_processing',
        requiredResources: ['cpu', 'memory'],
        complexity: Math.random() > 0.5 ? 'medium' : 'low',
      }));

      const startTime = performance.now();
      const result = await planner.planTasks(tasks);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(result.quantumPlan.phases.length).toBeGreaterThan(0);

      console.log(`500 medium tasks planned in ${duration.toFixed(2)}ms`);
    });

    test('should handle 1000 mixed complexity tasks', async () => {
      const complexities = ['low', 'medium', 'high'];
      const types = ['computation', 'io', 'network', 'ml_processing'];

      const tasks = Array.from({ length: 1000 }, (_, i) => ({
        id: `mixed-task-${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 200) + 30,
        type: types[i % types.length],
        complexity: complexities[i % complexities.length],
        requiredResources: ['cpu', 'memory'].slice(
          0,
          Math.floor(Math.random() * 2) + 1
        ),
        dependencies:
          i > 0 && Math.random() < 0.1 ? [`mixed-task-${i - 1}`] : [],
      }));

      const startTime = performance.now();
      const result = await planner.planTasks(tasks);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(45000); // Should complete within 45 seconds
      expect(result.quantumPlan.totalDuration).toBeGreaterThan(0);

      console.log(`1000 mixed tasks planned in ${duration.toFixed(2)}ms`);
      console.log(
        `Planning efficiency: ${(result.quantumPlan.efficiency * 100).toFixed(1)}%`
      );
    });
  });

  describe('Latency Tests', () => {
    test('should have low latency for simple tasks', async () => {
      const simpleTasks = [
        {
          id: 'latency-test-1',
          priority: 0.7,
          estimatedDuration: 60,
          type: 'simple',
        },
      ];

      const measurements = [];

      // Warm up cache
      await planner.planTasks(simpleTasks);

      // Measure multiple iterations
      for (let i = 0; i < 10; i++) {
        const task = { ...simpleTasks[0], id: `latency-test-${i}` };
        const startTime = performance.now();
        await planner.planTasks([task]);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgLatency =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const p95Latency = measurements.sort((a, b) => a - b)[
        Math.floor(measurements.length * 0.95)
      ];

      expect(avgLatency).toBeLessThan(500); // Average under 500ms
      expect(p95Latency).toBeLessThan(1000); // P95 under 1 second

      console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`P95 latency: ${p95Latency.toFixed(2)}ms`);
    });

    test('should maintain acceptable latency under concurrent load', async () => {
      const concurrentTasks = Array.from({ length: 20 }, (_, i) => [
        {
          id: `concurrent-${i}`,
          priority: Math.random(),
          estimatedDuration: Math.floor(Math.random() * 60) + 30,
        },
      ]);

      const startTime = performance.now();
      const promises = concurrentTasks.map(tasks => planner.planTasks(tasks));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalDuration = endTime - startTime;
      const avgLatencyPerRequest = totalDuration / concurrentTasks.length;

      expect(results).toHaveLength(20);
      expect(avgLatencyPerRequest).toBeLessThan(2000); // Average under 2 seconds per request

      console.log(
        `20 concurrent requests completed in ${totalDuration.toFixed(2)}ms`
      );
      console.log(
        `Average latency per request: ${avgLatencyPerRequest.toFixed(2)}ms`
      );
    });
  });

  describe('Memory Usage Tests', () => {
    test('should maintain reasonable memory usage for large task sets', async () => {
      const initialMemory = process.memoryUsage();

      const largeTasks = Array.from({ length: 2000 }, (_, i) => ({
        id: `memory-test-${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 120) + 30,
        type: 'computation',
        requiredResources: ['cpu', 'memory'],
        dependencies:
          i > 0 && Math.random() < 0.05
            ? [`memory-test-${Math.floor(Math.random() * i)}`]
            : [],
      }));

      const result = await planner.planTasks(largeTasks);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerTask = memoryIncrease / largeTasks.length;

      expect(result).toBeDefined();
      expect(memoryPerTask).toBeLessThan(10000); // Less than 10KB per task on average
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total increase

      console.log(
        `Memory increase for 2000 tasks: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`Memory per task: ${(memoryPerTask / 1024).toFixed(2)}KB`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });

    test('should handle memory pressure gracefully', async () => {
      // Create memory-intensive tasks
      const memoryIntensiveTasks = Array.from({ length: 1500 }, (_, i) => ({
        id: `memory-intensive-${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 300) + 60,
        type: 'ml_training',
        requiredResources: ['cpu', 'memory', 'gpu'],
        complexity: 'high',
        metadata: {
          description: 'Large memory footprint task'.repeat(100), // Increase object size
          parameters: Array.from({ length: 50 }, (_, j) => ({
            key: `param${j}`,
            value: Math.random(),
          })),
        },
      }));

      const startMemory = process.memoryUsage();
      const result = await planner.planTasks(memoryIntensiveTasks);
      const endMemory = process.memoryUsage();

      expect(result).toBeDefined();

      // Should not crash or throw out of memory errors
      const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024); // Less than 200MB growth

      console.log(
        `Memory growth for memory-intensive tasks: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });

  describe('Caching Performance', () => {
    test('should demonstrate significant cache hit performance improvement', async () => {
      const standardTasks = Array.from({ length: 50 }, (_, i) => ({
        id: `cache-perf-${i}`,
        priority: 0.5,
        estimatedDuration: 60,
        type: 'standard_task',
        requiredResources: ['cpu'],
      }));

      const constraints = { maxConcurrency: 4 };

      // First execution (cache miss)
      const startCacheMiss = performance.now();
      await planner.planTasks(standardTasks, constraints);
      const endCacheMiss = performance.now();
      const cacheMissDuration = endCacheMiss - startCacheMiss;

      // Second execution (cache hit)
      const startCacheHit = performance.now();
      await planner.planTasks(standardTasks, constraints);
      const endCacheHit = performance.now();
      const cacheHitDuration = endCacheHit - startCacheHit;

      const speedupRatio = cacheMissDuration / cacheHitDuration;

      expect(speedupRatio).toBeGreaterThan(2); // At least 2x speedup
      expect(cacheHitDuration).toBeLessThan(100); // Cache hit should be very fast

      console.log(`Cache miss duration: ${cacheMissDuration.toFixed(2)}ms`);
      console.log(`Cache hit duration: ${cacheHitDuration.toFixed(2)}ms`);
      console.log(`Cache speedup ratio: ${speedupRatio.toFixed(2)}x`);
    });

    test('should handle cache eviction without performance degradation', async () => {
      const cacheSize = 100; // Force cache eviction
      const taskSets = Array.from({ length: cacheSize + 50 }, (_, i) =>
        Array.from({ length: 5 }, (_, j) => ({
          id: `eviction-test-${i}-${j}`,
          priority: Math.random(),
          estimatedDuration: 30 + j * 10,
          type: 'computation',
        }))
      );

      const durations = [];

      for (const tasks of taskSets) {
        const startTime = performance.now();
        await planner.planTasks(tasks);
        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      // Performance should remain relatively stable even with cache evictions
      const avgDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const varianceRatio = maxDuration / avgDuration;

      expect(varianceRatio).toBeLessThan(3); // Max duration shouldn't be more than 3x average
      expect(avgDuration).toBeLessThan(1000); // Average should still be reasonable

      console.log(
        `Average planning duration with cache eviction: ${avgDuration.toFixed(2)}ms`
      );
      console.log(`Max duration: ${maxDuration.toFixed(2)}ms`);
      console.log(`Variance ratio: ${varianceRatio.toFixed(2)}`);
    });
  });

  describe('Scaling Performance', () => {
    test('should demonstrate load distribution benefits', async () => {
      const highLoadTasks = Array.from({ length: 200 }, (_, i) => ({
        id: `scaling-test-${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 60) + 30,
        type: 'computation',
      }));

      // Execute with high concurrency to trigger scaling
      const concurrentBatches = Array.from({ length: 10 }, (_, i) =>
        highLoadTasks.slice(i * 20, (i + 1) * 20)
      );

      const startTime = performance.now();
      const promises = concurrentBatches.map(batch => planner.planTasks(batch));
      const results = await Promise.allSettled(promises);
      const endTime = performance.now();

      const totalDuration = endTime - startTime;
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = successCount / results.length;

      expect(successRate).toBeGreaterThan(0.8); // At least 80% should succeed
      expect(totalDuration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(
        `Processed ${concurrentBatches.length} concurrent batches in ${totalDuration.toFixed(2)}ms`
      );
      console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);

      // Check scaling metrics
      const metrics = await planner.getQuantumMetrics();
      if (metrics.scalingMetrics) {
        console.log(
          `Instances used: ${metrics.scalingMetrics.instances?.total || 'N/A'}`
        );
      }
    });
  });

  describe('Complex Scenario Performance', () => {
    test('should handle realistic ML pipeline with performance requirements', async () => {
      const mlPipeline = [
        {
          id: 'data-validation',
          type: 'validation',
          priority: 0.9,
          estimatedDuration: 120,
          requiredResources: ['cpu', 'memory'],
          complexity: 'medium',
        },
        {
          id: 'data-cleaning',
          type: 'preprocessing',
          priority: 0.8,
          estimatedDuration: 300,
          requiredResources: ['cpu', 'memory'],
          dependencies: ['data-validation'],
          complexity: 'high',
        },
        {
          id: 'feature-extraction',
          type: 'feature_engineering',
          priority: 0.85,
          estimatedDuration: 240,
          requiredResources: ['cpu', 'memory'],
          dependencies: ['data-cleaning'],
          complexity: 'high',
        },
        {
          id: 'data-splitting',
          type: 'preprocessing',
          priority: 0.7,
          estimatedDuration: 60,
          requiredResources: ['memory'],
          dependencies: ['feature-extraction'],
          complexity: 'low',
        },
        {
          id: 'model-training-1',
          type: 'ml_training',
          priority: 0.95,
          estimatedDuration: 1800,
          requiredResources: ['gpu', 'memory'],
          dependencies: ['data-splitting'],
          complexity: 'high',
        },
        {
          id: 'model-training-2',
          type: 'ml_training',
          priority: 0.95,
          estimatedDuration: 1500,
          requiredResources: ['gpu', 'memory'],
          dependencies: ['data-splitting'],
          complexity: 'high',
        },
        {
          id: 'model-ensemble',
          type: 'ml_processing',
          priority: 0.9,
          estimatedDuration: 180,
          requiredResources: ['cpu', 'memory'],
          dependencies: ['model-training-1', 'model-training-2'],
          complexity: 'medium',
        },
        {
          id: 'model-validation',
          type: 'validation',
          priority: 0.8,
          estimatedDuration: 300,
          requiredResources: ['cpu', 'memory'],
          dependencies: ['model-ensemble'],
          complexity: 'medium',
        },
        {
          id: 'model-deployment',
          type: 'deployment',
          priority: 0.9,
          estimatedDuration: 120,
          requiredResources: ['network', 'cpu'],
          dependencies: ['model-validation'],
          complexity: 'medium',
        },
      ];

      const constraints = {
        maxConcurrency: 3,
        deadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
        resourceAvailability: 0.8,
      };

      const startTime = performance.now();
      const result = await planner.planTasks(mlPipeline, constraints);
      const endTime = performance.now();
      const planningDuration = endTime - startTime;

      expect(result).toBeDefined();
      expect(planningDuration).toBeLessThan(2000); // Planning should be fast even for complex scenarios
      expect(result.quantumPlan.efficiency).toBeGreaterThan(0.4); // Should achieve good efficiency
      expect(result.quantumPlan.parallelism).toBeGreaterThan(0.2); // Should have some parallelism

      console.log(`ML pipeline planned in ${planningDuration.toFixed(2)}ms`);
      console.log(
        `Plan efficiency: ${(result.quantumPlan.efficiency * 100).toFixed(1)}%`
      );
      console.log(
        `Parallelism factor: ${(result.quantumPlan.parallelism * 100).toFixed(1)}%`
      );
      console.log(`Total phases: ${result.quantumPlan.phases.length}`);
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain performance benchmarks over time', async () => {
      const benchmarkTasks = Array.from({ length: 300 }, (_, i) => ({
        id: `benchmark-${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 180) + 30,
        type: ['computation', 'io', 'network', 'ml_processing'][i % 4],
        complexity: ['low', 'medium', 'high'][i % 3],
        requiredResources: ['cpu', 'memory', 'network'].slice(0, (i % 3) + 1),
        dependencies:
          i > 0 && Math.random() < 0.1
            ? [`benchmark-${Math.floor(Math.random() * i)}`]
            : [],
      }));

      const constraints = {
        maxConcurrency: 5,
        resourceAvailability: 0.75,
      };

      // Performance benchmarks (these should be maintained across versions)
      const BENCHMARK_THRESHOLDS = {
        planningTime: 10000, // 10 seconds
        minEfficiency: 0.3, // 30%
        minParallelism: 0.15, // 15%
      };

      const startTime = performance.now();
      const result = await planner.planTasks(benchmarkTasks, constraints);
      const endTime = performance.now();
      const planningTime = endTime - startTime;

      // Assert performance benchmarks
      expect(planningTime).toBeLessThan(BENCHMARK_THRESHOLDS.planningTime);
      expect(result.quantumPlan.efficiency).toBeGreaterThan(
        BENCHMARK_THRESHOLDS.minEfficiency
      );
      expect(result.quantumPlan.parallelism).toBeGreaterThan(
        BENCHMARK_THRESHOLDS.minParallelism
      );

      console.log('=== Performance Benchmark Results ===');
      console.log(
        `Planning time: ${planningTime.toFixed(2)}ms (threshold: ${BENCHMARK_THRESHOLDS.planningTime}ms)`
      );
      console.log(
        `Efficiency: ${(result.quantumPlan.efficiency * 100).toFixed(1)}% (threshold: ${BENCHMARK_THRESHOLDS.minEfficiency * 100}%)`
      );
      console.log(
        `Parallelism: ${(result.quantumPlan.parallelism * 100).toFixed(1)}% (threshold: ${BENCHMARK_THRESHOLDS.minParallelism * 100}%)`
      );
      console.log(
        `Tasks: ${benchmarkTasks.length}, Phases: ${result.quantumPlan.phases.length}`
      );
    });
  });
});
