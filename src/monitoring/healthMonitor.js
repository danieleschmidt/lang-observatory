/**
 * Advanced Health Monitoring System
 * Comprehensive system health tracking with predictive analytics
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');
const { MetricsManager } = require('../services/metricsService');

class HealthMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            checkInterval: 30000, // 30 seconds
            enablePredictiveAnalysis: true,
            enableAlerts: true,
            criticalThresholds: {
                cpu: 0.9,
                memory: 0.85,
                disk: 0.9,
                responseTime: 5000,
                errorRate: 0.1
            },
            warningThresholds: {
                cpu: 0.7,
                memory: 0.7,
                disk: 0.8,
                responseTime: 2000,
                errorRate: 0.05
            },
            ...config
        };
        
        this.logger = new Logger({ service: 'health-monitor' });
        this.metrics = new MetricsManager(config.metrics || {});
        
        // Health state
        this.componentStatuses = new Map();
        this.healthHistory = [];
        this.alertsSent = new Set();
        this.checkTimer = null;
        
        // Predictive models
        this.trendAnalyzer = new TrendAnalyzer();
        this.anomalyDetector = new HealthAnomalyDetector();
        
        this.initialized = false;
    }

    async initialize() {
        try {
            await this.metrics.initialize();
            await this.trendAnalyzer.initialize();
            await this.anomalyDetector.initialize();
            
            // Register default health checks
            this.registerDefaultHealthChecks();
            
            // Start monitoring
            this.startPeriodicChecks();
            
            this.initialized = true;
            this.logger.info('Health Monitor initialized');
            
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize Health Monitor:', error);
            throw error;
        }
    }

    registerDefaultHealthChecks() {
        // System resources
        this.registerHealthCheck('system', async () => {
            const usage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            return {
                healthy: usage.heapUsed / usage.heapTotal < this.config.criticalThresholds.memory,
                metrics: {
                    memoryUsage: usage.heapUsed / usage.heapTotal,
                    heapUsed: usage.heapUsed,
                    heapTotal: usage.heapTotal,
                    external: usage.external,
                    cpuUser: cpuUsage.user,
                    cpuSystem: cpuUsage.system,
                    uptime: process.uptime()
                },
                timestamp: new Date().toISOString()
            };
        });

        // Database connectivity
        this.registerHealthCheck('database', async () => {
            try {
                // Simulate database check
                const startTime = Date.now();
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                const responseTime = Date.now() - startTime;
                
                return {
                    healthy: responseTime < this.config.criticalThresholds.responseTime,
                    metrics: {
                        responseTime,
                        connectionPool: {
                            active: Math.floor(Math.random() * 10),
                            idle: Math.floor(Math.random() * 5),
                            total: 15
                        }
                    },
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                return {
                    healthy: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        });

        // External services
        this.registerHealthCheck('langfuse', async () => {
            try {
                const startTime = Date.now();
                // Simulate Langfuse health check
                await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
                const responseTime = Date.now() - startTime;
                
                return {
                    healthy: responseTime < this.config.criticalThresholds.responseTime,
                    metrics: {
                        responseTime,
                        apiVersion: '2.54.0',
                        lastSync: new Date(Date.now() - Math.random() * 300000).toISOString()
                    },
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                return {
                    healthy: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        });

        // OpenTelemetry Collector
        this.registerHealthCheck('openlit', async () => {
            try {
                const startTime = Date.now();
                await new Promise(resolve => setTimeout(resolve, Math.random() * 150));
                const responseTime = Date.now() - startTime;
                
                return {
                    healthy: responseTime < this.config.criticalThresholds.responseTime,
                    metrics: {
                        responseTime,
                        tracesReceived: Math.floor(Math.random() * 1000),
                        metricsExported: Math.floor(Math.random() * 5000),
                        batchSize: Math.floor(Math.random() * 100) + 50
                    },
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                return {
                    healthy: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        });

        // Quantum components
        this.registerHealthCheck('quantum-planner', async () => {
            const efficiency = Math.random() * 0.3 + 0.7; // 70-100%
            return {
                healthy: efficiency > 0.8,
                metrics: {
                    quantumEfficiency: efficiency,
                    tasksPlanned: Math.floor(Math.random() * 100),
                    quantumStates: Math.floor(Math.random() * 50) + 10,
                    coherenceTime: Math.random() * 1000 + 500
                },
                timestamp: new Date().toISOString()
            };
        });

        // Neuromorphic components
        this.registerHealthCheck('neuromorphic-interface', async () => {
            const processingRate = Math.random() * 100 + 50;
            return {
                healthy: processingRate > 30,
                metrics: {
                    processingRate,
                    neuronActivity: Math.random() * 100,
                    synapticWeight: Math.random(),
                    adaptiveModels: Math.floor(Math.random() * 5) + 3
                },
                timestamp: new Date().toISOString()
            };
        });
    }

    registerHealthCheck(name, checkFunction) {
        if (typeof checkFunction !== 'function') {
            throw new Error('Health check must be a function');
        }

        this.componentStatuses.set(name, {
            name,
            checkFunction,
            lastCheck: null,
            status: 'unknown',
            consecutiveFailures: 0,
            totalChecks: 0,
            successCount: 0
        });

        this.logger.info(`Registered health check: ${name}`);
    }

    async runHealthCheck(componentName) {
        const component = this.componentStatuses.get(componentName);
        if (!component) {
            throw new Error(`Unknown health check: ${componentName}`);
        }

        const startTime = Date.now();
        
        try {
            const result = await Promise.race([
                component.checkFunction(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), 10000)
                )
            ]);

            const duration = Date.now() - startTime;
            
            // Update component status
            component.lastCheck = new Date().toISOString();
            component.totalChecks++;
            
            if (result.healthy) {
                component.status = 'healthy';
                component.consecutiveFailures = 0;
                component.successCount++;
            } else {
                component.status = 'unhealthy';
                component.consecutiveFailures++;
            }

            // Enhanced result with metadata
            const enhancedResult = {
                ...result,
                component: componentName,
                duration,
                consecutiveFailures: component.consecutiveFailures,
                successRate: component.successCount / component.totalChecks
            };

            // Record metrics
            await this.recordHealthMetrics(componentName, enhancedResult);

            return enhancedResult;

        } catch (error) {
            const duration = Date.now() - startTime;
            
            component.lastCheck = new Date().toISOString();
            component.totalChecks++;
            component.status = 'error';
            component.consecutiveFailures++;

            const errorResult = {
                component: componentName,
                healthy: false,
                error: error.message,
                duration,
                consecutiveFailures: component.consecutiveFailures,
                successRate: component.successCount / component.totalChecks,
                timestamp: new Date().toISOString()
            };

            await this.recordHealthMetrics(componentName, errorResult);
            return errorResult;
        }
    }

    async runAllHealthChecks() {
        const results = new Map();
        const promises = [];

        // Run all health checks in parallel
        for (const componentName of this.componentStatuses.keys()) {
            promises.push(
                this.runHealthCheck(componentName)
                    .then(result => results.set(componentName, result))
                    .catch(error => results.set(componentName, {
                        component: componentName,
                        healthy: false,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }))
            );
        }

        await Promise.allSettled(promises);

        // Calculate overall health
        const overallHealth = this.calculateOverallHealth(results);
        
        // Add to history
        this.addToHistory(overallHealth);

        // Run predictive analysis
        if (this.config.enablePredictiveAnalysis) {
            await this.runPredictiveAnalysis(overallHealth);
        }

        // Check for alerts
        if (this.config.enableAlerts) {
            await this.checkAlerts(overallHealth);
        }

        return overallHealth;
    }

    calculateOverallHealth(componentResults) {
        const components = {};
        let healthyCount = 0;
        let totalCount = 0;
        let criticalIssues = [];
        let warnings = [];

        for (const [name, result] of componentResults.entries()) {
            components[name] = result;
            totalCount++;
            
            if (result.healthy) {
                healthyCount++;
            } else {
                if (result.consecutiveFailures >= 3) {
                    criticalIssues.push({
                        component: name,
                        issue: result.error || 'Component unhealthy',
                        consecutiveFailures: result.consecutiveFailures
                    });
                } else {
                    warnings.push({
                        component: name,
                        issue: result.error || 'Component unhealthy'
                    });
                }
            }
        }

        const healthPercentage = totalCount > 0 ? (healthyCount / totalCount) : 0;
        
        let status = 'healthy';
        if (criticalIssues.length > 0 || healthPercentage < 0.5) {
            status = 'critical';
        } else if (warnings.length > 0 || healthPercentage < 0.8) {
            status = 'degraded';
        }

        return {
            status,
            healthPercentage,
            components,
            criticalIssues,
            warnings,
            summary: {
                total: totalCount,
                healthy: healthyCount,
                unhealthy: totalCount - healthyCount
            },
            timestamp: new Date().toISOString()
        };
    }

    async recordHealthMetrics(componentName, result) {
        try {
            const metrics = [
                {
                    name: `health.${componentName}.status`,
                    value: result.healthy ? 1 : 0,
                    timestamp: result.timestamp,
                    tags: { component: componentName }
                },
                {
                    name: `health.${componentName}.duration`,
                    value: result.duration || 0,
                    timestamp: result.timestamp,
                    tags: { component: componentName }
                },
                {
                    name: `health.${componentName}.consecutive_failures`,
                    value: result.consecutiveFailures || 0,
                    timestamp: result.timestamp,
                    tags: { component: componentName }
                },
                {
                    name: `health.${componentName}.success_rate`,
                    value: result.successRate || 0,
                    timestamp: result.timestamp,
                    tags: { component: componentName }
                }
            ];

            // Add component-specific metrics
            if (result.metrics) {
                for (const [key, value] of Object.entries(result.metrics)) {
                    if (typeof value === 'number') {
                        metrics.push({
                            name: `health.${componentName}.${key}`,
                            value,
                            timestamp: result.timestamp,
                            tags: { component: componentName }
                        });
                    }
                }
            }

            await Promise.all(metrics.map(metric => 
                this.metrics.recordCustomMetric(`health-${componentName}`, metric)
                    .catch(error => this.logger.warn('Failed to record health metric:', error))
            ));

        } catch (error) {
            this.logger.error('Error recording health metrics:', error);
        }
    }

    addToHistory(healthStatus) {
        this.healthHistory.push(healthStatus);
        
        // Keep only last 100 entries
        if (this.healthHistory.length > 100) {
            this.healthHistory.shift();
        }
    }

    async runPredictiveAnalysis(currentHealth) {
        try {
            if (this.healthHistory.length < 5) return;

            // Analyze trends
            const trends = await this.trendAnalyzer.analyze(this.healthHistory);
            
            // Detect anomalies
            const anomalies = await this.anomalyDetector.detect(currentHealth, this.healthHistory);

            // Predictions
            const predictions = {
                trends,
                anomalies,
                forecast: this.generateForecast(trends),
                recommendations: this.generateRecommendations(trends, anomalies)
            };

            this.emit('predictiveAnalysis', predictions);

        } catch (error) {
            this.logger.error('Error in predictive analysis:', error);
        }
    }

    generateForecast(trends) {
        const forecast = {};
        
        for (const [component, trend] of Object.entries(trends)) {
            if (trend.direction === 'declining' && trend.confidence > 0.7) {
                forecast[component] = {
                    prediction: 'degradation',
                    timeframe: '1-2 hours',
                    confidence: trend.confidence
                };
            } else if (trend.direction === 'stable' && trend.variance > 0.3) {
                forecast[component] = {
                    prediction: 'instability',
                    timeframe: '30-60 minutes',
                    confidence: trend.confidence * 0.8
                };
            }
        }
        
        return forecast;
    }

    generateRecommendations(trends, anomalies) {
        const recommendations = [];

        // Based on trends
        for (const [component, trend] of Object.entries(trends)) {
            if (trend.direction === 'declining') {
                recommendations.push({
                    type: 'preventive',
                    component,
                    action: `Investigate ${component} performance degradation`,
                    priority: trend.confidence > 0.8 ? 'high' : 'medium'
                });
            }
        }

        // Based on anomalies
        for (const anomaly of anomalies) {
            recommendations.push({
                type: 'reactive',
                component: anomaly.component,
                action: `Check ${anomaly.component} for unusual behavior: ${anomaly.description}`,
                priority: anomaly.severity
            });
        }

        return recommendations;
    }

    async checkAlerts(healthStatus) {
        const now = Date.now();
        
        // Critical alerts
        for (const issue of healthStatus.criticalIssues) {
            const alertKey = `critical:${issue.component}`;
            const lastAlert = this.alertsSent.get(alertKey);
            
            // Send alert if not sent in last 5 minutes
            if (!lastAlert || now - lastAlert > 300000) {
                this.emit('criticalAlert', {
                    level: 'critical',
                    component: issue.component,
                    message: `Critical issue with ${issue.component}: ${issue.issue}`,
                    consecutiveFailures: issue.consecutiveFailures,
                    timestamp: new Date().toISOString()
                });
                
                this.alertsSent.set(alertKey, now);
            }
        }

        // Warning alerts
        for (const warning of healthStatus.warnings) {
            const alertKey = `warning:${warning.component}`;
            const lastAlert = this.alertsSent.get(alertKey);
            
            // Send alert if not sent in last 15 minutes
            if (!lastAlert || now - lastAlert > 900000) {
                this.emit('warningAlert', {
                    level: 'warning',
                    component: warning.component,
                    message: `Warning for ${warning.component}: ${warning.issue}`,
                    timestamp: new Date().toISOString()
                });
                
                this.alertsSent.set(alertKey, now);
            }
        }

        // Recovery alerts
        for (const [component, result] of Object.entries(healthStatus.components)) {
            if (result.healthy) {
                const criticalKey = `critical:${component}`;
                const warningKey = `warning:${component}`;
                
                if (this.alertsSent.has(criticalKey) || this.alertsSent.has(warningKey)) {
                    this.emit('recoveryAlert', {
                        level: 'info',
                        component,
                        message: `${component} has recovered`,
                        timestamp: new Date().toISOString()
                    });
                    
                    this.alertsSent.delete(criticalKey);
                    this.alertsSent.delete(warningKey);
                }
            }
        }
    }

    startPeriodicChecks() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }

        this.checkTimer = setInterval(async () => {
            try {
                const health = await this.runAllHealthChecks();
                this.emit('healthUpdate', health);
            } catch (error) {
                this.logger.error('Error during periodic health check:', error);
            }
        }, this.config.checkInterval);

        this.logger.info(`Started periodic health checks every ${this.config.checkInterval}ms`);
    }

    stopPeriodicChecks() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            this.logger.info('Stopped periodic health checks');
        }
    }

    getHealthSummary() {
        if (this.healthHistory.length === 0) {
            return { status: 'unknown', message: 'No health data available' };
        }

        const latest = this.healthHistory[this.healthHistory.length - 1];
        return {
            status: latest.status,
            healthPercentage: latest.healthPercentage,
            totalComponents: latest.summary.total,
            healthyComponents: latest.summary.healthy,
            criticalIssues: latest.criticalIssues.length,
            warnings: latest.warnings.length,
            lastUpdate: latest.timestamp
        };
    }

    getComponentHistory(componentName, hours = 1) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        
        return this.healthHistory
            .filter(entry => new Date(entry.timestamp).getTime() > cutoff)
            .map(entry => ({
                timestamp: entry.timestamp,
                status: entry.components[componentName]?.healthy || false,
                metrics: entry.components[componentName]?.metrics || {}
            }));
    }

    async shutdown() {
        this.logger.info('Shutting down Health Monitor...');
        
        this.stopPeriodicChecks();
        this.removeAllListeners();
        
        if (this.metrics) {
            await this.metrics.shutdown();
        }
        
        this.logger.info('Health Monitor shutdown complete');
    }
}

// Trend Analysis Helper
class TrendAnalyzer {
    async initialize() {
        this.windowSize = 10; // Analyze last 10 data points
    }

    async analyze(healthHistory) {
        if (healthHistory.length < this.windowSize) {
            return {};
        }

        const trends = {};
        const recent = healthHistory.slice(-this.windowSize);
        
        // Get all component names
        const componentNames = new Set();
        recent.forEach(entry => {
            Object.keys(entry.components).forEach(name => componentNames.add(name));
        });

        // Analyze each component
        for (const componentName of componentNames) {
            const values = recent.map(entry => 
                entry.components[componentName]?.successRate || 0
            );
            
            trends[componentName] = this.calculateTrend(values);
        }

        return trends;
    }

    calculateTrend(values) {
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((sum, val) => sum + val, 0);
        const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
        const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const variance = values.reduce((sum, val, i) => {
            const predicted = slope * i + intercept;
            return sum + Math.pow(val - predicted, 2);
        }, 0) / n;

        return {
            direction: slope > 0.01 ? 'improving' : slope < -0.01 ? 'declining' : 'stable',
            slope,
            confidence: Math.max(0, 1 - variance),
            variance
        };
    }
}

// Anomaly Detection Helper
class HealthAnomalyDetector {
    async initialize() {
        this.threshold = 2.0; // Standard deviations
    }

    async detect(currentHealth, healthHistory) {
        const anomalies = [];
        
        if (healthHistory.length < 5) return anomalies;

        const recent = healthHistory.slice(-20); // Last 20 entries
        
        for (const [componentName, result] of Object.entries(currentHealth.components)) {
            const historicalValues = recent.map(entry => 
                entry.components[componentName]?.duration || 0
            ).filter(val => val > 0);

            if (historicalValues.length < 3) continue;

            const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
            const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
            const stdDev = Math.sqrt(variance);

            const currentValue = result.duration || 0;
            const zScore = Math.abs((currentValue - mean) / stdDev);

            if (zScore > this.threshold) {
                anomalies.push({
                    component: componentName,
                    type: 'response_time',
                    description: `Unusual response time: ${currentValue}ms (expected: ${mean.toFixed(0)}ms ± ${stdDev.toFixed(0)})`,
                    severity: zScore > 3 ? 'high' : 'medium',
                    zScore
                });
            }
        }

        return anomalies;
    }
}

module.exports = { HealthMonitor, TrendAnalyzer, HealthAnomalyDetector };