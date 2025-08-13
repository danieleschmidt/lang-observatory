/**
 * Quantum-Inspired Task Planner
 * Uses quantum computing principles for intelligent task scheduling and optimization
 */

const { Logger } = require('../utils/logger');
const { ConfigManager } = require('../utils/config');
const { QuantumErrorHandler } = require('./errorHandler');
const { QuantumValidator } = require('./validator');
const { QuantumSecurityManager } = require('./securityManager');
const { QuantumPerformanceOptimizer } = require('./performanceOptimizer');
const { QuantumScalingManager } = require('./scalingManager');
const { QuantumI18nManager } = require('./i18nManager');
const { QuantumComplianceManager } = require('./complianceManager');
const { QuantumMultiRegionManager } = require('./multiRegionManager');

class QuantumTaskPlanner {
  constructor(config = {}) {
    this.config = new ConfigManager(config);
    this.logger = new Logger({ component: 'QuantumTaskPlanner' });

    // Initialize security and validation components
    this.errorHandler = new QuantumErrorHandler(config.errorHandling || {});
    this.validator = new QuantumValidator(config.validation || {});
    this.securityManager = new QuantumSecurityManager(config.security || {});
    this.performanceOptimizer = new QuantumPerformanceOptimizer(
      config.performance || {}
    );
    this.scalingManager = new QuantumScalingManager(config.scaling || {});
    this.i18nManager = new QuantumI18nManager(config.i18n || {});
    this.complianceManager = new QuantumComplianceManager(
      config.compliance || {}
    );
    this.multiRegionManager = new QuantumMultiRegionManager(
      config.multiRegion || {}
    );

    // Quantum-inspired state management
    this.quantumState = new Map();
    this.taskQueue = [];
    this.executionHistory = [];
    this.adaptiveThresholds = {
      priority: 0.7,
      efficiency: 0.8,
      convergence: 0.95,
    };

    // Quick cache for identical requests (top-level caching)
    this.quickCache = new Map();

    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Quantum Task Planner...');

      // Initialize performance and scaling components
      await this.performanceOptimizer.initialize();
      await this.scalingManager.initialize();

      // Initialize global-first components
      await this.i18nManager.initialize();
      await this.complianceManager.initialize();
      await this.multiRegionManager.initialize();

      // Initialize quantum superposition state for tasks
      this.quantumState.set('superposition', new Map());
      this.quantumState.set('entanglement', new Map());
      this.quantumState.set('coherence', 1.0);

      this.initialized = true;
      this.logger.info('Quantum Task Planner initialized successfully');

      return this;
    } catch (error) {
      this.logger.error('Failed to initialize Quantum Task Planner:', error);
      throw error;
    }
  }

  /**
   * Plan tasks using quantum-inspired optimization
   */
  async planTasks(tasks, constraints = {}, user = null) {
    if (!this.initialized) {
      throw new Error('Quantum Task Planner not initialized');
    }

    const startTime = Date.now();
    
    // Quick cache check for identical requests (before any processing)
    const quickCacheKey = this.generateQuickCacheKey(tasks, constraints, user);
    if (this.quickCache && this.quickCache.has(quickCacheKey)) {
      const cached = this.quickCache.get(quickCacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute TTL
        // Record cache hit in execution history
        const duration = Date.now() - startTime;
        this.executionHistory.push({
          timestamp: new Date().toISOString(),
          taskCount: tasks.length,
          duration,
          efficiency: cached.result.efficiency || 0.8,
          constraints: constraints,
          user: user ? user.userId : 'anonymous',
          cached: true,
        });
        return cached.result;
      } else {
        this.quickCache.delete(quickCacheKey);
      }
    }

    // Get localized messages
    const locale = user?.locale || this.i18nManager.getLocale();
    this.logger.info(
      this.i18nManager.t('status.planning', { taskCount: tasks.length }, locale)
    );

    try {
      // Security check
      if (
        user &&
        !(await this.securityManager.checkPermission(user, 'PLAN_TASKS'))
      ) {
        const errorMsg = this.i18nManager.t(
          'error.permission.denied',
          { operation: 'PLAN_TASKS' },
          locale
        );
        throw new Error(errorMsg);
      }

      // Record compliance activity
      if (user) {
        this.complianceManager.recordProcessingActivity({
          userId: user.userId,
          dataSubject: user.userId,
          purpose: 'task_planning',
          legalBasis: 'legitimate_interest',
          dataCategories: ['usage_data', 'task_metadata'],
          classification: this.complianceManager.dataClassification.INTERNAL,
        });
      }

      // Validate input data
      const validation = await this.validator.validateTasks(tasks, constraints);
      if (!validation.valid) {
        // Check if this is a sanitizable error (like too many tasks)
        const oversizedTasksError = validation.errors.some(error => 
          error.includes('Too many tasks') || 
          error.includes('exceeds limit') ||
          error.includes('exceeds security limit')
        );
        
        if (oversizedTasksError) {
          // Return sanitized result with truncated tasks
          const maxTasks = this.config.get('validation.maxTasksPerBatch', 100);
          const truncatedTasks = tasks.slice(0, maxTasks);
          
          return {
            action: 'sanitized',
            sanitizedTasks: truncatedTasks,
            originalTaskCount: tasks.length,
            message: `Task set truncated from ${tasks.length} to ${maxTasks} tasks`,
            plan: {
              phases: truncatedTasks.map((task, index) => ({
                tasks: [{ id: task.id, task }],
                duration: task.estimatedDuration || 60,
                resources: new Map(),
              })),
              totalDuration: truncatedTasks.reduce(
                (sum, task) => sum + (task.estimatedDuration || 60),
                0
              ),
              efficiency: 0.7,
              parallelism: 0,
            }
          };
        }
        
        const errorMsg = this.i18nManager.t(
          'error.validation.failed',
          {
            errors: validation.errors.join(', '),
          },
          locale
        );
        throw new Error(errorMsg);
      }

      // Use sanitized data
      const sanitizedTasks = validation.sanitized.tasks;
      const sanitizedConstraints = validation.sanitized.constraints;

      // Route to optimal region with multi-region manager
      const regionalExecution = await this.multiRegionManager.routeRequest(
        {
          data: { tasks: sanitizedTasks, constraints: sanitizedConstraints },
          userLocation: user?.location,
          dataClassification: 'INTERNAL',
          complianceRequired: this.complianceManager.activeFrameworks,
          startTime: Date.now(),
        },
        { user }
      );

      // Use performance optimizer with scaling manager for optimal execution
      const optimizedPlan = await this.scalingManager.routeRequest(
        async (tasks, constraints) => {
          return await this.performanceOptimizer.optimizePlanTasks(
            (tasks, constraints) =>
              this.executeQuantumPlanning(tasks, constraints),
            tasks,
            constraints,
            { user, region: regionalExecution.region }
          );
        },
        regionalExecution.result.data.tasks,
        regionalExecution.result.data.constraints
      );

      // Record execution metrics
      const duration = Date.now() - startTime;
      this.executionHistory.push({
        timestamp: new Date().toISOString(),
        taskCount: sanitizedTasks.length,
        duration,
        efficiency: this.calculateEfficiency(optimizedPlan),
        constraints: sanitizedConstraints,
        user: user ? user.userId : 'anonymous',
      });

      // Add localized metadata to result
      const localizedResult = {
        ...optimizedPlan,
        locale,
        region: regionalExecution.region,
        compliance: {
          frameworks: this.complianceManager.activeFrameworks,
          dataResidency: user?.dataResidency || 'global',
        },
        localizedMessages: {
          planningComplete: this.i18nManager.t(
            'status.completed',
            { taskId: 'planning' },
            locale
          ),
          duration: this.i18nManager.formatDuration(duration, locale),
          efficiency:
            this.i18nManager.formatNumber(
              optimizedPlan.efficiency * 100,
              locale
            ) + '%',
        },
      };

      this.logger.info(
        this.i18nManager.t('status.completed', { taskId: 'planning' }, locale)
      );
      
      // Cache the result for future identical requests
      if (this.quickCache) {
        this.quickCache.set(quickCacheKey, {
          result: localizedResult,
          timestamp: Date.now()
        });
      }
      
      return localizedResult;
    } catch (error) {
      this.logger.error('Quantum planning failed:', error);

      // Try error recovery
      try {
        const recoveryResult = await this.errorHandler.handleQuantumError(
          error,
          {
            tasks: tasks,
            constraints: constraints,
            quantumState: this.quantumState,
            user: user,
          }
        );

        this.logger.info(
          'Error recovery successful, returning fallback result'
        );
        return recoveryResult;
      } catch (recoveryError) {
        this.logger.error('Error recovery failed:', recoveryError);
        throw error; // Original error
      }
    }
  }

  /**
   * Execute quantum planning without performance optimization (internal use)
   */
  async executeQuantumPlanning(tasks, constraints) {
    // Apply quantum superposition to explore all possible task combinations
    const superpositionStates = this.createSuperposition(tasks, constraints);

    // Use quantum entanglement to identify task dependencies
    const entangledTasks = this.identifyEntanglement(superpositionStates);

    // Collapse quantum state to optimal solution
    const optimizedPlan = this.collapseToOptimalState(
      entangledTasks,
      constraints
    );

    return optimizedPlan;
  }

  /**
   * Create quantum superposition of all possible task states
   */
  createSuperposition(tasks, constraints) {
    const superposition = new Map();

    tasks.forEach((task, index) => {
      const amplitude = this.calculateQuantumAmplitude(task, constraints);
      const phase = this.calculateQuantumPhase(task, index, tasks);

      superposition.set(task.id, {
        task,
        amplitude,
        phase,
        probability: Math.pow(amplitude, 2),
        possibleStates: this.generatePossibleStates(task, constraints),
      });
    });

    this.quantumState.set('superposition', superposition);
    return superposition;
  }

  /**
   * Calculate quantum amplitude based on task priority and resources
   */
  calculateQuantumAmplitude(task, constraints) {
    const priority = task.priority || 0.5;
    const complexity = 1 - (task.estimatedDuration || 60) / 1440; // Normalize to daily scale
    const resourceAvailability = constraints.resourceAvailability || 1.0;

    return Math.sqrt(priority * complexity * resourceAvailability);
  }

  /**
   * Calculate quantum phase for task interference patterns
   */
  calculateQuantumPhase(task, index, tasks) {
    const basePhase = (index * Math.PI) / (tasks?.length || 1);
    const priorityPhase = (task.priority || 0.5) * Math.PI;

    return (basePhase + priorityPhase) % (2 * Math.PI);
  }

  /**
   * Generate possible execution states for a task
   */
  generatePossibleStates(task, constraints) {
    const states = [];
    const maxStates = constraints.maxStates || 8;

    for (let i = 0; i < maxStates; i++) {
      states.push({
        executionTime: this.calculateOptimalExecutionTime(task, i),
        resourceAllocation: this.calculateResourceAllocation(task, i),
        probability: Math.exp(-i * 0.5), // Exponential decay for higher states
      });
    }

    return states;
  }

  /**
   * Identify quantum entanglement between tasks (dependencies)
   */
  identifyEntanglement(superpositionStates) {
    const entanglements = new Map();

    superpositionStates.forEach((stateA, taskIdA) => {
      superpositionStates.forEach((stateB, taskIdB) => {
        if (taskIdA !== taskIdB) {
          const entanglementStrength = this.calculateEntanglementStrength(
            stateA,
            stateB
          );

          if (entanglementStrength > this.adaptiveThresholds.priority) {
            const pairKey = `${taskIdA}-${taskIdB}`;
            entanglements.set(pairKey, {
              taskA: taskIdA,
              taskB: taskIdB,
              strength: entanglementStrength,
              type: this.classifyEntanglementType(stateA, stateB),
            });
          }
        }
      });
    });

    this.quantumState.set('entanglement', entanglements);
    return entanglements;
  }

  /**
   * Calculate quantum entanglement strength between two tasks
   */
  calculateEntanglementStrength(stateA, stateB) {
    const taskA = stateA.task;
    const taskB = stateB.task;

    // Resource overlap
    const resourceOverlap = this.calculateResourceOverlap(taskA, taskB);

    // Temporal correlation
    const temporalCorrelation = this.calculateTemporalCorrelation(taskA, taskB);

    // Dependency strength
    const dependencyStrength = this.calculateDependencyStrength(taskA, taskB);

    return (resourceOverlap + temporalCorrelation + dependencyStrength) / 3;
  }

  /**
   * Classify the type of entanglement between tasks
   */
  classifyEntanglementType(stateA, stateB) {
    const taskA = stateA.task;
    const taskB = stateB.task;

    if (taskA.dependencies && taskA.dependencies.includes(taskB.id)) {
      return 'sequential';
    } else if (this.shareResources(taskA, taskB)) {
      return 'resource_conflict';
    } else if (this.canRunConcurrently(taskA, taskB)) {
      return 'parallel';
    }

    return 'independent';
  }

  /**
   * Collapse quantum superposition to optimal task execution plan
   */
  collapseToOptimalState(entanglements, constraints) {
    const optimizedPlan = {
      phases: [],
      totalDuration: 0,
      resourceUtilization: new Map(),
      parallelism: 0,
      efficiency: 0,
    };

    // Sort tasks by quantum probability and entanglement strength
    const prioritizedTasks = this.prioritizeTasksByQuantumState();

    // Group tasks into execution phases
    const phases = this.groupTasksIntoPhases(
      prioritizedTasks,
      entanglements,
      constraints
    );

    optimizedPlan.phases = phases;
    optimizedPlan.totalDuration = this.calculateTotalDuration(phases);
    optimizedPlan.resourceUtilization =
      this.calculateResourceUtilization(phases);
    optimizedPlan.parallelism = this.calculateParallelismFactor(phases);
    optimizedPlan.efficiency = this.calculateEfficiency(optimizedPlan);

    return optimizedPlan;
  }

  /**
   * Prioritize tasks based on quantum state probabilities
   */
  prioritizeTasksByQuantumState() {
    const superposition = this.quantumState.get('superposition');
    const tasks = [];

    superposition.forEach((state, taskId) => {
      tasks.push({
        id: taskId,
        task: state.task,
        quantumPriority: state.probability,
        amplitude: state.amplitude,
        phase: state.phase,
      });
    });

    return tasks.sort((a, b) => b.quantumPriority - a.quantumPriority);
  }

  /**
   * Group tasks into execution phases considering quantum entanglement
   */
  groupTasksIntoPhases(prioritizedTasks, entanglements, constraints) {
    const phases = [];
    const assignedTasks = new Set();
    const maxConcurrency = constraints.maxConcurrency || 4;

    while (assignedTasks.size < prioritizedTasks.length) {
      const currentPhase = {
        tasks: [],
        duration: 0,
        resources: new Map(),
      };

      for (const taskInfo of prioritizedTasks) {
        if (assignedTasks.has(taskInfo.id)) continue;

        if (
          this.canAddToPhase(
            taskInfo,
            currentPhase,
            entanglements,
            maxConcurrency,
            assignedTasks
          )
        ) {
          currentPhase.tasks.push(taskInfo);
          assignedTasks.add(taskInfo.id);

          // Update phase duration and resources
          const taskDuration = taskInfo.task.estimatedDuration || 60;
          currentPhase.duration = Math.max(currentPhase.duration, taskDuration);

          this.updatePhaseResources(currentPhase, taskInfo.task);
        }
      }

      if (currentPhase.tasks.length > 0) {
        phases.push(currentPhase);
      } else {
        break; // Prevent infinite loop
      }
    }

    return phases;
  }

  /**
   * Check if a task can be added to the current execution phase
   */
  canAddToPhase(taskInfo, currentPhase, entanglements, maxConcurrency, assignedTasks) {
    // Check concurrency limit
    if (currentPhase.tasks.length >= maxConcurrency) {
      return false;
    }

    // Check dependencies first - task cannot run if its dependencies haven't been completed
    if (taskInfo.task.dependencies && taskInfo.task.dependencies.length > 0) {
      const unmetDependencies = taskInfo.task.dependencies.filter(
        depId => !assignedTasks.has(depId)
      );
      if (unmetDependencies.length > 0) {
        return false;
      }
    }

    // Check for conflicting entanglements
    const conflictingEntanglements = this.findConflictingEntanglements(
      taskInfo.id,
      currentPhase.tasks.map(t => t.id),
      entanglements
    );

    if (conflictingEntanglements.length > 0) {
      return false;
    }

    // Check resource conflicts
    if (this.hasResourceConflicts(taskInfo.task, currentPhase)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate helper methods
   */
  calculateResourceOverlap(taskA, taskB) {
    const resourcesA = new Set(taskA.requiredResources || []);
    const resourcesB = new Set(taskB.requiredResources || []);
    const intersection = new Set(
      [...resourcesA].filter(r => resourcesB.has(r))
    );
    const union = new Set([...resourcesA, ...resourcesB]);

    return intersection.size / Math.max(union.size, 1);
  }

  calculateTemporalCorrelation(taskA, taskB) {
    const deadlineA = taskA.deadline
      ? new Date(taskA.deadline).getTime()
      : Date.now() + 86400000;
    const deadlineB = taskB.deadline
      ? new Date(taskB.deadline).getTime()
      : Date.now() + 86400000;
    const timeDiff = Math.abs(deadlineA - deadlineB);

    return Math.exp(-timeDiff / 86400000); // Decay over days
  }

  calculateDependencyStrength(taskA, taskB) {
    if (taskA.dependencies && taskA.dependencies.includes(taskB.id)) return 1.0;
    if (taskB.dependencies && taskB.dependencies.includes(taskA.id)) return 1.0;
    return 0.0;
  }

  shareResources(taskA, taskB) {
    const resourcesA = new Set(taskA.requiredResources || []);
    const resourcesB = new Set(taskB.requiredResources || []);
    return [...resourcesA].some(r => resourcesB.has(r));
  }

  canRunConcurrently(taskA, taskB) {
    return (
      !this.shareResources(taskA, taskB) &&
      !this.hasDependency(taskA, taskB) &&
      !this.hasDependency(taskB, taskA)
    );
  }

  hasDependency(taskA, taskB) {
    return taskA.dependencies && taskA.dependencies.includes(taskB.id);
  }

  calculateOptimalExecutionTime(task, stateIndex) {
    const baseDuration = task.estimatedDuration || 60;
    const optimizationFactor = Math.exp(-stateIndex * 0.1);
    return Math.max(baseDuration * optimizationFactor, baseDuration * 0.5);
  }

  calculateResourceAllocation(task, stateIndex) {
    const baseAllocation = task.resourceRequirement || 1.0;
    const allocationFactor = 1 + stateIndex * 0.2;
    return Math.min(baseAllocation * allocationFactor, 2.0);
  }

  findConflictingEntanglements(taskId, phaseTaskIds, entanglements) {
    const conflicts = [];

    entanglements.forEach((entanglement, key) => {
      if (
        (entanglement.taskA === taskId &&
          phaseTaskIds.includes(entanglement.taskB)) ||
        (entanglement.taskB === taskId &&
          phaseTaskIds.includes(entanglement.taskA))
      ) {
        if (
          entanglement.type === 'sequential' ||
          entanglement.type === 'resource_conflict'
        ) {
          conflicts.push(entanglement);
        }
      }
    });

    return conflicts;
  }

  hasResourceConflicts(task, currentPhase) {
    const taskResources = new Set(task.requiredResources || []);

    for (const phaseTask of currentPhase.tasks) {
      const phaseResources = new Set(phaseTask.task.requiredResources || []);
      const overlap = [...taskResources].filter(r => phaseResources.has(r));

      if (overlap.length > 0) {
        return true;
      }
    }

    return false;
  }

  updatePhaseResources(phase, task) {
    const resources = task.requiredResources || [];
    resources.forEach(resource => {
      const current = phase.resources.get(resource) || 0;
      phase.resources.set(resource, current + (task.resourceRequirement || 1));
    });
  }

  calculateTotalDuration(phases) {
    return phases.reduce((total, phase) => total + phase.duration, 0);
  }

  calculateResourceUtilization(phases) {
    const utilization = new Map();

    phases.forEach(phase => {
      phase.resources.forEach((usage, resource) => {
        const current = utilization.get(resource) || 0;
        utilization.set(resource, Math.max(current, usage));
      });
    });

    return utilization;
  }

  calculateParallelismFactor(phases) {
    if (phases.length === 0) return 0;

    const totalTasks = phases.reduce(
      (sum, phase) => sum + phase.tasks.length,
      0
    );
    const avgTasksPerPhase = totalTasks / phases.length;

    return Math.min(avgTasksPerPhase, 1.0);
  }

  calculateEfficiency(plan) {
    if (!plan.phases || plan.phases.length === 0) return 0;

    const totalTasks = plan.phases.reduce(
      (sum, phase) => sum + phase.tasks.length,
      0
    );
    const sequentialDuration = plan.phases.reduce((sum, phase) => {
      return (
        sum +
        phase.tasks.reduce((phaseSum, task) => {
          return phaseSum + (task.task.estimatedDuration || 60);
        }, 0)
      );
    }, 0);

    return sequentialDuration > 0
      ? Math.min(sequentialDuration / plan.totalDuration, 1.0)
      : 0;
  }

  /**
   * Get current quantum state metrics (with security filtering)
   */
  async getQuantumMetrics(user = null) {
    const baseMetrics = {
      superpositionStates: this.quantumState.get('superposition')?.size || 0,
      entanglementPairs: this.quantumState.get('entanglement')?.size || 0,
      coherenceLevel: this.quantumState.get('coherence') || 0,
      executionHistory: this.executionHistory.length,
      avgEfficiency: this.calculateAverageEfficiency(),
      validationMetrics: this.validator.getValidationMetrics(),
      errorMetrics: this.errorHandler.getErrorMetrics(),
    };

    // Add security metrics if user has permission
    if (
      user &&
      (await this.securityManager.checkPermission(user, 'VIEW_METRICS'))
    ) {
      baseMetrics.securityMetrics =
        this.securityManager.getSecurityMetrics(user);
      baseMetrics.performanceMetrics =
        this.performanceOptimizer.getPerformanceMetrics();
      baseMetrics.scalingMetrics = this.scalingManager.getScalingMetrics();
      baseMetrics.complianceMetrics =
        this.complianceManager.getComplianceDashboard();
      baseMetrics.multiRegionMetrics =
        this.multiRegionManager.getMultiRegionStatus();
      baseMetrics.i18nMetrics = this.i18nManager.getTranslationStats();
    }

    return baseMetrics;
  }

  calculateAverageEfficiency() {
    if (this.executionHistory.length === 0) return 0;

    const totalEfficiency = this.executionHistory.reduce(
      (sum, record) => sum + record.efficiency,
      0
    );
    return totalEfficiency / this.executionHistory.length;
  }

  /**
   * Health check for quantum planner
   */
  async getHealth() {
    return {
      healthy: this.initialized,
      coherence: this.quantumState.get('coherence') || 0,
      taskQueue: this.taskQueue.length,
      executionHistory: this.executionHistory.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Shutdown quantum planner
   */
  async shutdown() {
    this.logger.info('Shutting down Quantum Task Planner...');

    // Shutdown all components
    await Promise.allSettled([
      this.securityManager.shutdown(),
      this.performanceOptimizer.shutdown(),
      this.scalingManager.shutdown(),
      this.i18nManager.shutdown(),
      this.complianceManager.shutdown(),
      this.multiRegionManager.shutdown(),
    ]);

    this.quantumState.clear();
    this.taskQueue = [];
    this.quickCache.clear();
    this.initialized = false;

    this.logger.info('Quantum Task Planner shutdown complete');
  }

  /**
   * Generate quick cache key for top-level caching
   */
  generateQuickCacheKey(tasks, constraints, user) {
    const taskKey = tasks.map(t => 
      `${t.id}:${t.priority || 0.5}:${t.estimatedDuration || 60}:${(t.dependencies || []).join(',')}`
    ).join('|');
    const constraintKey = JSON.stringify(constraints);
    const userKey = user ? `${user.userId}:${user.role}` : 'anonymous';
    
    return `${taskKey}#${constraintKey}#${userKey}`;
  }
}

module.exports = { QuantumTaskPlanner };
