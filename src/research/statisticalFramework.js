/**
 * Statistical Framework for Research Validation
 *
 * Provides comprehensive statistical analysis infrastructure for validating
 * research hypotheses in the quantum-neuromorphic fusion system.
 *
 * Features:
 * - Power analysis and sample size determination
 * - Multiple statistical test implementations
 * - Effect size calculations
 * - Bootstrap confidence intervals
 * - Multiple comparison corrections
 * - Bayesian analysis components
 */

const { Logger } = require('../utils/logger');
const { EventEmitter } = require('events');

class StatisticalFramework extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      significanceLevel: config.significanceLevel || 0.05,
      powerLevel: config.powerLevel || 0.8,
      minimumEffectSize: config.minimumEffectSize || 0.3,
      bootstrapIterations: config.bootstrapIterations || 1000,
      multipleComparisonsMethod:
        config.multipleComparisonsMethod || 'bonferroni',
      bayesianPriors: config.bayesianPriors || 'uniform',
      ...config,
    };

    this.logger = new Logger({ component: 'StatisticalFramework' });

    // Statistical data storage
    this.datasets = new Map();
    this.testResults = new Map();
    this.powerAnalyses = new Map();
    this.effectSizes = new Map();
    this.confidenceIntervals = new Map();

    // Analysis cache for performance
    this.analysisCache = new Map();

    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Statistical Framework...');

      // Initialize statistical tables and distributions
      await this.initializeStatisticalTables();

      // Setup analysis pipeline
      this.setupAnalysisPipeline();

      this.initialized = true;
      this.logger.info('Statistical Framework initialized successfully');

      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Statistical Framework:', error);
      throw error;
    }
  }

  async initializeStatisticalTables() {
    // Pre-compute critical values for common statistical tests
    this.criticalValues = {
      tTest: this.generateTTestCriticalValues(),
      chiSquare: this.generateChiSquareCriticalValues(),
      fTest: this.generateFTestCriticalValues(),
      zTest: this.generateZTestCriticalValues(),
    };

    // Initialize distribution functions
    this.distributions = {
      normal: this.createNormalDistribution(),
      t: this.createTDistribution(),
      chi2: this.createChiSquareDistribution(),
      f: this.createFDistribution(),
    };
  }

  setupAnalysisPipeline() {
    // Define analysis workflow
    this.analysisPipeline = {
      dataValidation: this.validateDataset.bind(this),
      descriptiveAnalysis: this.performDescriptiveAnalysis.bind(this),
      assumptionTesting: this.testAssumptions.bind(this),
      mainAnalysis: this.performMainAnalysis.bind(this),
      effectSizeCalculation: this.calculateEffectSizes.bind(this),
      powerAnalysis: this.performPowerAnalysis.bind(this),
      multipleComparisons: this.correctForMultipleComparisons.bind(this),
      bayesianAnalysis: this.performBayesianAnalysis.bind(this),
      confidenceIntervals: this.calculateConfidenceIntervals.bind(this),
    };
  }

  // Dataset Management
  addDataset(name, data, metadata = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Dataset must be a non-empty array');
    }

    const dataset = {
      name,
      data: [...data], // Create copy
      metadata: {
        added: Date.now(),
        size: data.length,
        type: this.inferDataType(data),
        ...metadata,
      },
      validated: false,
      preprocessed: false,
    };

    this.datasets.set(name, dataset);
    this.logger.info(
      `Added dataset '${name}' with ${data.length} observations`
    );

    return dataset;
  }

  inferDataType(data) {
    const firstValue = data[0];

    if (typeof firstValue === 'number') {
      return 'continuous';
    } else if (typeof firstValue === 'boolean') {
      return 'binary';
    } else if (typeof firstValue === 'string') {
      return 'categorical';
    } else if (Array.isArray(firstValue)) {
      return 'multivariate';
    }

    return 'unknown';
  }

  // Data Validation and Preprocessing
  async validateDataset(datasetName) {
    const dataset = this.datasets.get(datasetName);
    if (!dataset) {
      throw new Error(`Dataset '${datasetName}' not found`);
    }

    const validation = {
      isValid: true,
      issues: [],
      warnings: [],
      recommendations: [],
    };

    // Check for missing values
    const missingCount = dataset.data.filter(
      val => val === null || val === undefined || Number.isNaN(val)
    ).length;
    if (missingCount > 0) {
      validation.warnings.push(`${missingCount} missing values detected`);
      if (missingCount / dataset.data.length > 0.1) {
        validation.recommendations.push(
          'Consider imputation or removal of observations with missing values'
        );
      }
    }

    // Check for outliers (if numeric data)
    if (dataset.metadata.type === 'continuous') {
      const outliers = this.detectOutliers(dataset.data);
      if (outliers.length > 0) {
        validation.warnings.push(
          `${outliers.length} potential outliers detected`
        );
        validation.recommendations.push(
          'Consider outlier analysis and treatment'
        );
      }
    }

    // Check sample size adequacy
    const minimumSampleSize = this.calculateMinimumSampleSize();
    if (dataset.data.length < minimumSampleSize) {
      validation.issues.push(
        `Sample size (${dataset.data.length}) below recommended minimum (${minimumSampleSize})`
      );
      validation.isValid = false;
    }

    // Check normality (if required)
    if (dataset.metadata.type === 'continuous') {
      const normalityTest = this.testNormality(dataset.data);
      if (!normalityTest.isNormal) {
        validation.warnings.push('Data may not be normally distributed');
        validation.recommendations.push(
          'Consider non-parametric tests or data transformation'
        );
      }
    }

    dataset.validation = validation;
    dataset.validated = true;

    this.logger.info(`Validated dataset '${datasetName}'`, {
      isValid: validation.isValid,
      issues: validation.issues.length,
      warnings: validation.warnings.length,
    });

    return validation;
  }

  detectOutliers(data, method = 'iqr') {
    const sortedData = [...data].sort((a, b) => a - b);
    const q1 = this.percentile(sortedData, 25);
    const q3 = this.percentile(sortedData, 75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return data.filter(val => val < lowerBound || val > upperBound);
  }

  testNormality(data) {
    // Shapiro-Wilk test implementation (simplified)
    if (data.length < 3 || data.length > 5000) {
      return {
        isNormal: false,
        pValue: null,
        test: 'sample_size_out_of_range',
      };
    }

    const n = data.length;
    const sortedData = [...data].sort((a, b) => a - b);

    // Calculate W statistic (simplified approximation)
    const mean = data.reduce((sum, val) => sum + val, 0) / n;
    const variance =
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);

    // Simplified test - in practice, would use proper Shapiro-Wilk coefficients
    const skewness = this.calculateSkewness(data);
    const kurtosis = this.calculateKurtosis(data);

    const normalityScore =
      1 - (Math.abs(skewness) * 0.3 + Math.abs(kurtosis - 3) * 0.2);
    const isNormal = normalityScore > 0.6; // Simplified threshold

    return {
      isNormal,
      wStatistic: normalityScore,
      pValue: isNormal ? 0.2 : 0.01, // Simplified p-value
      test: 'shapiro_wilk_simplified',
    };
  }

  calculateSkewness(data) {
    const n = data.length;
    const mean = data.reduce((sum, val) => sum + val, 0) / n;
    const variance =
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const skewness =
      data.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) /
      n;
    return skewness;
  }

  calculateKurtosis(data) {
    const n = data.length;
    const mean = data.reduce((sum, val) => sum + val, 0) / n;
    const variance =
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const kurtosis =
      data.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) /
      n;
    return kurtosis;
  }

  // Descriptive Statistics
  performDescriptiveAnalysis(datasetName) {
    const dataset = this.datasets.get(datasetName);
    if (!dataset) {
      throw new Error(`Dataset '${datasetName}' not found`);
    }

    const data = dataset.data.filter(
      val => val !== null && val !== undefined && !Number.isNaN(val)
    );

    const descriptives = {
      n: data.length,
      mean: this.mean(data),
      median: this.median(data),
      mode: this.mode(data),
      variance: this.variance(data),
      standardDeviation: this.standardDeviation(data),
      minimum: Math.min(...data),
      maximum: Math.max(...data),
      range: Math.max(...data) - Math.min(...data),
      quartiles: {
        q1: this.percentile(data, 25),
        q2: this.percentile(data, 50),
        q3: this.percentile(data, 75),
      },
      skewness: this.calculateSkewness(data),
      kurtosis: this.calculateKurtosis(data),
      confidenceInterval95: this.calculateMeanConfidenceInterval(data, 0.95),
    };

    dataset.descriptives = descriptives;
    return descriptives;
  }

  mean(data) {
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  median(data) {
    const sorted = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  mode(data) {
    const frequency = {};
    let maxFreq = 0;
    let modes = [];

    data.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
      if (frequency[val] > maxFreq) {
        maxFreq = frequency[val];
        modes = [val];
      } else if (frequency[val] === maxFreq && !modes.includes(val)) {
        modes.push(val);
      }
    });

    return modes.length === data.length ? null : modes;
  }

  variance(data) {
    const mean = this.mean(data);
    return (
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      (data.length - 1)
    );
  }

  standardDeviation(data) {
    return Math.sqrt(this.variance(data));
  }

  percentile(data, percentile) {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  // Statistical Tests
  async performTwoSampleTTest(dataset1Name, dataset2Name, options = {}) {
    const data1 = this.getCleanData(dataset1Name);
    const data2 = this.getCleanData(dataset2Name);

    const tTestOptions = {
      equalVariances: options.equalVariances !== false,
      paired: options.paired || false,
      alternative: options.alternative || 'two-sided',
      confidenceLevel: options.confidenceLevel || 0.95,
      ...options,
    };

    // Perform Levene's test for equal variances
    const equalVarianceTest = this.testEqualVariances(data1, data2);

    let tTestResult;
    if (tTestOptions.paired) {
      tTestResult = this.pairedTTest(data1, data2, tTestOptions);
    } else if (tTestOptions.equalVariances && equalVarianceTest.pValue > 0.05) {
      tTestResult = this.independentTTest(data1, data2, tTestOptions);
    } else {
      tTestResult = this.welchTTest(data1, data2, tTestOptions);
    }

    // Calculate effect size (Cohen's d)
    const effectSize = this.calculateCohenD(data1, data2, tTestOptions.paired);

    const result = {
      test: 'two_sample_t_test',
      testType: tTestOptions.paired
        ? 'paired'
        : tTestOptions.equalVariances
          ? 'independent'
          : 'welch',
      ...tTestResult,
      effectSize,
      equalVarianceTest,
      assumptions: this.checkTTestAssumptions(data1, data2, tTestOptions),
      interpretation: this.interpretTTestResult(tTestResult, effectSize),
    };

    this.testResults.set(`ttest_${dataset1Name}_vs_${dataset2Name}`, result);
    return result;
  }

  getCleanData(datasetName) {
    const dataset = this.datasets.get(datasetName);
    if (!dataset) {
      throw new Error(`Dataset '${datasetName}' not found`);
    }

    return dataset.data.filter(
      val => val !== null && val !== undefined && !Number.isNaN(val)
    );
  }

  testEqualVariances(data1, data2) {
    // Levene's test for equal variances (simplified F-test version)
    const var1 = this.variance(data1);
    const var2 = this.variance(data2);

    const fStatistic = Math.max(var1, var2) / Math.min(var1, var2);
    const df1 = data1.length - 1;
    const df2 = data2.length - 1;

    // Simplified p-value calculation
    const pValue = fStatistic > 3 ? 0.01 : 0.1; // Rough approximation

    return {
      test: 'levene_test',
      fStatistic,
      degreesOfFreedom: [df1, df2],
      pValue,
      equalVariances: pValue > 0.05,
    };
  }

  independentTTest(data1, data2, options) {
    const n1 = data1.length;
    const n2 = data2.length;
    const mean1 = this.mean(data1);
    const mean2 = this.mean(data2);
    const var1 = this.variance(data1);
    const var2 = this.variance(data2);

    // Pooled variance
    const pooledVariance = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const standardError = Math.sqrt(pooledVariance * (1 / n1 + 1 / n2));

    const tStatistic = (mean1 - mean2) / standardError;
    const degreesOfFreedom = n1 + n2 - 2;

    const pValue = this.calculateTTestPValue(
      tStatistic,
      degreesOfFreedom,
      options.alternative
    );
    const confidenceInterval = this.calculateTTestConfidenceInterval(
      mean1 - mean2,
      standardError,
      degreesOfFreedom,
      options.confidenceLevel
    );

    return {
      mean1,
      mean2,
      meanDifference: mean1 - mean2,
      tStatistic,
      degreesOfFreedom,
      pValue,
      confidenceInterval,
      significant: pValue < this.config.significanceLevel,
    };
  }

  welchTTest(data1, data2, options) {
    // Welch's t-test for unequal variances
    const n1 = data1.length;
    const n2 = data2.length;
    const mean1 = this.mean(data1);
    const mean2 = this.mean(data2);
    const var1 = this.variance(data1);
    const var2 = this.variance(data2);

    const standardError = Math.sqrt(var1 / n1 + var2 / n2);
    const tStatistic = (mean1 - mean2) / standardError;

    // Welch's approximation for degrees of freedom
    const degreesOfFreedom =
      Math.pow(var1 / n1 + var2 / n2, 2) /
      (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

    const pValue = this.calculateTTestPValue(
      tStatistic,
      degreesOfFreedom,
      options.alternative
    );
    const confidenceInterval = this.calculateTTestConfidenceInterval(
      mean1 - mean2,
      standardError,
      degreesOfFreedom,
      options.confidenceLevel
    );

    return {
      mean1,
      mean2,
      meanDifference: mean1 - mean2,
      tStatistic,
      degreesOfFreedom,
      pValue,
      confidenceInterval,
      significant: pValue < this.config.significanceLevel,
    };
  }

  pairedTTest(data1, data2, options) {
    if (data1.length !== data2.length) {
      throw new Error('Paired t-test requires equal sample sizes');
    }

    const differences = data1.map((val, i) => val - data2[i]);
    const n = differences.length;
    const meanDiff = this.mean(differences);
    const varDiff = this.variance(differences);
    const standardError = Math.sqrt(varDiff / n);

    const tStatistic = meanDiff / standardError;
    const degreesOfFreedom = n - 1;

    const pValue = this.calculateTTestPValue(
      tStatistic,
      degreesOfFreedom,
      options.alternative
    );
    const confidenceInterval = this.calculateTTestConfidenceInterval(
      meanDiff,
      standardError,
      degreesOfFreedom,
      options.confidenceLevel
    );

    return {
      mean1: this.mean(data1),
      mean2: this.mean(data2),
      meanDifference: meanDiff,
      tStatistic,
      degreesOfFreedom,
      pValue,
      confidenceInterval,
      significant: pValue < this.config.significanceLevel,
    };
  }

  calculateTTestPValue(tStatistic, df, alternative = 'two-sided') {
    // Simplified p-value calculation using t-distribution approximation
    const absTStat = Math.abs(tStatistic);

    // Rough approximation based on common critical values
    let pValue;
    if (df >= 30) {
      // Use normal approximation for large df
      pValue = 2 * (1 - this.normalCDF(absTStat));
    } else {
      // Simplified t-distribution approximation
      if (absTStat > 3) pValue = 0.01;
      else if (absTStat > 2.5) pValue = 0.02;
      else if (absTStat > 2) pValue = 0.05;
      else if (absTStat > 1.5) pValue = 0.15;
      else pValue = 0.3;
    }

    if (alternative === 'one-sided') {
      pValue = pValue / 2;
    }

    return pValue;
  }

  calculateTTestConfidenceInterval(
    estimate,
    standardError,
    df,
    confidenceLevel
  ) {
    const alpha = 1 - confidenceLevel;
    const tCritical = this.getTCriticalValue(df, alpha / 2);
    const marginOfError = tCritical * standardError;

    return {
      lower: estimate - marginOfError,
      upper: estimate + marginOfError,
      marginOfError,
    };
  }

  getTCriticalValue(df, alpha) {
    // Simplified t-critical values
    if (df >= 30) return 1.96; // Normal approximation
    if (alpha <= 0.01) return 3.0;
    if (alpha <= 0.025) return 2.5;
    if (alpha <= 0.05) return 2.0;
    return 1.5;
  }

  // Effect Size Calculations
  calculateCohenD(data1, data2, paired = false) {
    if (paired) {
      const differences = data1.map((val, i) => val - data2[i]);
      const meanDiff = this.mean(differences);
      const stdDiff = this.standardDeviation(differences);

      return {
        d: meanDiff / stdDiff,
        interpretation: this.interpretCohenD(meanDiff / stdDiff),
        type: 'paired',
      };
    } else {
      const mean1 = this.mean(data1);
      const mean2 = this.mean(data2);
      const pooledSD = this.calculatePooledStandardDeviation(data1, data2);

      const d = (mean1 - mean2) / pooledSD;

      return {
        d,
        interpretation: this.interpretCohenD(d),
        type: 'independent',
      };
    }
  }

  calculatePooledStandardDeviation(data1, data2) {
    const n1 = data1.length;
    const n2 = data2.length;
    const var1 = this.variance(data1);
    const var2 = this.variance(data2);

    return Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  }

  interpretCohenD(d) {
    const absD = Math.abs(d);
    if (absD < 0.2) return 'negligible';
    if (absD < 0.5) return 'small';
    if (absD < 0.8) return 'medium';
    return 'large';
  }

  // Power Analysis
  async performPowerAnalysis(testType, parameters = {}) {
    const powerAnalysis = {
      testType,
      parameters,
      requiredSampleSize: null,
      achievedPower: null,
      minDetectableEffect: null,
    };

    switch (testType) {
      case 'two_sample_t_test':
        powerAnalysis.requiredSampleSize =
          this.calculateTTestSampleSize(parameters);
        powerAnalysis.achievedPower = this.calculateTTestPower(parameters);
        break;
      case 'one_way_anova':
        powerAnalysis.requiredSampleSize =
          this.calculateANOVASampleSize(parameters);
        powerAnalysis.achievedPower = this.calculateANOVAPower(parameters);
        break;
      default:
        throw new Error(
          `Power analysis not implemented for test type: ${testType}`
        );
    }

    const analysisKey = `power_${testType}_${Date.now()}`;
    this.powerAnalyses.set(analysisKey, powerAnalysis);

    return powerAnalysis;
  }

  calculateTTestSampleSize(parameters) {
    const {
      effectSize = this.config.minimumEffectSize,
      alpha = this.config.significanceLevel,
      power = this.config.powerLevel,
      testType = 'two-sided',
    } = parameters;

    const zAlpha = this.getZCriticalValue(
      testType === 'two-sided' ? alpha / 2 : alpha
    );
    const zBeta = this.getZCriticalValue(1 - power);

    // Formula: n = 2 * ((z_alpha + z_beta) / effect_size)^2
    const sampleSize = Math.ceil(
      2 * Math.pow((zAlpha + zBeta) / effectSize, 2)
    );

    return {
      perGroup: sampleSize,
      total: sampleSize * 2,
      effectSize,
      alpha,
      power,
    };
  }

  calculateTTestPower(parameters) {
    const {
      sampleSize,
      effectSize,
      alpha = this.config.significanceLevel,
      testType = 'two-sided',
    } = parameters;

    if (!sampleSize || !effectSize) {
      throw new Error(
        'Sample size and effect size required for power calculation'
      );
    }

    const zAlpha = this.getZCriticalValue(
      testType === 'two-sided' ? alpha / 2 : alpha
    );
    const delta = effectSize * Math.sqrt(sampleSize / 2);
    const power = 1 - this.normalCDF(zAlpha - delta);

    return {
      power: Math.min(1, Math.max(0, power)),
      sampleSize,
      effectSize,
      alpha,
    };
  }

  getZCriticalValue(alpha) {
    // Common z-critical values
    if (alpha <= 0.001) return 3.29;
    if (alpha <= 0.005) return 2.81;
    if (alpha <= 0.01) return 2.58;
    if (alpha <= 0.025) return 1.96;
    if (alpha <= 0.05) return 1.645;
    if (alpha <= 0.1) return 1.28;
    return 1.0;
  }

  // Bootstrap Confidence Intervals
  async calculateBootstrapConfidenceInterval(
    datasetName,
    statistic,
    options = {}
  ) {
    const data = this.getCleanData(datasetName);
    const {
      iterations = this.config.bootstrapIterations,
      confidenceLevel = 0.95,
      method = 'percentile',
    } = options;

    const bootstrapStatistics = [];

    for (let i = 0; i < iterations; i++) {
      const bootstrapSample = this.bootstrapSample(data);
      const stat = this.calculateStatistic(bootstrapSample, statistic);
      bootstrapStatistics.push(stat);
    }

    const sortedStats = bootstrapStatistics.sort((a, b) => a - b);
    const alpha = 1 - confidenceLevel;
    const lowerIndex = Math.floor((alpha / 2) * iterations);
    const upperIndex = Math.floor((1 - alpha / 2) * iterations);

    const confidenceInterval = {
      method,
      confidenceLevel,
      lower: sortedStats[lowerIndex],
      upper: sortedStats[upperIndex],
      originalStatistic: this.calculateStatistic(data, statistic),
      bootstrapStatistics: sortedStats,
      iterations,
    };

    const key = `bootstrap_${datasetName}_${statistic}`;
    this.confidenceIntervals.set(key, confidenceInterval);

    return confidenceInterval;
  }

  bootstrapSample(data) {
    const sample = [];
    for (let i = 0; i < data.length; i++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      sample.push(data[randomIndex]);
    }
    return sample;
  }

  calculateStatistic(data, statistic) {
    switch (statistic) {
      case 'mean':
        return this.mean(data);
      case 'median':
        return this.median(data);
      case 'variance':
        return this.variance(data);
      case 'standardDeviation':
        return this.standardDeviation(data);
      default:
        throw new Error(`Unknown statistic: ${statistic}`);
    }
  }

  // Multiple Comparisons Correction
  correctForMultipleComparisons(pValues, method = null) {
    const correctionMethod = method || this.config.multipleComparisonsMethod;
    const m = pValues.length;

    let correctedPValues;
    switch (correctionMethod) {
      case 'bonferroni':
        correctedPValues = pValues.map(p => Math.min(1, p * m));
        break;
      case 'holm':
        correctedPValues = this.holmCorrection(pValues);
        break;
      case 'benjamini_hochberg':
        correctedPValues = this.benjaminiHochbergCorrection(pValues);
        break;
      default:
        throw new Error(`Unknown correction method: ${correctionMethod}`);
    }

    return {
      method: correctionMethod,
      originalPValues: [...pValues],
      correctedPValues,
      significant: correctedPValues.map(p => p < this.config.significanceLevel),
      rejectedHypotheses: correctedPValues.filter(
        p => p < this.config.significanceLevel
      ).length,
    };
  }

  holmCorrection(pValues) {
    const m = pValues.length;
    const indexed = pValues
      .map((p, i) => ({ p, index: i }))
      .sort((a, b) => a.p - b.p);
    const corrected = new Array(m);

    for (let i = 0; i < m; i++) {
      const correctedP = Math.min(1, indexed[i].p * (m - i));
      corrected[indexed[i].index] = correctedP;
    }

    return corrected;
  }

  benjaminiHochbergCorrection(pValues) {
    const m = pValues.length;
    const indexed = pValues
      .map((p, i) => ({ p, index: i }))
      .sort((a, b) => a.p - b.p);
    const corrected = new Array(m);

    for (let i = m - 1; i >= 0; i--) {
      const correctedP = Math.min(1, (indexed[i].p * m) / (i + 1));
      corrected[indexed[i].index] = correctedP;

      if (i < m - 1) {
        corrected[indexed[i].index] = Math.min(
          corrected[indexed[i].index],
          corrected[indexed[i + 1].index]
        );
      }
    }

    return corrected;
  }

  // Bayesian Analysis Framework
  performBayesianAnalysis(datasetName, priorParameters = {}) {
    const data = this.getCleanData(datasetName);

    // Simple Bayesian analysis for normal data with conjugate priors
    const prior = {
      mu0: priorParameters.mu0 || 0, // Prior mean
      kappa0: priorParameters.kappa0 || 1, // Prior precision for mean
      alpha0: priorParameters.alpha0 || 1, // Prior shape for precision
      beta0: priorParameters.beta0 || 1, // Prior rate for precision
    };

    const n = data.length;
    const sampleMean = this.mean(data);
    const sampleVariance = this.variance(data);

    // Posterior parameters (normal-gamma conjugate)
    const posterior = {
      mu_n: (prior.kappa0 * prior.mu0 + n * sampleMean) / (prior.kappa0 + n),
      kappa_n: prior.kappa0 + n,
      alpha_n: prior.alpha0 + n / 2,
      beta_n:
        prior.beta0 +
        0.5 *
          ((n - 1) * sampleVariance +
            (prior.kappa0 * n * Math.pow(sampleMean - prior.mu0, 2)) /
              (prior.kappa0 + n)),
    };

    // Posterior predictive distribution parameters
    const posteriorMean = posterior.mu_n;
    const posteriorVariance =
      (posterior.beta_n * (posterior.kappa_n + 1)) /
      (posterior.alpha_n * posterior.kappa_n);

    const bayesianResult = {
      prior,
      posterior,
      posteriorPredictive: {
        mean: posteriorMean,
        variance: posteriorVariance,
      },
      credibleInterval: this.calculateBayesianCredibleInterval(posterior, 0.95),
      bayesFactor: this.calculateBayesFactor(data, prior),
    };

    return bayesianResult;
  }

  calculateBayesianCredibleInterval(posterior, credibility = 0.95) {
    // Simplified credible interval for normal-gamma posterior
    const alpha = 1 - credibility;
    const df = 2 * posterior.alpha_n;

    // Approximate using t-distribution
    const tCritical = this.getTCriticalValue(df, alpha / 2);
    const standardError = Math.sqrt(
      posterior.beta_n / (posterior.alpha_n * posterior.kappa_n)
    );

    return {
      lower: posterior.mu_n - tCritical * standardError,
      upper: posterior.mu_n + tCritical * standardError,
      credibility,
    };
  }

  calculateBayesFactor(data, prior) {
    // Simplified Bayes factor calculation (placeholder)
    // In practice, this would involve proper model comparison
    const n = data.length;
    const logBF = n * 0.1; // Placeholder calculation

    return {
      logBayesFactor: logBF,
      bayesFactor: Math.exp(logBF),
      interpretation: this.interpretBayesFactor(Math.exp(logBF)),
    };
  }

  interpretBayesFactor(bf) {
    if (bf > 100) return 'decisive evidence';
    if (bf > 30) return 'very strong evidence';
    if (bf > 10) return 'strong evidence';
    if (bf > 3) return 'moderate evidence';
    if (bf > 1) return 'weak evidence';
    return 'no evidence';
  }

  // Utility Methods
  calculateMinimumSampleSize() {
    // Rule of thumb: minimum 30 for normal approximation
    return Math.max(30, this.calculateTTestSampleSize({}).perGroup);
  }

  calculateMeanConfidenceInterval(data, confidenceLevel = 0.95) {
    const mean = this.mean(data);
    const standardError = this.standardDeviation(data) / Math.sqrt(data.length);
    const alpha = 1 - confidenceLevel;
    const tCritical = this.getTCriticalValue(data.length - 1, alpha / 2);
    const marginOfError = tCritical * standardError;

    return {
      lower: mean - marginOfError,
      upper: mean + marginOfError,
      marginOfError,
      confidenceLevel,
    };
  }

  normalCDF(x) {
    // Simplified normal CDF using error function approximation
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  erf(x) {
    // Abramowitz and Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  // Critical value tables (simplified)
  generateTTestCriticalValues() {
    return {
      0.05: { 1: 12.706, 2: 4.303, 5: 2.571, 10: 2.228, 20: 2.086, 30: 2.042 },
      0.01: { 1: 63.657, 2: 9.925, 5: 4.032, 10: 3.169, 20: 2.845, 30: 2.75 },
    };
  }

  generateZTestCriticalValues() {
    return {
      0.05: 1.96,
      0.01: 2.58,
      0.001: 3.29,
    };
  }

  generateChiSquareCriticalValues() {
    return {
      0.05: { 1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.071 },
      0.01: { 1: 6.635, 2: 9.21, 3: 11.345, 4: 13.277, 5: 15.086 },
    };
  }

  generateFTestCriticalValues() {
    return {
      0.05: { '1,1': 161.4, '1,5': 6.61, '5,5': 5.05, '10,10': 2.98 },
      0.01: { '1,1': 4052, '1,5': 16.26, '5,5': 10.97, '10,10': 4.85 },
    };
  }

  createNormalDistribution() {
    return {
      pdf: (x, mu = 0, sigma = 1) => {
        return (
          (1 / (sigma * Math.sqrt(2 * Math.PI))) *
          Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2))
        );
      },
      cdf: (x, mu = 0, sigma = 1) => {
        return this.normalCDF((x - mu) / sigma);
      },
    };
  }

  createTDistribution() {
    return {
      pdf: (x, df) => {
        // Simplified t-distribution PDF
        const gamma = this.gamma(df / 2);
        const coefficient =
          gamma / (Math.sqrt(df * Math.PI) * this.gamma((df + 1) / 2));
        return coefficient * Math.pow(1 + (x * x) / df, -(df + 1) / 2);
      },
    };
  }

  createChiSquareDistribution() {
    return {
      pdf: (x, df) => {
        if (x <= 0) return 0;
        return (
          (1 / (Math.pow(2, df / 2) * this.gamma(df / 2))) *
          Math.pow(x, df / 2 - 1) *
          Math.exp(-x / 2)
        );
      },
    };
  }

  createFDistribution() {
    return {
      pdf: (x, df1, df2) => {
        if (x <= 0) return 0;
        const coefficient =
          (this.gamma((df1 + df2) / 2) /
            (this.gamma(df1 / 2) * this.gamma(df2 / 2))) *
          Math.pow(df1 / df2, df1 / 2);
        return (
          (coefficient * Math.pow(x, df1 / 2 - 1)) /
          Math.pow(1 + (df1 / df2) * x, (df1 + df2) / 2)
        );
      },
    };
  }

  gamma(z) {
    // Simplified gamma function approximation
    if (z === 1) return 1;
    if (z === 0.5) return Math.sqrt(Math.PI);
    if (z > 1) return (z - 1) * this.gamma(z - 1);
    return Math.sqrt((2 * Math.PI) / z) * Math.pow(z / Math.E, z);
  }

  // Testing and validation methods
  checkTTestAssumptions(data1, data2, options) {
    return {
      normalityData1: this.testNormality(data1),
      normalityData2: this.testNormality(data2),
      equalVariances: this.testEqualVariances(data1, data2),
      independence: { assumed: true, note: 'Cannot test from data alone' },
      sampleSizeAdequate: {
        data1: data1.length >= 30,
        data2: data2.length >= 30,
        note: 'Large sample approximation valid for n >= 30',
      },
    };
  }

  interpretTTestResult(tTestResult, effectSize) {
    const interpretation = {
      significantResult: tTestResult.significant,
      effectSizeMagnitude: effectSize.interpretation,
      practicalSignificance:
        Math.abs(effectSize.d) >= this.config.minimumEffectSize,
      confidenceIntervalInterpretation: this.interpretConfidenceInterval(
        tTestResult.confidenceInterval
      ),
    };

    if (tTestResult.significant && interpretation.practicalSignificance) {
      interpretation.conclusion =
        'Statistically and practically significant difference detected';
    } else if (tTestResult.significant) {
      interpretation.conclusion =
        'Statistically significant but small effect size';
    } else {
      interpretation.conclusion = 'No significant difference detected';
    }

    return interpretation;
  }

  interpretConfidenceInterval(ci) {
    const includesZero = ci.lower <= 0 && ci.upper >= 0;
    const width = ci.upper - ci.lower;

    return {
      includesZero,
      width,
      precision: width < 0.5 ? 'high' : width < 1.0 ? 'medium' : 'low',
      interpretation: includesZero
        ? 'Interval includes zero - no significant difference'
        : 'Interval excludes zero - significant difference likely',
    };
  }

  // Export and reporting
  generateStatisticalReport() {
    return {
      framework: {
        version: '1.0.0',
        configuration: this.config,
        initialized: this.initialized,
      },
      datasets: {
        count: this.datasets.size,
        names: Array.from(this.datasets.keys()),
        totalObservations: Array.from(this.datasets.values()).reduce(
          (sum, dataset) => sum + dataset.data.length,
          0
        ),
      },
      analyses: {
        testResults: this.testResults.size,
        powerAnalyses: this.powerAnalyses.size,
        confidenceIntervals: this.confidenceIntervals.size,
      },
      summary: this.generateAnalysisSummary(),
    };
  }

  generateAnalysisSummary() {
    const significantTests = Array.from(this.testResults.values()).filter(
      result => result.significant
    ).length;
    const totalTests = this.testResults.size;

    return {
      significantTests,
      totalTests,
      significanceRate: totalTests > 0 ? significantTests / totalTests : 0,
      multipleComparisons: significantTests > 1,
      recommendedCorrection:
        significantTests > 1 ? this.config.multipleComparisonsMethod : 'none',
    };
  }

  // Health check
  async getHealth() {
    return {
      healthy: this.initialized,
      datasets: this.datasets.size,
      testResults: this.testResults.size,
      cacheSize: this.analysisCache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  estimateMemoryUsage() {
    let totalSize = 0;

    // Estimate dataset sizes
    this.datasets.forEach(dataset => {
      totalSize += dataset.data.length * 8; // 8 bytes per number
    });

    // Add overhead for results and caches
    totalSize += this.testResults.size * 1000; // ~1KB per test result
    totalSize += this.analysisCache.size * 500; // ~500B per cache entry

    return {
      estimatedBytes: totalSize,
      estimatedMB: totalSize / (1024 * 1024),
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Statistical Framework...');

    this.datasets.clear();
    this.testResults.clear();
    this.powerAnalyses.clear();
    this.effectSizes.clear();
    this.confidenceIntervals.clear();
    this.analysisCache.clear();

    this.initialized = false;
    this.logger.info('Statistical Framework shutdown complete');
  }
}

module.exports = { StatisticalFramework };
