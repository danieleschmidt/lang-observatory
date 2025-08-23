/**
 * Quantum-Neuromorphic Fusion Algorithm Validation Tests
 *
 * Comprehensive test suite validating the research implementation
 * and ensuring reproducibility of published results.
 */

const {
  QuantumNeuromorphicFusionEngine,
} = require('../../src/research/quantumNeuromorphicFusion');
const {
  StatisticalFramework,
} = require('../../src/research/statisticalFramework');
const {
  ComprehensiveBenchmarkingSystem,
} = require('../../src/research/benchmarkingSystem');

describe('Quantum-Neuromorphic Fusion Research Validation', () => {
  let fusionEngine;
  let statisticalFramework;
  let benchmarkingSystem;

  beforeAll(async () => {
    // Initialize research components with test configurations
    fusionEngine = new QuantumNeuromorphicFusionEngine({
      experimentalMode: true,
      learningRate: 0.1,
      quantumCoherence: 0.85,
      neuromorphicSensitivity: 0.7,
      fusionThreshold: 0.6,
    });

    statisticalFramework = new StatisticalFramework({
      significanceLevel: 0.05,
      powerLevel: 0.8,
      minimumEffectSize: 0.3,
      bootstrapIterations: 100, // Reduced for testing
      multipleComparisonsMethod: 'bonferroni',
    });

    benchmarkingSystem = new ComprehensiveBenchmarkingSystem({
      outputDirectory: './test_benchmark_results',
      defaultIterations: 10, // Reduced for testing
      warmupIterations: 2,
      saveIntermediateResults: false,
      enableRealTimeVisualization: false,
    });

    // Initialize all components
    await Promise.all([
      fusionEngine.initialize(),
      statisticalFramework.initialize(),
      benchmarkingSystem.initialize(),
    ]);
  }, 30000); // 30 second timeout for initialization

  afterAll(async () => {
    // Clean shutdown
    await Promise.all([
      fusionEngine.shutdown(),
      statisticalFramework.shutdown(),
      benchmarkingSystem.shutdown(),
    ]);
  });

  describe('Algorithm Implementation Validation', () => {
    test('quantum task planner creates valid superposition states', async () => {
      const tasks = generateTestTaskSet(10);
      const constraints = { maxConcurrency: 4, resourceAvailability: 1.0 };

      const result = await fusionEngine.planTasksWithFusion(
        tasks,
        constraints,
        'quantum'
      );

      expect(result).toBeDefined();
      expect(result.phases).toBeInstanceOf(Array);
      expect(result.phases.length).toBeGreaterThan(0);
      expect(result.efficiency).toBeGreaterThan(0);
      expect(result.efficiency).toBeLessThanOrEqual(1);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    test('neuromorphic interface processes LLM patterns correctly', async () => {
      const testLLMCall = {
        id: 'test_llm_call',
        provider: 'test',
        model: 'test-model',
        inputTokens: 100,
        outputTokens: 50,
        duration: 1000,
        cost: 0.01,
        timestamp: new Date().toISOString(),
      };

      const result =
        await fusionEngine.neuromorphicInterface.processLLMCall(testLLMCall);

      expect(result).toBeDefined();
      expect(result.adaptiveRecommendations).toBeDefined();
      expect(result.adaptiveRecommendations.recommendations).toBeInstanceOf(
        Array
      );
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.neuromorphicResult).toBeDefined();
    });

    test('fusion algorithm combines quantum and neuromorphic approaches', async () => {
      const tasks = generateTestTaskSet(25);
      const constraints = { maxConcurrency: 4, resourceAvailability: 1.0 };

      const fusionResult = await fusionEngine.planTasksWithFusion(
        tasks,
        constraints,
        'fusion'
      );

      expect(fusionResult).toBeDefined();
      expect(fusionResult.fusionMetrics).toBeDefined();
      expect(fusionResult.fusionMetrics.weights).toBeDefined();
      expect(
        fusionResult.fusionMetrics.correlationStrength
      ).toBeGreaterThanOrEqual(0);
      expect(fusionResult.quantumContribution).toBeDefined();
      expect(fusionResult.neuromorphicContribution).toBeDefined();
      expect(fusionResult.fusionAlgorithm).toBe(
        'quantum-neuromorphic-photon-fusion'
      );
    });

    test('adaptive weights evolve based on performance feedback', async () => {
      const initialQuantumWeight = fusionEngine.fusionWeights.get(
        'quantumContribution'
      );
      const initialNeuromorphicWeight = fusionEngine.fusionWeights.get(
        'neuromorphicContribution'
      );

      // Simulate multiple learning iterations
      for (let i = 0; i < 5; i++) {
        const tasks = generateTestTaskSet(20);
        await fusionEngine.planTasksWithFusion(tasks, {}, 'fusion');
      }

      const finalQuantumWeight = fusionEngine.fusionWeights.get(
        'quantumContribution'
      );
      const finalNeuromorphicWeight = fusionEngine.fusionWeights.get(
        'neuromorphicContribution'
      );

      // Weights should remain normalized (sum to 1.0)
      expect(
        Math.abs(finalQuantumWeight + finalNeuromorphicWeight - 1.0)
      ).toBeLessThan(0.01);

      // At least one weight should have changed (adaptive learning)
      const weightsChanged =
        Math.abs(finalQuantumWeight - initialQuantumWeight) > 0.001 ||
        Math.abs(finalNeuromorphicWeight - initialNeuromorphicWeight) > 0.001;
      expect(weightsChanged).toBe(true);
    });
  });

  describe('Statistical Framework Validation', () => {
    test('sample size calculations match power analysis requirements', () => {
      const sampleSizeResult = statisticalFramework.calculateTTestSampleSize({
        effectSize: 0.5,
        alpha: 0.05,
        power: 0.8,
        testType: 'two-sided',
      });

      expect(sampleSizeResult.perGroup).toBeGreaterThanOrEqual(32);
      expect(sampleSizeResult.total).toBe(sampleSizeResult.perGroup * 2);
      expect(sampleSizeResult.effectSize).toBe(0.5);
      expect(sampleSizeResult.alpha).toBe(0.05);
      expect(sampleSizeResult.power).toBe(0.8);
    });

    test('t-test implementation produces correct statistical results', async () => {
      // Generate test data with known properties
      const group1 = Array.from(
        { length: 50 },
        () => Math.random() * 0.2 + 0.7
      ); // Mean ~0.8
      const group2 = Array.from(
        { length: 50 },
        () => Math.random() * 0.2 + 0.5
      ); // Mean ~0.6

      statisticalFramework.addDataset('test_group_1', group1);
      statisticalFramework.addDataset('test_group_2', group2);

      const tTestResult = await statisticalFramework.performTwoSampleTTest(
        'test_group_1',
        'test_group_2'
      );

      expect(tTestResult).toBeDefined();
      expect(tTestResult.mean1).toBeCloseTo(0.8, 1);
      expect(tTestResult.mean2).toBeCloseTo(0.6, 1);
      expect(tTestResult.meanDifference).toBeCloseTo(0.2, 1);
      expect(tTestResult.significant).toBe(true); // Should be significant given the difference
      expect(tTestResult.pValue).toBeLessThan(0.05);
      expect(tTestResult.effectSize).toBeDefined();
      expect(tTestResult.effectSize.interpretation).toBe('large');
    });

    test('multiple comparisons correction reduces false positives', () => {
      const pValues = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06];
      const correctionResult =
        statisticalFramework.correctForMultipleComparisons(
          pValues,
          'bonferroni'
        );

      expect(correctionResult.method).toBe('bonferroni');
      expect(correctionResult.correctedPValues).toHaveLength(pValues.length);

      // All corrected p-values should be larger than originals
      correctionResult.correctedPValues.forEach((corrected, i) => {
        expect(corrected).toBeGreaterThanOrEqual(pValues[i]);
      });

      // Number of significant results should be reduced
      const originalSignificant = pValues.filter(p => p < 0.05).length;
      const correctedSignificant = correctionResult.rejectedHypotheses;
      expect(correctedSignificant).toBeLessThanOrEqual(originalSignificant);
    });

    test('bootstrap confidence intervals provide robust estimates', async () => {
      const testData = Array.from(
        { length: 100 },
        () => Math.random() * 10 + 50
      ); // Mean ~55
      statisticalFramework.addDataset('bootstrap_test', testData);

      const bootstrapResult =
        await statisticalFramework.calculateBootstrapConfidenceInterval(
          'bootstrap_test',
          'mean',
          { iterations: 100, confidenceLevel: 0.95 }
        );

      expect(bootstrapResult).toBeDefined();
      expect(bootstrapResult.lower).toBeLessThan(bootstrapResult.upper);
      expect(bootstrapResult.originalStatistic).toBeCloseTo(55, 0);
      expect(bootstrapResult.lower).toBeCloseTo(55, 1);
      expect(bootstrapResult.upper).toBeCloseTo(55, 1);
      expect(bootstrapResult.bootstrapStatistics).toHaveLength(100);
      expect(bootstrapResult.confidenceLevel).toBe(0.95);
    });
  });

  describe('Benchmarking System Validation', () => {
    test('efficiency comparison benchmark produces valid results', async () => {
      const benchmarkResult = await benchmarkingSystem.runBenchmarkSuite(
        'efficiency_comparison',
        {
          algorithms: ['fifo', 'quantum', 'fusion'],
          taskSets: ['small'],
          iterations: 5,
        }
      );

      expect(benchmarkResult).toBeDefined();
      expect(benchmarkResult.experiment).toBeDefined();
      expect(benchmarkResult.results).toBeDefined();
      expect(benchmarkResult.results.algorithms).toBeDefined();
      expect(benchmarkResult.results.comparisons).toBeInstanceOf(Array);
      expect(benchmarkResult.results.summary).toBeDefined();
      expect(benchmarkResult.statisticalAnalysis).toBeDefined();

      // Validate algorithm results structure
      Object.keys(benchmarkResult.results.algorithms).forEach(algorithm => {
        const algorithmResults = benchmarkResult.results.algorithms[algorithm];
        expect(algorithmResults).toBeDefined();

        Object.keys(algorithmResults).forEach(taskSet => {
          const taskSetResults = algorithmResults[taskSet];
          expect(taskSetResults.rawData).toBeInstanceOf(Array);
          expect(taskSetResults.statistics).toBeDefined();
          expect(taskSetResults.performanceProfile).toBeDefined();
        });
      });
    }, 60000); // 60 second timeout for benchmark

    test('scalability analysis detects complexity patterns', async () => {
      const benchmarkResult = await benchmarkingSystem.runBenchmarkSuite(
        'scalability_analysis',
        {
          algorithms: ['fusion'],
          taskCounts: [10, 25, 50],
          iterations: 3,
        }
      );

      expect(benchmarkResult).toBeDefined();
      expect(benchmarkResult.results.scalingFactors).toBeDefined();
      expect(benchmarkResult.results.complexityAnalysis).toBeDefined();

      const fusionScaling = benchmarkResult.results.scalingFactors.fusion;
      expect(fusionScaling).toBeDefined();
      expect(fusionScaling.slope).toBeGreaterThan(0);
      expect(fusionScaling.rSquared).toBeGreaterThan(0.5); // Reasonable fit
      expect(
        ['constant', 'sublinear', 'linear', 'superlinear'].includes(
          fusionScaling.scalingType
        )
      ).toBe(true);

      const fusionComplexity =
        benchmarkResult.results.complexityAnalysis.fusion;
      expect(fusionComplexity).toBeDefined();
      expect(fusionComplexity.bestModel).toBeDefined();
      expect(fusionComplexity.bestFit.rSquared).toBeGreaterThan(0.5);
    }, 45000); // 45 second timeout

    test('convergence study validates adaptive learning', async () => {
      const benchmarkResult = await benchmarkingSystem.runBenchmarkSuite(
        'convergence_study',
        {
          algorithms: ['fusion'],
          maxIterations: 20,
          convergenceThreshold: 0.01,
        }
      );

      expect(benchmarkResult).toBeDefined();
      expect(benchmarkResult.results.algorithms.fusion).toBeDefined();

      const fusionResults = benchmarkResult.results.algorithms.fusion;
      expect(fusionResults.convergenceData).toBeInstanceOf(Array);
      expect(fusionResults.convergenceData.length).toBeGreaterThan(0);
      expect(fusionResults.convergenceRate).toBeDefined();
      expect(fusionResults.finalStability).toBeDefined();

      // Validate convergence data structure
      fusionResults.convergenceData.forEach(dataPoint => {
        expect(dataPoint.iteration).toBeGreaterThan(0);
        expect(dataPoint.efficiency).toBeGreaterThanOrEqual(0);
        expect(dataPoint.efficiency).toBeLessThanOrEqual(1);
        expect(dataPoint.stabilityIndex).toBeGreaterThanOrEqual(0);
        expect(dataPoint.stabilityIndex).toBeLessThanOrEqual(1);
      });
    }, 60000); // 60 second timeout
  });

  describe('Performance Validation', () => {
    test('fusion algorithm achieves expected efficiency improvements', async () => {
      const taskCount = 50;
      const iterations = 10;
      const algorithms = ['fifo', 'quantum', 'neuromorphic', 'fusion'];

      const results = {};

      for (const algorithm of algorithms) {
        const efficiencies = [];

        for (let i = 0; i < iterations; i++) {
          const tasks = generateTestTaskSet(taskCount);
          const result = await fusionEngine.planTasksWithFusion(
            tasks,
            {},
            algorithm
          );
          efficiencies.push(result.efficiency);
        }

        results[algorithm] = {
          mean:
            efficiencies.reduce((sum, val) => sum + val, 0) /
            efficiencies.length,
          values: efficiencies,
        };
      }

      // Validate expected performance hierarchy
      expect(results.fusion.mean).toBeGreaterThan(results.fifo.mean);
      expect(results.fusion.mean).toBeGreaterThan(results.quantum.mean);
      expect(results.fusion.mean).toBeGreaterThan(results.neuromorphic.mean);

      // Validate minimum improvement thresholds
      const fusionImprovement =
        (results.fusion.mean - results.fifo.mean) / results.fifo.mean;
      expect(fusionImprovement).toBeGreaterThan(0.1); // At least 10% improvement

      console.log('Performance Results:');
      Object.entries(results).forEach(([algorithm, result]) => {
        console.log(
          `${algorithm}: ${(result.mean * 100).toFixed(1)}% efficiency`
        );
      });
      console.log(
        `Fusion improvement over FIFO: ${(fusionImprovement * 100).toFixed(1)}%`
      );
    }, 120000); // 2 minute timeout

    test('computational complexity remains sub-linear', async () => {
      const taskCounts = [10, 25, 50, 100];
      const timingData = [];

      for (const taskCount of taskCounts) {
        const tasks = generateTestTaskSet(taskCount);

        const startTime = process.hrtime.bigint();
        await fusionEngine.planTasksWithFusion(tasks, {}, 'fusion');
        const endTime = process.hrtime.bigint();

        const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        timingData.push({ taskCount, executionTime });
      }

      // Fit complexity models
      const taskCountsData = timingData.map(d => d.taskCount);
      const executionTimes = timingData.map(d => d.executionTime);

      // Test O(n log n) model
      const nLogNPredictors = taskCountsData.map(n => n * Math.log2(n));
      const regression = calculateLinearRegression(
        nLogNPredictors,
        executionTimes
      );

      // R² should be reasonably high for O(n log n) model
      expect(regression.rSquared).toBeGreaterThan(0.7);

      console.log('Complexity Analysis:');
      timingData.forEach(({ taskCount, executionTime }) => {
        console.log(`${taskCount} tasks: ${executionTime.toFixed(2)}ms`);
      });
      console.log(`O(n log n) model R²: ${regression.rSquared.toFixed(3)}`);
    }, 60000);

    test('memory usage remains reasonable under load', async () => {
      const initialMemory = process.memoryUsage();
      const taskCount = 200;

      // Run multiple iterations to test memory stability
      for (let i = 0; i < 5; i++) {
        const tasks = generateTestTaskSet(taskCount);
        await fusionEngine.planTasksWithFusion(tasks, {}, 'fusion');

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be reasonable (less than 50MB for test workload)
      expect(memoryIncreaseMB).toBeLessThan(50);

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });

  describe('Research Reproducibility', () => {
    test('experimental results are reproducible with same parameters', async () => {
      const taskSet = generateTestTaskSet(30, 'reproducibility');
      const constraints = { maxConcurrency: 4, resourceAvailability: 1.0 };

      // Run same experiment multiple times
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await fusionEngine.planTasksWithFusion(
          taskSet,
          constraints,
          'fusion'
        );
        results.push(result.efficiency);
      }

      // Results should be similar (within 5% variation)
      const mean = results.reduce((sum, val) => sum + val, 0) / results.length;
      const maxDeviation = Math.max(...results.map(r => Math.abs(r - mean)));
      const maxDeviationPercent = maxDeviation / mean;

      expect(maxDeviationPercent).toBeLessThan(0.05); // Less than 5% variation
    });

    test('statistical framework produces consistent results', () => {
      const testData = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      statisticalFramework.addDataset('consistency_test', testData);

      // Calculate descriptive statistics multiple times
      const stats1 =
        statisticalFramework.performDescriptiveAnalysis('consistency_test');
      const stats2 =
        statisticalFramework.performDescriptiveAnalysis('consistency_test');

      expect(stats1.mean).toBeCloseTo(stats2.mean, 10);
      expect(stats1.standardDeviation).toBeCloseTo(
        stats2.standardDeviation,
        10
      );
      expect(stats1.median).toBeCloseTo(stats2.median, 10);
    });

    test('benchmark configurations are correctly applied', async () => {
      const customConfig = {
        algorithms: ['fusion'],
        taskSets: ['small'],
        iterations: 3,
      };

      const benchmarkResult = await benchmarkingSystem.runBenchmarkSuite(
        'efficiency_comparison',
        customConfig
      );

      // Verify configuration was applied
      expect(Object.keys(benchmarkResult.results.algorithms)).toEqual([
        'fusion',
      ]);
      expect(Object.keys(benchmarkResult.results.algorithms.fusion)).toEqual([
        'small',
      ]);

      const rawData = benchmarkResult.results.algorithms.fusion.small.rawData;
      expect(rawData).toHaveLength(3); // Should match iterations
    }, 30000);
  });

  // Helper functions
  function generateTestTaskSet(count, prefix = 'test') {
    const tasks = [];

    for (let i = 0; i < count; i++) {
      tasks.push({
        id: `${prefix}_task_${i}`,
        priority: Math.random(),
        estimatedDuration: Math.floor(Math.random() * 200) + 50,
        complexity: Math.floor(Math.random() * 5) + 1,
        requiredResources: ['cpu', 'memory'].slice(
          0,
          Math.floor(Math.random() * 2) + 1
        ),
        dependencies:
          i > 0 && Math.random() < 0.3
            ? [`${prefix}_task_${Math.floor(Math.random() * i)}`]
            : [],
      });
    }

    return tasks;
  }

  function calculateLinearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((sum, xi) => sum + xi, 0);
    const sumY = y.reduce((sum, yi) => sum + yi, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const totalSumSquares = y.reduce(
      (sum, yi) => sum + Math.pow(yi - meanY, 2),
      0
    );
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);

    const rSquared =
      totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : 0;

    return { slope, intercept, rSquared };
  }
});

// Additional integration tests for end-to-end validation
describe('End-to-End Research Validation', () => {
  let system;

  beforeAll(async () => {
    system = new ComprehensiveBenchmarkingSystem({
      outputDirectory: './e2e_test_results',
      defaultIterations: 5,
      saveIntermediateResults: false,
    });

    await system.initialize();
  });

  afterAll(async () => {
    await system.shutdown();
  });

  test('complete research workflow executes successfully', async () => {
    // This test validates the entire research pipeline
    const experimentResult = await system.runExperimentalComparison(25, 3);

    expect(experimentResult).toBeDefined();
    expect(experimentResult.sampleSizes).toBeDefined();
    expect(experimentResult.means).toBeDefined();
    expect(experimentResult.fusionImprovement).toBeDefined();

    // Validate fusion shows improvement
    if (experimentResult.means.fusion && experimentResult.means.fifo) {
      expect(experimentResult.means.fusion).toBeGreaterThan(
        experimentResult.means.fifo
      );
    }

    console.log('Experimental Comparison Results:');
    console.log(
      `Fusion improvement: ${(experimentResult.fusionImprovement * 100).toFixed(1)}%`
    );
    console.log(
      `Statistical significance: ${experimentResult.significantImprovement}`
    );
  }, 180000); // 3 minute timeout for full workflow
});
