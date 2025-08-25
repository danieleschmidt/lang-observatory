/**
 * Adaptive Quality Engine
 * Machine Learning-based quality prediction and adaptive threshold management
 */

const { Logger } = require('../utils/logger');
const { ProgressiveQualityGates } = require('./progressiveQualityGates');

class AdaptiveQualityEngine {
  constructor(config = {}) {
    this.config = {
      ml: {
        enabled: config.ml?.enabled || true,
        modelType: config.ml?.modelType || 'linear_regression',
        trainingWindow: config.ml?.trainingWindow || 100, // Historical data points
        predictionHorizon: config.ml?.predictionHorizon || 10, // Future predictions
        adaptationRate: config.ml?.adaptationRate || 0.1, // Learning rate
      },
      adaptation: {
        enabled: config.adaptation?.enabled || true,
        thresholdFlexibility: config.adaptation?.thresholdFlexibility || 0.1, // 10% adjustment range
        seasonality: config.adaptation?.seasonality || true,
        contextAware: config.adaptation?.contextAware || true,
      },
      prediction: {
        enabled: config.prediction?.enabled || true,
        confidence: config.prediction?.confidence || 0.8,
        alertOnPredictedFailure: config.prediction?.alertOnPredictedFailure || true,
      },
      ...config,
    };

    this.logger = new Logger({ service: 'AdaptiveQualityEngine' });
    this.progressiveGates = new ProgressiveQualityGates(config.progressiveGates);
    
    this.historicalData = [];
    this.mlModel = null;
    this.adaptiveThresholds = new Map();
    this.predictions = [];
    this.contextFactors = new Map();
    
    this.qualityPatterns = {
      trends: new Map(),
      seasonality: new Map(),
      anomalies: [],
      correlations: new Map(),
    };

    this.initializeAdaptiveEngine();
  }

  initializeAdaptiveEngine() {
    this.logger.info('Initializing adaptive quality engine...');
    
    // Initialize adaptive thresholds with base values
    const baseThresholds = {
      coverage: 85,
      testPassRate: 95,
      security: 90,
      performance: 80,
      quality: 85,
    };
    
    Object.entries(baseThresholds).forEach(([metric, threshold]) => {
      this.adaptiveThresholds.set(metric, {
        current: threshold,
        base: threshold,
        min: threshold * 0.8,
        max: threshold * 1.2,
        adaptationHistory: [],
      });
    });

    // Initialize context factors
    this.contextFactors.set('timeOfDay', this.getTimeOfDayFactor());
    this.contextFactors.set('dayOfWeek', this.getDayOfWeekFactor());
    this.contextFactors.set('codeComplexity', 1.0);
    this.contextFactors.set('teamSize', 1.0);
    
    this.logger.info('Adaptive quality engine initialized');
  }

  async startAdaptiveLearning() {
    this.logger.info('Starting adaptive learning process...');
    
    if (this.config.ml.enabled) {
      await this.initializeMLModel();
      await this.trainModel();
    }
    
    if (this.config.adaptation.enabled) {
      this.startThresholdAdaptation();
    }
    
    if (this.config.prediction.enabled) {
      this.startPredictiveAnalysis();
    }
    
    this.logger.info('Adaptive learning process started');
  }

  async initializeMLModel() {
    this.logger.info('Initializing ML model for quality prediction...');
    
    // Simple linear regression model for quality prediction
    this.mlModel = {
      weights: new Map([
        ['coverage', 0.25],
        ['testPassRate', 0.30],
        ['security', 0.20],
        ['performance', 0.15],
        ['quality', 0.10],
      ]),
      bias: 0,
      trainingData: [],
      accuracy: 0,
      lastTrained: null,
    };
    
    this.logger.info('ML model initialized with linear regression');
  }

  async trainModel() {
    if (!this.mlModel || this.historicalData.length < 10) {
      this.logger.warn('Insufficient data for model training');
      return;
    }
    
    this.logger.info('Training ML model with historical data...');
    
    const trainingData = this.prepareTrainingData();
    
    // Simple gradient descent training
    const learningRate = this.config.ml.adaptationRate;
    let totalError = 0;
    
    for (let epoch = 0; epoch < 100; epoch++) {
      totalError = 0;
      
      for (const sample of trainingData) {
        const prediction = this.predict(sample.features);
        const error = sample.target - prediction;
        totalError += Math.abs(error);
        
        // Update weights
        Object.entries(sample.features).forEach(([feature, value]) => {
          const currentWeight = this.mlModel.weights.get(feature) || 0;
          const newWeight = currentWeight + learningRate * error * value;
          this.mlModel.weights.set(feature, newWeight);
        });
        
        // Update bias
        this.mlModel.bias += learningRate * error;
      }
      
      const avgError = totalError / trainingData.length;
      if (avgError < 0.01) break; // Convergence threshold
    }
    
    this.mlModel.accuracy = 1 - (totalError / trainingData.length / 100);
    this.mlModel.lastTrained = new Date().toISOString();
    
    this.logger.info(`ML model trained. Accuracy: ${(this.mlModel.accuracy * 100).toFixed(2)}%`);
  }

  prepareTrainingData() {
    return this.historicalData.map(dataPoint => ({
      features: {
        coverage: dataPoint.quality?.coverage || 0,
        testPassRate: dataPoint.quality?.testPassRate || 0,
        security: dataPoint.quality?.security || 0,
        performance: dataPoint.quality?.performance || 0,
        quality: dataPoint.quality?.quality || 0,
        timeOfDay: this.getTimeOfDayFactor(dataPoint.timestamp),
        dayOfWeek: this.getDayOfWeekFactor(dataPoint.timestamp),
      },
      target: dataPoint.overallScore || 0,
    }));
  }

  predict(features) {
    if (!this.mlModel) return 0;
    
    let prediction = this.mlModel.bias;
    
    Object.entries(features).forEach(([feature, value]) => {
      const weight = this.mlModel.weights.get(feature) || 0;
      prediction += weight * value;
    });
    
    return Math.max(0, Math.min(100, prediction));
  }

  async generateQualityPredictions() {
    if (!this.config.prediction.enabled || !this.mlModel) {
      return { error: 'Prediction not enabled or model not available' };
    }
    
    this.logger.info('Generating quality predictions...');
    
    const currentMetrics = await this.progressiveGates.validator.getMetrics();
    const predictions = [];
    
    // Generate predictions for next few time periods
    for (let i = 1; i <= this.config.ml.predictionHorizon; i++) {
      const futureTimestamp = new Date(Date.now() + i * 60000); // 1 minute intervals
      
      const features = {
        coverage: currentMetrics.codeCoverage,
        testPassRate: currentMetrics.testPassRate,
        security: currentMetrics.securityScore,
        performance: currentMetrics.performanceScore,
        quality: currentMetrics.codeQualityScore,
        timeOfDay: this.getTimeOfDayFactor(futureTimestamp),
        dayOfWeek: this.getDayOfWeekFactor(futureTimestamp),
      };
      
      const prediction = this.predict(features);
      const confidence = this.calculatePredictionConfidence(features);
      
      predictions.push({
        timestamp: futureTimestamp.toISOString(),
        predictedScore: prediction,
        confidence,
        features,
        alertLevel: this.getPredictionAlertLevel(prediction),
      });
    }
    
    this.predictions = predictions;
    
    // Check for predicted failures
    if (this.config.prediction.alertOnPredictedFailure) {
      this.checkPredictedFailures(predictions);
    }
    
    this.logger.info(`Generated ${predictions.length} quality predictions`);
    return predictions;
  }

  calculatePredictionConfidence(features) {
    // Simple confidence calculation based on data completeness and model accuracy
    const featureCompleteness = Object.values(features).filter(v => v > 0).length / Object.keys(features).length;
    const modelConfidence = this.mlModel.accuracy || 0.5;
    
    return Math.min(featureCompleteness * modelConfidence, 1.0);
  }

  getPredictionAlertLevel(predictedScore) {
    const thresholds = this.config.alerts?.thresholds || { emergency: 30, critical: 50, warning: 70 };
    
    if (predictedScore <= thresholds.emergency) return 'emergency';
    if (predictedScore <= thresholds.critical) return 'critical';
    if (predictedScore <= thresholds.warning) return 'warning';
    return 'normal';
  }

  checkPredictedFailures(predictions) {
    const criticalPredictions = predictions.filter(
      p => p.alertLevel === 'critical' || p.alertLevel === 'emergency'
    );
    
    if (criticalPredictions.length > 0) {
      this.progressiveGates.emit('predictedFailure', {
        predictions: criticalPredictions,
        timeToFailure: criticalPredictions[0].timestamp,
        confidence: criticalPredictions[0].confidence,
      });
    }
  }

  startThresholdAdaptation() {
    this.logger.info('Starting adaptive threshold management...');
    
    setInterval(() => {
      this.adaptThresholds();
    }, 60000); // Adapt every minute
  }

  adaptThresholds() {
    if (!this.config.adaptation.enabled) return;
    
    this.logger.debug('Adapting quality thresholds based on context...');
    
    this.adaptiveThresholds.forEach((thresholdData, metric) => {
      const contextualAdjustment = this.calculateContextualAdjustment(metric);
      const trendAdjustment = this.calculateTrendAdjustment(metric);
      const seasonalAdjustment = this.calculateSeasonalAdjustment(metric);
      
      const totalAdjustment = contextualAdjustment + trendAdjustment + seasonalAdjustment;
      const adjustmentMagnitude = Math.abs(totalAdjustment);
      const maxAdjustment = thresholdData.base * this.config.adaptation.thresholdFlexibility;
      
      if (adjustmentMagnitude <= maxAdjustment) {
        const newThreshold = Math.max(
          thresholdData.min,
          Math.min(thresholdData.max, thresholdData.base + totalAdjustment)
        );
        
        if (Math.abs(newThreshold - thresholdData.current) > 0.5) {
          this.logger.debug(`Adapting ${metric} threshold: ${thresholdData.current.toFixed(1)} → ${newThreshold.toFixed(1)}`);
          
          thresholdData.adaptationHistory.push({
            timestamp: new Date().toISOString(),
            oldThreshold: thresholdData.current,
            newThreshold,
            adjustments: { contextualAdjustment, trendAdjustment, seasonalAdjustment },
          });
          
          thresholdData.current = newThreshold;
          this.adaptiveThresholds.set(metric, thresholdData);
        }
      }
    });
  }

  calculateContextualAdjustment(metric) {
    const timeOfDay = this.getTimeOfDayFactor();
    const complexity = this.contextFactors.get('codeComplexity') || 1.0;
    
    // Adjust thresholds based on context
    let adjustment = 0;
    
    // Lower thresholds during high-complexity periods
    if (complexity > 1.5) adjustment -= 2;
    
    // Adjust for time of day (lower expectations during off-hours)
    if (timeOfDay < 0.5) adjustment -= 1;
    
    return adjustment;
  }

  calculateTrendAdjustment(metric) {
    const trend = this.qualityPatterns.trends.get(metric);
    if (!trend || trend.length < 5) return 0;
    
    // Calculate moving average trend
    const recentTrend = trend.slice(-5);
    const trendSlope = this.calculateSlope(recentTrend);
    
    // Adjust thresholds based on improving/declining trends
    return trendSlope > 0 ? 1 : -1;
  }

  calculateSeasonalAdjustment(metric) {
    if (!this.config.adaptation.seasonality) return 0;
    
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    // Simple seasonal adjustments
    let adjustment = 0;
    
    // Lower expectations on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) adjustment -= 1;
    
    // Lower expectations during late night/early morning
    if (hour < 6 || hour > 22) adjustment -= 0.5;
    
    return adjustment;
  }

  calculateSlope(dataPoints) {
    if (dataPoints.length < 2) return 0;
    
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, _, i) => sum + i, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
    const sumXY = dataPoints.reduce((sum, point, i) => sum + i * point.value, 0);
    const sumXX = dataPoints.reduce((sum, _, i) => sum + i * i, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  getTimeOfDayFactor(timestamp = null) {
    const hour = timestamp ? new Date(timestamp).getHours() : new Date().getHours();
    
    // Higher expectations during business hours (9 AM - 6 PM)
    if (hour >= 9 && hour <= 18) return 1.0;
    if (hour >= 7 && hour <= 20) return 0.8;
    return 0.6;
  }

  getDayOfWeekFactor(timestamp = null) {
    const day = timestamp ? new Date(timestamp).getDay() : new Date().getDay();
    
    // Higher expectations on weekdays
    if (day >= 1 && day <= 5) return 1.0;
    return 0.7; // Weekends
  }

  async analyzeQualityPatterns() {
    this.logger.info('Analyzing quality patterns...');
    
    if (this.historicalData.length < 10) {
      this.logger.warn('Insufficient data for pattern analysis');
      return;
    }
    
    // Analyze trends for each quality metric
    const metrics = ['coverage', 'testPassRate', 'security', 'performance', 'quality'];
    
    metrics.forEach(metric => {
      const metricData = this.historicalData.map(d => ({
        value: d.quality?.[metric] || 0,
        timestamp: d.timestamp,
      }));
      
      this.qualityPatterns.trends.set(metric, metricData);
      
      // Detect anomalies
      const anomalies = this.detectAnomalies(metricData);
      if (anomalies.length > 0) {
        this.qualityPatterns.anomalies.push({
          metric,
          anomalies,
          detectedAt: new Date().toISOString(),
        });
      }
    });
    
    // Analyze correlations between metrics
    this.analyzeMetricCorrelations();
    
    this.logger.info('Quality pattern analysis completed');
  }

  detectAnomalies(data) {
    if (data.length < 10) return [];
    
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = 2 * stdDev; // 2 standard deviations
    
    return data.filter(point => Math.abs(point.value - mean) > threshold);
  }

  analyzeMetricCorrelations() {
    const metrics = ['coverage', 'testPassRate', 'security', 'performance', 'quality'];
    
    metrics.forEach(metric1 => {
      metrics.forEach(metric2 => {
        if (metric1 !== metric2) {
          const correlation = this.calculateCorrelation(metric1, metric2);
          if (Math.abs(correlation) > 0.5) { // Significant correlation
            this.qualityPatterns.correlations.set(`${metric1}-${metric2}`, correlation);
          }
        }
      });
    });
  }

  calculateCorrelation(metric1, metric2) {
    const data1 = this.historicalData.map(d => d.quality?.[metric1] || 0);
    const data2 = this.historicalData.map(d => d.quality?.[metric2] || 0);
    
    if (data1.length !== data2.length || data1.length < 3) return 0;
    
    const mean1 = data1.reduce((sum, v) => sum + v, 0) / data1.length;
    const mean2 = data2.reduce((sum, v) => sum + v, 0) / data2.length;
    
    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    
    for (let i = 0; i < data1.length; i++) {
      const diff1 = data1[i] - mean1;
      const diff2 = data2[i] - mean2;
      
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  startPredictiveAnalysis() {
    this.logger.info('Starting predictive quality analysis...');
    
    setInterval(async () => {
      try {
        const predictions = await this.generateQualityPredictions();
        
        // Check for predicted issues
        const criticalPredictions = predictions.filter(p => 
          p.alertLevel === 'critical' || p.alertLevel === 'emergency'
        );
        
        if (criticalPredictions.length > 0) {
          this.logger.warn(`Predicted quality issues in ${criticalPredictions.length} time periods`);
          
          // Emit prediction alert
          this.progressiveGates.emit('predictedQualityIssue', {
            predictions: criticalPredictions,
            severity: 'warning',
            timeframe: `${this.config.ml.predictionHorizon} minutes`,
          });
        }
        
      } catch (error) {
        this.logger.error('Predictive analysis failed:', error);
      }
    }, 120000); // Every 2 minutes
  }

  async generateQualityPredictions() {
    if (!this.mlModel) {
      throw new Error('ML model not initialized');
    }
    
    const currentMetrics = await this.progressiveGates.validator.getMetrics();
    const predictions = [];
    
    for (let i = 1; i <= this.config.ml.predictionHorizon; i++) {
      const futureTime = new Date(Date.now() + i * 60000);
      
      const features = {
        coverage: currentMetrics.codeCoverage,
        testPassRate: currentMetrics.testPassRate,
        security: currentMetrics.securityScore,
        performance: currentMetrics.performanceScore,
        quality: currentMetrics.codeQualityScore,
        timeOfDay: this.getTimeOfDayFactor(futureTime),
        dayOfWeek: this.getDayOfWeekFactor(futureTime),
      };
      
      const predictedScore = this.predict(features);
      const confidence = this.calculatePredictionConfidence(features);
      
      predictions.push({
        timestamp: futureTime.toISOString(),
        predictedScore,
        confidence,
        alertLevel: this.getPredictionAlertLevel(predictedScore),
        recommendation: this.generatePredictionRecommendation(predictedScore, features),
      });
    }
    
    return predictions;
  }

  calculatePredictionConfidence(features) {
    if (!this.mlModel.accuracy) return 0.5;
    
    // Base confidence on model accuracy and data completeness
    const featureCompleteness = Object.values(features).filter(v => v > 0).length / Object.keys(features).length;
    return Math.min(this.mlModel.accuracy * featureCompleteness, 1.0);
  }

  getPredictionAlertLevel(predictedScore) {
    const thresholds = this.config.alerts?.thresholds || { emergency: 30, critical: 50, warning: 70 };
    
    if (predictedScore <= thresholds.emergency) return 'emergency';
    if (predictedScore <= thresholds.critical) return 'critical';
    if (predictedScore <= thresholds.warning) return 'warning';
    return 'normal';
  }

  generatePredictionRecommendation(predictedScore, features) {
    const recommendations = [];
    
    if (predictedScore < 70) {
      const worstMetric = Object.entries(features)
        .filter(([key]) => !['timeOfDay', 'dayOfWeek'].includes(key))
        .sort(([,a], [,b]) => a - b)[0];
      
      if (worstMetric) {
        recommendations.push(`Focus on improving ${worstMetric[0]} (predicted: ${worstMetric[1].toFixed(1)})`);
      }
    }
    
    return recommendations;
  }

  recordQualityData(data) {
    this.historicalData.push({
      ...data,
      timestamp: new Date().toISOString(),
    });
    
    // Maintain rolling window
    if (this.historicalData.length > this.config.ml.trainingWindow) {
      this.historicalData = this.historicalData.slice(-this.config.ml.trainingWindow);
    }
    
    // Retrain model periodically
    if (this.historicalData.length % 20 === 0) {
      this.trainModel();
    }
  }

  getAdaptiveThresholds() {
    const thresholds = {};
    this.adaptiveThresholds.forEach((data, metric) => {
      thresholds[metric] = {
        current: data.current,
        base: data.base,
        adaptationCount: data.adaptationHistory.length,
      };
    });
    return thresholds;
  }

  async generateAdaptiveReport() {
    const predictions = await this.generateQualityPredictions();
    await this.analyzeQualityPatterns();
    
    return {
      adaptive: {
        thresholds: this.getAdaptiveThresholds(),
        patterns: {
          trends: Object.fromEntries(this.qualityPatterns.trends),
          anomalies: this.qualityPatterns.anomalies,
          correlations: Object.fromEntries(this.qualityPatterns.correlations),
        },
        predictions,
        model: {
          accuracy: this.mlModel?.accuracy,
          lastTrained: this.mlModel?.lastTrained,
          trainingDataSize: this.historicalData.length,
        },
      },
      contextFactors: Object.fromEntries(this.contextFactors),
      configuration: this.config,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { AdaptiveQualityEngine };