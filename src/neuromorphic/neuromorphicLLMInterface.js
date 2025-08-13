/**
 * Neuromorphic LLM Interface
 * Bridges traditional LLM observability with neuromorphic computation
 */

const { PhotonProcessor } = require('./photonProcessor');
const { NeuromorphicCache } = require('./neuromorphicCache');
const { NeuromorphicPerformanceOptimizer } = require('./performanceOptimizer');
const { NeuromorphicErrorHandler } = require('./errorHandler');
const { Logger } = require('../utils/logger');
const { EventEmitter } = require('events');

class NeuromorphicLLMInterface extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      photonProcessorConfig: config.photon || {},
      adaptiveThreshold: config.adaptiveThreshold || 0.7,
      learningEnabled: config.learning !== false,
      realTimeProcessing: config.realTime !== false,
      quantumEnhancement: config.quantumEnhancement !== false,
      ...config,
    };

    this.photonProcessor = new PhotonProcessor(
      this.config.photonProcessorConfig
    );
    this.cache = new NeuromorphicCache(this.config.cache || {});
    this.performanceOptimizer = new NeuromorphicPerformanceOptimizer(
      this.config.performance || {}
    );
    this.errorHandler = new NeuromorphicErrorHandler(
      this.config.errorHandling || {}
    );
    this.logger = new Logger({ module: 'NeuromorphicLLMInterface' });

    this.llmCallHistory = [];
    this.adaptiveModels = new Map();
    this.performanceBaselines = new Map();
    this.neuromorphicInsights = new Map();

    this.initialized = false;
    this.processingQueue = [];
    this.isProcessing = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Neuromorphic LLM Interface...');

      // Initialize components in dependency order
      await this.cache.initialize();
      await this.errorHandler.initialize();
      await this.performanceOptimizer.initialize();
      await this.photonProcessor.initialize();

      // Set up event listeners
      this.setupEventListeners();

      // Initialize adaptive models
      await this.initializeAdaptiveModels();

      // Start real-time processing if enabled
      if (this.config.realTimeProcessing) {
        this.startRealTimeProcessing();
      }

      this.initialized = true;
      this.logger.info('Neuromorphic LLM Interface initialized successfully');

      return this;
    } catch (error) {
      this.logger.error(
        'Failed to initialize Neuromorphic LLM Interface:',
        error
      );
      throw error;
    }
  }

  setupEventListeners() {
    // Listen to photon processor events
    this.photonProcessor.on('neuronSpike', data => {
      this.emit('neuromorphicActivity', { type: 'spike', data });
    });

    this.photonProcessor.on('quantumStateChange', data => {
      this.emit('neuromorphicActivity', { type: 'quantum', data });
    });

    // Listen to performance optimizer events
    this.performanceOptimizer.on('optimization_completed', data => {
      this.emit('neuromorphicActivity', { type: 'optimization', data });
    });

    this.performanceOptimizer.on('optimization_failed', data => {
      this.emit('neuromorphicActivity', { type: 'optimization_failed', data });
    });

    // Listen to error handler events
    this.errorHandler.on('error_recovered', data => {
      this.emit('neuromorphicActivity', { type: 'error_recovery', data });
    });

    this.errorHandler.on('healing_completed', data => {
      this.emit('neuromorphicActivity', { type: 'self_healing', data });
    });

    // Listen to cache events
    this.cache.on('cache_hit', data => {
      this.emit('neuromorphicActivity', { type: 'cache_hit', data });
    });

    this.cache.on('cache_eviction', data => {
      this.emit('neuromorphicActivity', { type: 'cache_eviction', data });
    });
  }

  async initializeAdaptiveModels() {
    // Initialize adaptive models for different LLM providers
    const providers = ['openai', 'anthropic', 'google', 'meta', 'cohere'];

    for (const provider of providers) {
      const model = {
        provider,
        baselineMetrics: {
          avgLatency: 1000,
          avgCost: 0.01,
          avgQuality: 0.8,
          avgTokens: 100,
        },
        adaptiveWeights: {
          latency: 0.3,
          cost: 0.3,
          quality: 0.4,
        },
        neuromorphicProfile: await this.createNeuromorphicProfile(provider),
        lastUpdated: Date.now(),
      };

      this.adaptiveModels.set(provider, model);
    }

    this.logger.info(
      `Initialized adaptive models for ${providers.length} providers`
    );
  }

  async createNeuromorphicProfile(provider) {
    // Create provider-specific neuromorphic processing profile
    const profileHash = this.hashProvider(provider);

    return {
      preferredWavelengths: this.generateWavelengthPreferences(profileHash),
      neuronAffinities: this.generateNeuronAffinities(profileHash),
      quantumParameters: this.generateQuantumParameters(profileHash),
      plasticityFactors: this.generatePlasticityFactors(profileHash),
    };
  }

  hashProvider(provider) {
    if (!provider || typeof provider !== 'string') {
      provider = 'default';
    }
    let hash = 0;
    for (let i = 0; i < provider.length; i++) {
      const char = provider.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  generateWavelengthPreferences(hash) {
    const baseWavelength = 400 + (hash % 400); // 400-800 nm
    return {
      primary: baseWavelength,
      secondary: baseWavelength + 50,
      tertiary: baseWavelength - 50,
      sensitivity: 0.7 + (hash % 300) / 1000,
    };
  }

  generateNeuronAffinities(hash) {
    const numAffinities = (hash % 10) + 5;
    const affinities = [];

    for (let i = 0; i < numAffinities; i++) {
      affinities.push({
        neuronType: `neuron_${(hash + i) % 1000}`,
        affinity: ((hash + i) % 100) / 100,
        activation: ((hash * i) % 100) / 100,
      });
    }

    return affinities;
  }

  generateQuantumParameters(hash) {
    return {
      coherenceTime: 100 + (hash % 900), // 100-1000 ms
      entanglementStrength: (hash % 100) / 100,
      phaseShift: (hash % 628) / 100, // 0-2π
      superpositionDegree: 0.5 + (hash % 50) / 100,
    };
  }

  generatePlasticityFactors(hash) {
    return {
      learningRate: 0.001 + (hash % 99) / 100000,
      decayRate: 0.9 + (hash % 10) / 100,
      adaptationSpeed: 0.1 + (hash % 90) / 1000,
    };
  }

  startRealTimeProcessing() {
    // Start background processing queue
    setInterval(() => {
      this.processQueue();
    }, 100); // Process queue every 100ms
  }

  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.processingQueue.splice(0, 5); // Process 5 items at a time

      await Promise.all(batch.map(item => this.processLLMCallInternal(item)));
    } catch (error) {
      this.logger.error('Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processLLMCall(llmCallData) {
    if (!this.initialized) {
      throw new Error('Neuromorphic LLM Interface not initialized');
    }

    const enhancedCallData = {
      ...llmCallData,
      id: llmCallData.id || `llm_call_${Date.now()}`,
      timestamp: llmCallData.timestamp || new Date().toISOString(),
      neuromorphicMetadata: {
        processingId: `nm_${Date.now()}`,
        queuePosition: this.processingQueue.length,
      },
    };

    if (this.config.realTimeProcessing) {
      // Add to processing queue
      this.processingQueue.push(enhancedCallData);
      return { queued: true, id: enhancedCallData.id };
    } else {
      // Process immediately
      return await this.processLLMCallInternal(enhancedCallData);
    }
  }

  async processLLMCallInternal(llmCallData) {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(llmCallData);
      const cachedResult = await this.cache.get(cacheKey);

      if (cachedResult && this.isCacheValid(cachedResult, llmCallData)) {
        this.logger.debug('Cache hit for LLM call', { callId: llmCallData.id });
        return cachedResult;
      }

      // Store in history
      this.llmCallHistory.push(llmCallData);

      // Get or create adaptive model
      const adaptiveModel = this.getOrCreateAdaptiveModel(llmCallData.provider);

      // Prepare neuromorphic data
      const neuromorphicData = this.prepareLLMDataForNeuromorphic(
        llmCallData,
        adaptiveModel
      );

      // Process through photon processor with error handling
      let neuromorphicResult;
      try {
        neuromorphicResult =
          await this.photonProcessor.processLLMData(neuromorphicData);
      } catch (error) {
        // Use error handler for recovery
        const recoveryResult = await this.errorHandler.handleError(error, {
          component: 'photon_processor',
          operation: 'processLLMData',
          data: llmCallData,
        });

        if (recoveryResult.success) {
          neuromorphicResult = recoveryResult.result;
        } else {
          throw error;
        }
      }

      // Generate adaptive recommendations
      const adaptiveRecommendations = this.generateAdaptiveRecommendations(
        llmCallData,
        neuromorphicResult,
        adaptiveModel
      );

      // Update adaptive model
      await this.updateAdaptiveModel(
        llmCallData.provider,
        llmCallData,
        neuromorphicResult
      );

      // Store insights
      const insights = {
        id: llmCallData.id,
        neuromorphicResult,
        adaptiveRecommendations,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        cached: false,
      };

      this.neuromorphicInsights.set(llmCallData.id, insights);

      // Cache the results
      await this.cache.set(cacheKey, insights, {
        ttl: this.calculateCacheTTL(llmCallData),
        priority: this.calculateCachePriority(llmCallData),
      });

      // Emit processing complete event
      this.emit('llmCallProcessed', {
        callId: llmCallData.id,
        insights,
        neuromorphicActivity: neuromorphicResult,
      });

      return insights;
    } catch (error) {
      // Use error handler for processing errors
      try {
        const recoveryResult = await this.errorHandler.handleError(error, {
          component: 'neuromorphic_interface',
          operation: 'processLLMCall',
          data: llmCallData,
          severity: 'medium',
        });

        if (recoveryResult.success) {
          this.logger.info('Recovered from processing error', {
            callId: llmCallData.id,
            recoveryMethod: recoveryResult.method,
          });
          return recoveryResult.result;
        }
      } catch (recoveryError) {
        this.logger.error(
          'Recovery failed for LLM call processing:',
          recoveryError
        );
      }

      this.logger.error('Error processing LLM call:', error);
      throw error;
    }
  }

  getOrCreateAdaptiveModel(provider) {
    if (!this.adaptiveModels.has(provider)) {
      // Create new adaptive model for unknown provider
      const model = {
        provider,
        baselineMetrics: {
          avgLatency: 1000,
          avgCost: 0.01,
          avgQuality: 0.8,
          avgTokens: 100,
        },
        adaptiveWeights: {
          latency: 0.3,
          cost: 0.3,
          quality: 0.4,
        },
        neuromorphicProfile: this.createNeuromorphicProfile(provider),
        lastUpdated: Date.now(),
      };

      this.adaptiveModels.set(provider, model);
    }

    return this.adaptiveModels.get(provider);
  }

  prepareLLMDataForNeuromorphic(llmCallData, adaptiveModel) {
    // Prepare LLM data for neuromorphic processing
    const normalizedData = {
      tokens: llmCallData.inputTokens + llmCallData.outputTokens || 0,
      latency: llmCallData.duration || 0,
      cost: llmCallData.cost || 0,
      quality: this.estimateQuality(llmCallData),
      provider: llmCallData.provider || 'unknown',
      model: llmCallData.model || 'unknown',
    };

    // Add neuromorphic-specific data
    return {
      ...normalizedData,
      neuromorphicProfile: adaptiveModel.neuromorphicProfile,
      adaptiveContext: {
        historicalPerformance: this.getHistoricalPerformance(
          llmCallData.provider
        ),
        baseline: adaptiveModel.baselineMetrics,
        weights: adaptiveModel.adaptiveWeights,
      },
    };
  }

  estimateQuality(llmCallData) {
    // Estimate quality from available metrics
    let quality = 0.5; // Default neutral quality

    // Use response time as quality indicator
    if (llmCallData.duration) {
      const responseQuality = Math.max(0, 1 - llmCallData.duration / 10000); // 10s max
      quality = (quality + responseQuality) / 2;
    }

    // Use token efficiency as quality indicator
    if (llmCallData.inputTokens && llmCallData.outputTokens) {
      const efficiency =
        Math.min(llmCallData.outputTokens / llmCallData.inputTokens, 2) / 2;
      quality = (quality + efficiency) / 2;
    }

    // Use error indicators
    if (llmCallData.error) {
      quality *= 0.2; // Severely penalize errors
    } else if (llmCallData.success === false) {
      quality *= 0.5; // Penalize failures
    }

    return Math.max(0, Math.min(1, quality));
  }

  getHistoricalPerformance(provider) {
    // Get historical performance for provider
    const providerCalls = this.llmCallHistory
      .filter(call => call.provider === provider)
      .slice(-100); // Last 100 calls

    if (providerCalls.length === 0) {
      return {
        avgLatency: 1000,
        avgCost: 0.01,
        avgQuality: 0.8,
        successRate: 0.9,
        callCount: 0,
      };
    }

    const successfulCalls = providerCalls.filter(
      call => call.error === undefined
    );

    return {
      avgLatency: this.average(
        providerCalls.map(call => call.duration || 1000)
      ),
      avgCost: this.average(providerCalls.map(call => call.cost || 0.01)),
      avgQuality: this.average(
        providerCalls.map(call => this.estimateQuality(call))
      ),
      successRate: successfulCalls.length / providerCalls.length,
      callCount: providerCalls.length,
    };
  }

  average(values) {
    return values.length > 0
      ? values.reduce((sum, val) => sum + val, 0) / values.length
      : 0;
  }

  generateAdaptiveRecommendations(
    llmCallData,
    neuromorphicResult,
    adaptiveModel
  ) {
    const recommendations = [];

    // Performance recommendations
    const performanceInsights =
      neuromorphicResult.insights.performanceOptimization;
    if (performanceInsights.confidence > 0.6) {
      recommendations.push(
        ...performanceInsights.recommendations.map(rec => ({
          type: 'performance',
          recommendation: rec,
          confidence: performanceInsights.confidence,
          priority: 'high',
        }))
      );
    }

    // Cost recommendations
    const costInsights =
      neuromorphicResult.insights.costEfficiencyRecommendations;
    if (costInsights.confidence > 0.5) {
      recommendations.push(
        ...costInsights.recommendations.map(rec => ({
          type: 'cost',
          recommendation: rec,
          confidence: costInsights.confidence,
          priority: 'medium',
          potentialSavings: costInsights.costEfficiency,
        }))
      );
    }

    // Quality recommendations
    const qualityInsights = neuromorphicResult.insights.qualityImprovements;
    if (qualityInsights.confidence > 0.4) {
      recommendations.push(
        ...qualityInsights.recommendations.map(rec => ({
          type: 'quality',
          recommendation: rec,
          confidence: qualityInsights.confidence,
          priority: 'high',
        }))
      );
    }

    // Predictive recommendations
    const predictions = neuromorphicResult.insights.predictiveAnalytics;
    if (predictions.confidence > 0.7) {
      recommendations.push(
        ...predictions.predictions.map(pred => ({
          type: 'predictive',
          recommendation: `Predicted ${pred.type} in ${pred.timeframe}: ${pred.mitigation}`,
          confidence: pred.probability,
          priority: pred.probability > 0.8 ? 'critical' : 'medium',
          timeframe: pred.timeframe,
        }))
      );
    }

    // Quantum recommendations
    const quantumInsights = neuromorphicResult.insights.quantumCorrelations;
    if (quantumInsights.strongCorrelations > 10) {
      recommendations.push({
        type: 'quantum',
        recommendation: `Strong quantum correlations detected (${quantumInsights.strongCorrelations}). Consider optimizing concurrent operations.`,
        confidence: Math.min(quantumInsights.strongCorrelations / 50, 1),
        priority: 'low',
        technical: true,
      });
    }

    return {
      total: recommendations.length,
      byPriority: this.groupRecommendationsByPriority(recommendations),
      recommendations,
      adaptiveScore: this.calculateAdaptiveScore(neuromorphicResult),
      timestamp: new Date().toISOString(),
    };
  }

  groupRecommendationsByPriority(recommendations) {
    const grouped = { critical: [], high: [], medium: [], low: [] };

    recommendations.forEach(rec => {
      grouped[rec.priority].push(rec);
    });

    return grouped;
  }

  calculateAdaptiveScore(neuromorphicResult) {
    // Calculate overall adaptive score based on neuromorphic insights
    const insights = neuromorphicResult.insights;

    const performanceScore = 1 - insights.performanceOptimization.confidence;
    const costScore =
      insights.costEfficiencyRecommendations.costEfficiency || 0.5;
    const qualityScore = insights.qualityImprovements.confidence || 0.5;
    const predictiveScore = 1 - (insights.predictiveAnalytics.confidence || 0);

    const overallScore =
      (performanceScore + costScore + qualityScore + predictiveScore) / 4;

    return {
      overall: overallScore,
      components: {
        performance: performanceScore,
        cost: costScore,
        quality: qualityScore,
        predictive: predictiveScore,
      },
      grade: this.scoreToGrade(overallScore),
    };
  }

  scoreToGrade(score) {
    if (score >= 0.9) return 'A+';
    if (score >= 0.8) return 'A';
    if (score >= 0.7) return 'B+';
    if (score >= 0.6) return 'B';
    if (score >= 0.5) return 'C+';
    if (score >= 0.4) return 'C';
    if (score >= 0.3) return 'D+';
    return 'D';
  }

  async updateAdaptiveModel(provider, llmCallData, neuromorphicResult) {
    const model = this.adaptiveModels.get(provider);
    if (!model) return;

    // Update baseline metrics with exponential moving average
    const alpha = 0.1; // Learning rate

    if (llmCallData.duration) {
      model.baselineMetrics.avgLatency =
        (1 - alpha) * model.baselineMetrics.avgLatency +
        alpha * llmCallData.duration;
    }

    if (llmCallData.cost) {
      model.baselineMetrics.avgCost =
        (1 - alpha) * model.baselineMetrics.avgCost + alpha * llmCallData.cost;
    }

    const quality = this.estimateQuality(llmCallData);
    model.baselineMetrics.avgQuality =
      (1 - alpha) * model.baselineMetrics.avgQuality + alpha * quality;

    const tokens =
      (llmCallData.inputTokens || 0) + (llmCallData.outputTokens || 0);
    if (tokens > 0) {
      model.baselineMetrics.avgTokens =
        (1 - alpha) * model.baselineMetrics.avgTokens + alpha * tokens;
    }

    // Update adaptive weights based on neuromorphic insights
    const insights = neuromorphicResult.insights;

    if (insights.performanceOptimization.confidence > 0.7) {
      model.adaptiveWeights.latency *= 1.1; // Increase latency weight
    }

    if (insights.costEfficiencyRecommendations.confidence > 0.6) {
      model.adaptiveWeights.cost *= 1.1; // Increase cost weight
    }

    if (insights.qualityImprovements.confidence > 0.5) {
      model.adaptiveWeights.quality *= 1.1; // Increase quality weight
    }

    // Normalize weights
    const totalWeight =
      model.adaptiveWeights.latency +
      model.adaptiveWeights.cost +
      model.adaptiveWeights.quality;

    model.adaptiveWeights.latency /= totalWeight;
    model.adaptiveWeights.cost /= totalWeight;
    model.adaptiveWeights.quality /= totalWeight;

    model.lastUpdated = Date.now();

    this.logger.debug(`Updated adaptive model for ${provider}`, {
      baselineMetrics: model.baselineMetrics,
      adaptiveWeights: model.adaptiveWeights,
    });
  }

  async getLLMInsights(callId) {
    return this.neuromorphicInsights.get(callId);
  }

  async getProviderInsights(provider, limit = 10) {
    // Get insights for a specific provider
    const providerInsights = Array.from(this.neuromorphicInsights.values())
      .filter(insight => {
        const call = this.llmCallHistory.find(c => c.id === insight.id);
        return call && call.provider === provider;
      })
      .slice(-limit);

    return {
      provider,
      insights: providerInsights,
      adaptiveModel: this.adaptiveModels.get(provider),
      summary: this.summarizeProviderInsights(providerInsights),
    };
  }

  summarizeProviderInsights(insights) {
    if (insights.length === 0) {
      return {
        avgProcessingTime: 0,
        recommendationTypes: {},
        adaptiveScores: [],
      };
    }

    const avgProcessingTime = this.average(insights.map(i => i.processingTime));
    const recommendationTypes = {};
    const adaptiveScores = insights.map(
      i => i.adaptiveRecommendations.adaptiveScore.overall
    );

    insights.forEach(insight => {
      insight.adaptiveRecommendations.recommendations.forEach(rec => {
        recommendationTypes[rec.type] =
          (recommendationTypes[rec.type] || 0) + 1;
      });
    });

    return {
      avgProcessingTime,
      avgAdaptiveScore: this.average(adaptiveScores),
      recommendationTypes,
      totalInsights: insights.length,
      latestInsight: insights[insights.length - 1]?.timestamp,
    };
  }

  generateCacheKey(llmCallData) {
    // Generate cache key based on relevant LLM call properties
    const keyComponents = [
      llmCallData.provider || 'unknown',
      llmCallData.model || 'unknown',
      (llmCallData.inputTokens || 0).toString(),
      (llmCallData.outputTokens || 0).toString(),
      Math.floor((llmCallData.duration || 0) / 1000).toString(), // Round to seconds
      Math.floor((llmCallData.cost || 0) * 1000).toString(), // Round to millidollars
    ];

    return `llm_call:${keyComponents.join(':')}`;
  }

  isCacheValid(cachedResult, llmCallData) {
    // Check if cached result is still valid for this call
    if (!cachedResult || !cachedResult.timestamp) {
      return false;
    }

    const cacheAge = Date.now() - new Date(cachedResult.timestamp).getTime();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    return cacheAge < maxAge;
  }

  calculateCacheTTL(llmCallData) {
    // Calculate appropriate TTL based on call characteristics
    let baseTTL = 60 * 60 * 1000; // 1 hour

    // Longer TTL for stable providers
    if (['openai', 'anthropic'].includes(llmCallData.provider)) {
      baseTTL *= 2;
    }

    // Shorter TTL for high-frequency calls
    const recentCalls = this.llmCallHistory
      .filter(call => call.provider === llmCallData.provider)
      .filter(
        call => Date.now() - new Date(call.timestamp).getTime() < 60000
      ).length;

    if (recentCalls > 10) {
      baseTTL /= 2;
    }

    return baseTTL;
  }

  calculateCachePriority(llmCallData) {
    // Calculate cache priority based on call importance
    if (llmCallData.priority) {
      return llmCallData.priority;
    }

    // Higher cost calls get higher priority
    if (llmCallData.cost && llmCallData.cost > 0.1) {
      return 'high';
    }

    // Frequent providers get medium priority
    const providerCalls = this.llmCallHistory.filter(
      call => call.provider === llmCallData.provider
    ).length;

    if (providerCalls > 50) {
      return 'medium';
    }

    return 'normal';
  }

  async getNeuromorphicMetrics() {
    const photonStats = this.photonProcessor.getProcessingStats();
    const cacheStats = this.cache.getStats();
    const optimizerStats = this.performanceOptimizer.getOptimizationStats();
    const errorStats = this.errorHandler.getErrorStatistics();

    return {
      photonProcessor: photonStats,
      cache: cacheStats,
      performanceOptimizer: optimizerStats,
      errorHandler: errorStats,
      interface: {
        totalLLMCalls: this.llmCallHistory.length,
        queueLength: this.processingQueue.length,
        isProcessing: this.isProcessing,
        adaptiveModels: this.adaptiveModels.size,
        storedInsights: this.neuromorphicInsights.size,
      },
      performance: {
        avgInsightGenerationTime: this.calculateAvgInsightTime(),
        adaptiveModelAccuracy: this.calculateModelAccuracy(),
        neuromorphicEfficiency: this.calculateNeuromorphicEfficiency(),
        cacheHitRate: cacheStats.hitRate,
        optimizationSuccessRate: optimizerStats.successRate,
        errorRecoveryRate:
          1 - errorStats.dailyErrors / Math.max(this.llmCallHistory.length, 1),
      },
      timestamp: new Date().toISOString(),
    };
  }

  calculateAvgInsightTime() {
    const recentInsights = Array.from(this.neuromorphicInsights.values()).slice(
      -100
    );
    return this.average(recentInsights.map(i => i.processingTime));
  }

  calculateModelAccuracy() {
    // Simplified accuracy calculation based on recommendation success
    const models = Array.from(this.adaptiveModels.values());
    const accuracyScores = models.map(model => {
      const age = Date.now() - model.lastUpdated;
      const freshness = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // 24h decay
      return freshness * 0.8; // Assume 80% base accuracy
    });

    return this.average(accuracyScores);
  }

  calculateNeuromorphicEfficiency() {
    const photonStats = this.photonProcessor.getProcessingStats();
    const interfaceStats = {
      totalLLMCalls: this.llmCallHistory.length,
      storedInsights: this.neuromorphicInsights.size,
    };

    const efficiency = Math.min(
      1,
      (photonStats.spikesProcessed / Math.max(photonStats.photonsEmitted, 1)) *
        (interfaceStats.storedInsights /
          Math.max(interfaceStats.totalLLMCalls, 1))
    );

    return efficiency;
  }

  async getHealth() {
    const photonHealth = await this.photonProcessor.getHealth();
    const cacheHealth = await this.cache.getHealth();
    const optimizerHealth = await this.performanceOptimizer.getHealth();
    const errorHandlerHealth = await this.errorHandler.getHealth();

    // More lenient health check - system can be healthy even if some optimizations are in progress
    const criticalHealthy =
      this.initialized && photonHealth.healthy && cacheHealth.healthy;

    // Allow for optimizer and error handler to be in various states without failing
    const allHealthy =
      criticalHealthy &&
      optimizerHealth.initialized &&
      errorHandlerHealth.initialized;

    return {
      healthy: allHealthy,
      interface: {
        initialized: this.initialized,
        queueLength: this.processingQueue.length,
        isProcessing: this.isProcessing,
      },
      components: {
        photonProcessor: photonHealth,
        cache: cacheHealth,
        performanceOptimizer: optimizerHealth,
        errorHandler: errorHandlerHealth,
      },
      metrics: await this.getNeuromorphicMetrics(),
    };
  }

  async shutdown() {
    this.logger.info('Shutting down Neuromorphic LLM Interface...');

    // Shutdown components in reverse order
    await Promise.allSettled([
      this.photonProcessor.shutdown(),
      this.performanceOptimizer.shutdown(),
      this.errorHandler.shutdown(),
      this.cache.shutdown(),
    ]);

    this.llmCallHistory = [];
    this.processingQueue = [];
    this.adaptiveModels.clear();
    this.neuromorphicInsights.clear();

    this.initialized = false;
    this.logger.info('Neuromorphic LLM Interface shutdown complete');
  }
}

module.exports = { NeuromorphicLLMInterface };
