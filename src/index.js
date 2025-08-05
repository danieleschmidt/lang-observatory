/**
 * Lang Observatory - Main Entry Point
 * A turnkey observability stack for Large Language Model applications
 */

const { LangfuseTracer } = require('./services/langfuseService');
const { OpenLITCollector } = require('./services/openlitService');
const { MetricsManager } = require('./services/metricsService');
const { QuantumTaskPlanner } = require('./quantum/quantumTaskPlanner');
const { AdaptiveScheduler } = require('./quantum/adaptiveScheduler');
const { ConfigManager } = require('./utils/config');
const { Logger } = require('./utils/logger');

class LangObservatory {
    constructor(config = {}) {
        this.config = new ConfigManager(config);
        this.logger = new Logger(this.config.get('logging', {}));
        
        // Initialize core services
        this.tracer = new LangfuseTracer(this.config.get('langfuse', {}));
        this.collector = new OpenLITCollector(this.config.get('openlit', {}));
        this.metrics = new MetricsManager(this.config.get('metrics', {}));
        
        // Initialize quantum-inspired components
        this.quantumPlanner = new QuantumTaskPlanner(this.config.get('quantum', {}));
        this.adaptiveScheduler = new AdaptiveScheduler(this.config.get('adaptive', {}));
        
        this.initialized = false;
    }

    async initialize() {
        try {
            this.logger.info('Initializing Lang Observatory...');
            
            // Initialize services in dependency order
            await this.tracer.initialize();
            await this.collector.initialize();
            await this.metrics.initialize();
            await this.quantumPlanner.initialize();
            await this.adaptiveScheduler.initialize();
            
            this.initialized = true;
            this.logger.info('Lang Observatory initialized successfully');
            
            return this;
        } catch (error) {
            this.logger.error('Failed to initialize Lang Observatory:', error);
            throw error;
        }
    }

    async trace(operation, callback, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Lang Observatory not initialized. Call initialize() first.');
        }

        const traceId = this.tracer.startTrace(operation, metadata);
        const startTime = Date.now();

        try {
            // Start metrics collection
            this.metrics.startOperation(operation, traceId);
            
            // Execute the operation
            const result = await callback();
            
            // Record successful completion
            const duration = Date.now() - startTime;
            this.tracer.endTrace(traceId, { success: true, duration, result: typeof result });
            this.metrics.recordSuccess(operation, duration, traceId);
            
            return result;
        } catch (error) {
            // Record failure
            const duration = Date.now() - startTime;
            this.tracer.endTrace(traceId, { success: false, duration, error: error.message });
            this.metrics.recordError(operation, duration, error, traceId);
            
            throw error;
        }
    }

    async recordLLMCall(provider, model, input, output, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Lang Observatory not initialized. Call initialize() first.');
        }

        const callData = {
            provider,
            model,
            input,
            output,
            timestamp: new Date().toISOString(),
            ...metadata
        };

        // Record in multiple systems
        await Promise.all([
            this.tracer.recordLLMCall(callData),
            this.collector.recordLLMMetrics(callData),
            this.metrics.recordLLMUsage(callData)
        ]);

        return callData;
    }

    async planTasks(tasks, constraints = {}) {
        if (!this.initialized) {
            throw new Error('Lang Observatory not initialized. Call initialize() first.');
        }

        this.logger.info(`Planning ${tasks.length} tasks using quantum optimization`);

        try {
            // Use quantum planner for task optimization
            const quantumPlan = await this.quantumPlanner.planTasks(tasks, constraints);
            
            // Apply adaptive scheduling to each task
            const adaptiveSchedules = await Promise.all(
                quantumPlan.phases.flatMap(phase => 
                    phase.tasks.map(async taskInfo => {
                        const schedule = await this.adaptiveScheduler.scheduleTask(
                            taskInfo.task, 
                            { phase: phase, quantumPlan }
                        );
                        return { ...taskInfo, schedule };
                    })
                )
            );

            // Record planning metrics
            await this.recordPlanningMetrics(quantumPlan, adaptiveSchedules);

            return {
                quantumPlan,
                adaptiveSchedules,
                totalDuration: quantumPlan.totalDuration,
                efficiency: quantumPlan.efficiency,
                parallelism: quantumPlan.parallelism,
                createdAt: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error('Task planning failed:', error);
            throw error;
        }
    }

    async executeTask(taskId, executionOptions = {}) {
        if (!this.initialized) {
            throw new Error('Lang Observatory not initialized. Call initialize() first.');
        }

        const startTime = Date.now();
        
        try {
            // Trace the execution
            const traceId = this.tracer.startTrace(`task-execution-${taskId}`, { taskId });
            
            // Start metrics collection
            this.metrics.startOperation('task-execution', traceId);
            
            // Execute with monitoring
            const result = await this.executeWithMonitoring(taskId, executionOptions, traceId);
            
            // Record execution result in adaptive scheduler
            await this.adaptiveScheduler.recordExecution(taskId, result);
            
            const duration = Date.now() - startTime;
            this.tracer.endTrace(traceId, { success: result.success, duration });
            this.metrics.recordSuccess('task-execution', duration, traceId);
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.metrics.recordError('task-execution', duration, error, 'unknown-trace');
            throw error;
        }
    }

    async recordPlanningMetrics(quantumPlan, adaptiveSchedules) {
        const planningMetrics = {
            quantumMetrics: this.quantumPlanner.getQuantumMetrics(),
            adaptiveMetrics: this.adaptiveScheduler.getAdaptiveMetrics(),
            planEfficiency: quantumPlan.efficiency,
            totalTasks: quantumPlan.phases.reduce((sum, phase) => sum + phase.tasks.length, 0),
            parallelPhases: quantumPlan.phases.length,
            timestamp: new Date().toISOString()
        };

        // Record in metrics system
        await this.metrics.recordCustomMetric('quantum-planning', planningMetrics);
    }

    async executeWithMonitoring(taskId, options, traceId) {
        // Simplified execution simulation
        const startTime = Date.now();
        
        try {
            // Simulate task execution
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
            
            const duration = Date.now() - startTime;
            const success = Math.random() > 0.1; // 90% success rate
            
            return {
                taskId,
                success,
                duration,
                resourceUsage: {
                    cpu: Math.random() * 2,
                    memory: Math.random() * 1.5,
                    io: Math.random() * 1.2,
                    network: Math.random() * 0.8
                },
                completedAt: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                taskId,
                success: false,
                duration: Date.now() - startTime,
                error: error.message,
                completedAt: new Date().toISOString()
            };
        }
    }

    async getHealthStatus() {
        if (!this.initialized) {
            return { status: 'not_initialized', services: {} };
        }

        const services = await Promise.allSettled([
            this.tracer.getHealth(),
            this.collector.getHealth(),
            this.metrics.getHealth(),
            this.quantumPlanner.getHealth(),
            this.adaptiveScheduler.getHealth()
        ]);

        return {
            status: services.every(s => s.status === 'fulfilled' && s.value.healthy) ? 'healthy' : 'degraded',
            services: {
                tracer: services[0].status === 'fulfilled' ? services[0].value : { healthy: false, error: services[0].reason },
                collector: services[1].status === 'fulfilled' ? services[1].value : { healthy: false, error: services[1].reason },
                metrics: services[2].status === 'fulfilled' ? services[2].value : { healthy: false, error: services[2].reason },
                quantumPlanner: services[3].status === 'fulfilled' ? services[3].value : { healthy: false, error: services[3].reason },
                adaptiveScheduler: services[4].status === 'fulfilled' ? services[4].value : { healthy: false, error: services[4].reason }
            },
            timestamp: new Date().toISOString()
        };
    }

    async shutdown() {
        if (!this.initialized) {
            return;
        }

        this.logger.info('Shutting down Lang Observatory...');
        
        await Promise.allSettled([
            this.tracer.shutdown(),
            this.collector.shutdown(),
            this.metrics.shutdown(),
            this.quantumPlanner.shutdown(),
            this.adaptiveScheduler.shutdown()
        ]);
        
        this.initialized = false;
        this.logger.info('Lang Observatory shutdown complete');
    }
}

module.exports = { LangObservatory };