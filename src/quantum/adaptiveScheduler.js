/**
 * Adaptive Scheduler
 * Implements machine learning-based task scheduling optimization
 */

const { Logger } = require('../utils/logger');
const { ConfigManager } = require('../utils/config');

class AdaptiveScheduler {
    constructor(config = {}) {
        this.config = new ConfigManager(config);
        this.logger = new Logger({ component: 'AdaptiveScheduler' });
        
        // Learning parameters
        this.learningRate = config.learningRate || 0.01;
        this.explorationRate = config.explorationRate || 0.1;
        this.memorySize = config.memorySize || 1000;
        
        // Adaptive state
        this.executionHistory = [];
        this.performanceModel = new Map();
        this.resourcePredictions = new Map();
        this.adaptationRules = new Map();
        
        // Current execution context
        this.activeSchedules = new Map();
        this.resourceUtilization = new Map();
        this.performanceMetrics = new Map();
        
        this.initialized = false;
    }

    async initialize() {
        try {
            this.logger.info('Initializing Adaptive Scheduler...');
            
            // Initialize performance model with baseline values
            this.initializePerformanceModel();
            
            // Load historical data if available
            await this.loadHistoricalData();
            
            // Initialize resource prediction models
            this.initializeResourcePredictions();
            
            this.initialized = true;
            this.logger.info('Adaptive Scheduler initialized successfully');
            
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize Adaptive Scheduler:', error);
            throw error;
        }
    }

    /**
     * Schedule tasks using adaptive algorithms
     */
    async scheduleTask(task, context = {}) {
        if (!this.initialized) {
            throw new Error('Adaptive Scheduler not initialized');
        }

        const startTime = Date.now();
        this.logger.info(`Scheduling task: ${task.id} with adaptive optimization`);

        try {
            // Predict optimal execution parameters
            const predictions = await this.predictOptimalExecution(task, context);
            
            // Apply learned adaptation rules
            const adaptations = this.applyAdaptationRules(task, predictions, context);
            
            // Generate optimized schedule
            const schedule = this.generateOptimizedSchedule(task, adaptations, context);
            
            // Store schedule for tracking
            this.activeSchedules.set(task.id, {
                task,
                schedule,
                predictions,
                adaptations,
                startTime: new Date(),
                context
            });
            
            const duration = Date.now() - startTime;
            this.logger.info(`Task scheduled in ${duration}ms with ${adaptations.confidence}% confidence`);
            
            return schedule;
            
        } catch (error) {
            this.logger.error('Failed to schedule task:', error);
            throw error;
        }
    }

    /**
     * Predict optimal execution parameters using historical data
     */
    async predictOptimalExecution(task, context) {
        const taskSignature = this.generateTaskSignature(task);
        const historicalData = this.getHistoricalData(taskSignature);
        
        const predictions = {
            executionTime: this.predictExecutionTime(task, historicalData, context),
            resourceRequirement: this.predictResourceRequirement(task, historicalData, context),
            successProbability: this.predictSuccessProbability(task, historicalData, context),
            optimalStartTime: this.predictOptimalStartTime(task, context),
            resourceAvailability: this.predictResourceAvailability(task, context),
            dependencies: this.predictDependencyCompletionTimes(task, context)
        };
        
        // Add confidence intervals
        predictions.confidence = this.calculatePredictionConfidence(predictions, historicalData);
        
        return predictions;
    }

    /**
     * Generate task signature for pattern matching
     */
    generateTaskSignature(task) {
        const features = [
            task.type || 'unknown',
            Math.floor((task.estimatedDuration || 60) / 30) * 30, // Round to 30min buckets
            (task.priority || 0.5) > 0.7 ? 'high' : (task.priority || 0.5) > 0.3 ? 'medium' : 'low',
            (task.requiredResources || []).sort().join(','),
            task.complexity || 'medium'
        ];
        
        return features.join('|');
    }

    /**
     * Predict execution time using regression analysis
     */
    predictExecutionTime(task, historicalData, context) {
        const baseEstimate = task.estimatedDuration || 60;
        
        if (historicalData.length === 0) {
            return {
                mean: baseEstimate,
                min: baseEstimate * 0.7,
                max: baseEstimate * 1.5,
                confidence: 0.3
            };
        }
        
        // Calculate weighted average based on similarity
        let weightedSum = 0;
        let totalWeight = 0;
        
        historicalData.forEach(record => {
            const similarity = this.calculateTaskSimilarity(task, record.task);
            const weight = similarity * Math.exp(-this.getAgeWeight(record.timestamp));
            
            weightedSum += record.actualDuration * weight;
            totalWeight += weight;
        });
        
        const predictedDuration = totalWeight > 0 ? weightedSum / totalWeight : baseEstimate;
        const variance = this.calculateExecutionVariance(historicalData);
        
        return {
            mean: predictedDuration,
            min: Math.max(predictedDuration - variance, baseEstimate * 0.5),
            max: predictedDuration + variance,
            confidence: Math.min(totalWeight / 10, 1.0)
        };
    }

    /**
     * Predict resource requirements
     */
    predictResourceRequirement(task, historicalData, context) {
        const currentUtilization = this.getCurrentResourceUtilization();
        const baseRequirement = task.resourceRequirement || 1.0;
        
        // Adjust based on current system load
        const loadFactor = this.calculateSystemLoadFactor(currentUtilization);
        const adjustedRequirement = baseRequirement * loadFactor;
        
        // Factor in historical performance
        const historicalAdjustment = this.getHistoricalResourceAdjustment(task, historicalData);
        
        return {
            cpu: adjustedRequirement * (historicalAdjustment.cpu || 1.0),
            memory: adjustedRequirement * (historicalAdjustment.memory || 1.0),
            io: adjustedRequirement * (historicalAdjustment.io || 1.0),
            network: adjustedRequirement * (historicalAdjustment.network || 1.0),
            confidence: historicalData.length > 5 ? 0.8 : 0.4
        };
    }

    /**
     * Predict success probability
     */
    predictSuccessProbability(task, historicalData, context) {
        if (historicalData.length === 0) {
            return { probability: 0.8, confidence: 0.2 };
        }
        
        const successRate = historicalData.filter(r => r.success).length / historicalData.length;
        const recentSuccessRate = this.calculateRecentSuccessRate(historicalData);
        const contextualFactors = this.assessContextualRiskFactors(task, context);
        
        const adjustedProbability = successRate * 0.5 + recentSuccessRate * 0.3 + contextualFactors * 0.2;
        
        return {
            probability: Math.max(0.1, Math.min(0.99, adjustedProbability)),
            confidence: Math.min(historicalData.length / 20, 1.0)
        };
    }

    /**
     * Apply learned adaptation rules
     */
    applyAdaptationRules(task, predictions, context) {
        const adaptations = {
            priority: task.priority || 0.5,
            resourceAllocation: 1.0,
            executionStrategy: 'standard',
            retryPolicy: 'default',
            timeoutAdjustment: 1.0,
            confidence: 0.5
        };
        
        // Apply resource-based adaptations
        if (predictions.resourceRequirement.confidence > 0.6) {
            if (predictions.resourceRequirement.cpu > 1.5) {
                adaptations.resourceAllocation = 1.2;
                adaptations.executionStrategy = 'high_resource';
            }
        }
        
        // Apply success probability adaptations
        if (predictions.successProbability.probability < 0.6) {
            adaptations.retryPolicy = 'aggressive';
            adaptations.timeoutAdjustment = 1.5;
            adaptations.priority = Math.min(task.priority * 1.2, 1.0);
        }
        
        // Apply time pressure adaptations
        if (task.deadline && this.isDeadlineTight(task, predictions)) {
            adaptations.priority = Math.min(adaptations.priority * 1.3, 1.0);
            adaptations.executionStrategy = 'fast_track';
        }
        
        // Apply load balancing adaptations
        const systemLoad = this.getCurrentSystemLoad();
        if (systemLoad > 0.8) {
            adaptations.executionStrategy = 'load_balanced';
            adaptations.resourceAllocation = 0.8;
        }
        
        adaptations.confidence = this.calculateAdaptationConfidence(adaptations, predictions);
        
        return adaptations;
    }

    /**
     * Generate optimized schedule
     */
    generateOptimizedSchedule(task, adaptations, context) {
        const now = new Date();
        const predictedDuration = adaptations.executionTime || task.estimatedDuration || 60;
        
        const schedule = {
            taskId: task.id,
            scheduledStart: this.calculateOptimalStartTime(task, adaptations, context),
            estimatedDuration: predictedDuration * adaptations.timeoutAdjustment,
            actualDuration: null,
            priority: adaptations.priority,
            resourceAllocation: adaptations.resourceAllocation,
            executionStrategy: adaptations.executionStrategy,
            retryPolicy: adaptations.retryPolicy,
            status: 'scheduled',
            adaptations,
            createdAt: now,
            updatedAt: now
        };
        
        // Calculate estimated completion time
        schedule.estimatedCompletion = new Date(
            schedule.scheduledStart.getTime() + (schedule.estimatedDuration * 60000)
        );
        
        return schedule;
    }

    /**
     * Record task execution results for learning
     */
    async recordExecution(taskId, executionResult) {
        const schedule = this.activeSchedules.get(taskId);
        if (!schedule) {
            this.logger.warn(`No active schedule found for task: ${taskId}`);
            return;
        }

        const executionRecord = {
            taskId,
            task: schedule.task,
            schedule: schedule.schedule,
            predictions: schedule.predictions,
            adaptations: schedule.adaptations,
            result: executionResult,
            actualDuration: executionResult.duration,
            success: executionResult.success,
            resourceUsage: executionResult.resourceUsage,
            timestamp: new Date(),
            context: schedule.context
        };

        // Add to execution history
        this.executionHistory.push(executionRecord);
        
        // Maintain memory size limit
        if (this.executionHistory.length > this.memorySize) {
            this.executionHistory.shift();
        }

        // Update performance model
        await this.updatePerformanceModel(executionRecord);
        
        // Update adaptation rules
        this.updateAdaptationRules(executionRecord);
        
        // Clean up active schedule
        this.activeSchedules.delete(taskId);
        
        this.logger.info(`Recorded execution for task: ${taskId}, success: ${executionResult.success}`);
    }

    /**
     * Update performance model with new data
     */
    async updatePerformanceModel(executionRecord) {
        const taskSignature = this.generateTaskSignature(executionRecord.task);
        
        if (!this.performanceModel.has(taskSignature)) {
            this.performanceModel.set(taskSignature, {
                executions: [],
                avgDuration: 0,
                successRate: 0,
                resourceUsage: { cpu: 0, memory: 0, io: 0, network: 0 },
                lastUpdated: new Date()
            });
        }
        
        const model = this.performanceModel.get(taskSignature);
        model.executions.push(executionRecord);
        
        // Maintain sliding window
        const maxExecutions = 100;
        if (model.executions.length > maxExecutions) {
            model.executions = model.executions.slice(-maxExecutions);
        }
        
        // Update aggregated metrics
        const executions = model.executions;
        model.avgDuration = executions.reduce((sum, e) => sum + e.actualDuration, 0) / executions.length;
        model.successRate = executions.filter(e => e.success).length / executions.length;
        
        // Update resource usage averages
        ['cpu', 'memory', 'io', 'network'].forEach(resource => {
            const usages = executions.map(e => e.resourceUsage?.[resource] || 0).filter(u => u > 0);
            model.resourceUsage[resource] = usages.length > 0 ? 
                usages.reduce((sum, u) => sum + u, 0) / usages.length : 0;
        });
        
        model.lastUpdated = new Date();
    }

    /**
     * Update adaptation rules based on results
     */
    updateAdaptationRules(executionRecord) {
        const ruleKey = this.generateRuleKey(executionRecord);
        
        if (!this.adaptationRules.has(ruleKey)) {
            this.adaptationRules.set(ruleKey, {
                applications: 0,
                successes: 0,
                totalImprovement: 0,
                avgImprovement: 0,
                confidence: 0
            });
        }
        
        const rule = this.adaptationRules.get(ruleKey);
        rule.applications++;
        
        if (executionRecord.success) {
            rule.successes++;
            
            // Calculate improvement over baseline
            const baseline = executionRecord.task.estimatedDuration || 60;
            const actual = executionRecord.actualDuration;
            const improvement = Math.max(0, (baseline - actual) / baseline);
            
            rule.totalImprovement += improvement;
            rule.avgImprovement = rule.totalImprovement / rule.successes;
        }
        
        rule.confidence = Math.min(rule.applications / 10, 1.0);
        
        // Remove low-performing rules
        if (rule.applications > 20 && rule.successes / rule.applications < 0.3) {
            this.adaptationRules.delete(ruleKey);
        }
    }

    /**
     * Get adaptive scheduling metrics
     */
    getAdaptiveMetrics() {
        const recentExecutions = this.executionHistory.slice(-100);
        
        return {
            totalExecutions: this.executionHistory.length,
            recentSuccessRate: recentExecutions.length > 0 ? 
                recentExecutions.filter(e => e.success).length / recentExecutions.length : 0,
            avgPredictionAccuracy: this.calculatePredictionAccuracy(recentExecutions),
            adaptationRules: this.adaptationRules.size,
            performanceModels: this.performanceModel.size,
            activeSchedules: this.activeSchedules.size,
            learningRate: this.learningRate,
            explorationRate: this.explorationRate
        };
    }

    /**
     * Helper methods
     */
    initializePerformanceModel() {
        // Initialize with common task patterns
        const commonPatterns = [
            'api_call|60|medium||medium',
            'data_processing|120|high|cpu,memory|high',
            'file_operation|30|low|io|low',
            'network_request|45|medium|network|medium'
        ];
        
        commonPatterns.forEach(pattern => {
            this.performanceModel.set(pattern, {
                executions: [],
                avgDuration: 60,
                successRate: 0.8,
                resourceUsage: { cpu: 1, memory: 1, io: 1, network: 1 },
                lastUpdated: new Date()
            });
        });
    }

    async loadHistoricalData() {
        // In a real implementation, this would load from persistent storage
        this.logger.info('Historical data loading completed (simulated)');
    }

    initializeResourcePredictions() {
        const resources = ['cpu', 'memory', 'io', 'network'];
        resources.forEach(resource => {
            this.resourcePredictions.set(resource, {
                baseline: 1.0,
                trend: 0.0,
                volatility: 0.1,
                lastUpdate: new Date()
            });
        });
    }

    getHistoricalData(taskSignature) {
        return this.executionHistory.filter(record => 
            this.generateTaskSignature(record.task) === taskSignature
        );
    }

    calculateTaskSimilarity(task1, task2) {
        let similarity = 0;
        let factors = 0;
        
        // Type similarity
        if (task1.type === task2.type) similarity += 0.3;
        factors += 0.3;
        
        // Duration similarity
        const duration1 = task1.estimatedDuration || 60;
        const duration2 = task2.estimatedDuration || 60;
        const durationSim = 1 - Math.abs(duration1 - duration2) / Math.max(duration1, duration2);
        similarity += durationSim * 0.25;
        factors += 0.25;
        
        // Priority similarity
        const priority1 = task1.priority || 0.5;
        const priority2 = task2.priority || 0.5;
        const prioritySim = 1 - Math.abs(priority1 - priority2);
        similarity += prioritySim * 0.2;
        factors += 0.2;
        
        // Resource similarity
        const resources1 = new Set(task1.requiredResources || []);
        const resources2 = new Set(task2.requiredResources || []);
        const intersection = new Set([...resources1].filter(r => resources2.has(r)));
        const union = new Set([...resources1, ...resources2]);
        const resourceSim = union.size > 0 ? intersection.size / union.size : 1;
        similarity += resourceSim * 0.25;
        factors += 0.25;
        
        return factors > 0 ? similarity / factors : 0;
    }

    getAgeWeight(timestamp) {
        const age = Date.now() - new Date(timestamp).getTime();
        const dayInMs = 24 * 60 * 60 * 1000;
        return age / dayInMs; // Weight decreases with age in days
    }

    calculateExecutionVariance(historicalData) {
        if (historicalData.length < 2) return 30; // Default variance
        
        const durations = historicalData.map(r => r.actualDuration);
        const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
        
        return Math.sqrt(variance);
    }

    getCurrentResourceUtilization() {
        // Simulate current resource utilization
        return {
            cpu: Math.random() * 0.8 + 0.1,
            memory: Math.random() * 0.7 + 0.2,
            io: Math.random() * 0.6 + 0.1,
            network: Math.random() * 0.5 + 0.1
        };
    }

    calculateSystemLoadFactor(utilization) {
        const avgUtilization = (utilization.cpu + utilization.memory + utilization.io + utilization.network) / 4;
        return 1 + (avgUtilization * 0.5); // Increase requirements as load increases
    }

    getHistoricalResourceAdjustment(task, historicalData) {
        const adjustments = { cpu: 1.0, memory: 1.0, io: 1.0, network: 1.0 };
        
        if (historicalData.length === 0) return adjustments;
        
        ['cpu', 'memory', 'io', 'network'].forEach(resource => {
            const usages = historicalData.map(r => r.resourceUsage?.[resource]).filter(u => u != null);
            if (usages.length > 0) {
                const avgUsage = usages.reduce((sum, u) => sum + u, 0) / usages.length;
                adjustments[resource] = Math.max(0.5, Math.min(2.0, avgUsage));
            }
        });
        
        return adjustments;
    }

    calculateRecentSuccessRate(historicalData) {
        const recentData = historicalData.slice(-10); // Last 10 executions
        if (recentData.length === 0) return 0.8;
        
        return recentData.filter(r => r.success).length / recentData.length;
    }

    assessContextualRiskFactors(task, context) {
        let riskScore = 0.8; // Baseline
        
        // Time pressure risk
        if (task.deadline && this.isDeadlineTight(task, { executionTime: { mean: task.estimatedDuration || 60 } })) {
            riskScore -= 0.1;
        }
        
        // System load risk
        const systemLoad = this.getCurrentSystemLoad();
        if (systemLoad > 0.8) riskScore -= 0.15;
        
        // Complexity risk
        if (task.complexity === 'high') riskScore -= 0.1;
        if (task.complexity === 'low') riskScore += 0.05;
        
        return Math.max(0.1, Math.min(1.0, riskScore));
    }

    isDeadlineTight(task, predictions) {
        if (!task.deadline) return false;
        
        const deadline = new Date(task.deadline);
        const now = new Date();
        const timeAvailable = deadline.getTime() - now.getTime();
        const timeRequired = (predictions.executionTime?.mean || task.estimatedDuration || 60) * 60000;
        
        return timeAvailable < timeRequired * 1.5; // Less than 1.5x required time
    }

    getCurrentSystemLoad() {
        const utilization = this.getCurrentResourceUtilization();
        return (utilization.cpu + utilization.memory + utilization.io + utilization.network) / 4;
    }

    calculateOptimalStartTime(task, adaptations, context) {
        const now = new Date();
        
        // Consider deadline constraints
        if (task.deadline) {
            const deadline = new Date(task.deadline);
            const requiredTime = adaptations.executionTime || task.estimatedDuration || 60;
            const latestStart = new Date(deadline.getTime() - (requiredTime * 60000));
            
            if (latestStart < now) {
                return now; // Start immediately if deadline is tight
            }
        }
        
        // Consider resource availability predictions
        const resourceAvailabilityWindow = this.findNextResourceWindow(task, adaptations);
        
        return resourceAvailabilityWindow || now;
    }

    findNextResourceWindow(task, adaptations) {
        // Simplified resource window calculation
        const now = new Date();
        const systemLoad = this.getCurrentSystemLoad();
        
        if (systemLoad < 0.6) {
            return now; // Start now if system load is low
        }
        
        // Wait for better resource availability (simplified)
        return new Date(now.getTime() + (30 * 60000)); // Wait 30 minutes
    }

    calculateAdaptationConfidence(adaptations, predictions) {
        const confidences = [
            predictions.executionTime?.confidence || 0.5,
            predictions.resourceRequirement?.confidence || 0.5,
            predictions.successProbability?.confidence || 0.5
        ];
        
        return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    }

    calculatePredictionConfidence(predictions, historicalData) {
        const dataPoints = historicalData.length;
        const baseConfidence = Math.min(dataPoints / 20, 1.0);
        
        // Adjust based on prediction consistency
        if (dataPoints > 5) {
            const variance = this.calculateExecutionVariance(historicalData);
            const avgDuration = historicalData.reduce((sum, r) => sum + r.actualDuration, 0) / historicalData.length;
            const consistencyFactor = Math.max(0.1, 1 - (variance / avgDuration));
            
            return baseConfidence * consistencyFactor;
        }
        
        return baseConfidence;
    }

    generateRuleKey(executionRecord) {
        const adaptations = executionRecord.adaptations;
        return [
            adaptations.executionStrategy,
            adaptations.resourceAllocation > 1.1 ? 'high_resource' : 'normal_resource',
            adaptations.priority > 0.7 ? 'high_priority' : 'normal_priority',
            adaptations.retryPolicy
        ].join('|');
    }

    calculatePredictionAccuracy(executions) {
        if (executions.length === 0) return 0;
        
        let totalAccuracy = 0;
        let validPredictions = 0;
        
        executions.forEach(execution => {
            if (execution.predictions?.executionTime?.mean && execution.actualDuration) {
                const predicted = execution.predictions.executionTime.mean;
                const actual = execution.actualDuration;
                const accuracy = 1 - Math.abs(predicted - actual) / Math.max(predicted, actual);
                
                totalAccuracy += Math.max(0, accuracy);
                validPredictions++;
            }
        });
        
        return validPredictions > 0 ? totalAccuracy / validPredictions : 0;
    }

    /**
     * Health check
     */
    async getHealth() {
        return {
            healthy: this.initialized,
            executionHistory: this.executionHistory.length,
            performanceModels: this.performanceModel.size,
            adaptationRules: this.adaptationRules.size,
            activeSchedules: this.activeSchedules.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Shutdown
     */
    async shutdown() {
        this.logger.info('Shutting down Adaptive Scheduler...');
        
        this.activeSchedules.clear();
        this.initialized = false;
        
        this.logger.info('Adaptive Scheduler shutdown complete');
    }
}

module.exports = { AdaptiveScheduler };