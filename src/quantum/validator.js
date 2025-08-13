/**
 * Quantum Task Planner Validator
 * Comprehensive validation for quantum planning inputs and outputs
 */

const { Logger } = require('../utils/logger');

class QuantumValidator {
  constructor(config = {}) {
    this.logger = new Logger({ component: 'QuantumValidator' });
    this.config = config;

    // Validation rules and constraints
    this.validationRules = {
      task: {
        id: {
          required: true,
          type: 'string',
          maxLength: 100,
          pattern: /^[a-zA-Z0-9_-]+$/,
        },
        priority: { required: false, type: 'number', min: 0, max: 1 },
        estimatedDuration: {
          required: false,
          type: 'number',
          min: 1,
          max: 86400,
        },
        deadline: { required: false, type: 'date', futureOnly: true },
        requiredResources: { required: false, type: 'array', maxItems: 10 },
        dependencies: { required: false, type: 'array', maxItems: 20 },
        type: { required: false, type: 'string', maxLength: 50 },
        complexity: {
          required: false,
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
      },
      constraints: {
        maxConcurrency: { required: false, type: 'number', min: 1, max: 100 },
        resourceAvailability: {
          required: false,
          type: 'number',
          min: 0,
          max: 1,
        },
        deadline: { required: false, type: 'date', futureOnly: true },
        maxStates: { required: false, type: 'number', min: 1, max: 32 },
      },
      quantumState: {
        coherence: { required: true, type: 'number', min: 0, max: 1 },
        superposition: { required: true, type: 'map' },
        entanglement: { required: true, type: 'map' },
      },
    };

    // Security validation patterns
    this.securityPatterns = {
      xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      sqlInjection:
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)|(['";])/gi,
      pathTraversal: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/gi,
      commandInjection: /[;&|`$(){}[\]]/g,
    };

    // Performance thresholds
    this.performanceThresholds = {
      maxTasksPerBatch: config.maxTasksPerBatch || 1000,
      maxPlanningTime: config.maxPlanningTime || 30000,
      maxMemoryUsage: config.maxMemoryUsage || 500 * 1024 * 1024, // 500MB
      maxPhases: config.maxPhases || 50,
    };

    this.validationMetrics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      securityViolations: 0,
      performanceViolations: 0,
    };
  }

  /**
   * Validate task array before quantum planning
   */
  async validateTasks(tasks, constraints = {}) {
    this.validationMetrics.totalValidations++;

    try {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        sanitized: null,
        metadata: {
          validatedAt: new Date().toISOString(),
          taskCount: Array.isArray(tasks) ? tasks.length : 0,
          constraintCount: Object.keys(constraints).length,
        },
      };

      // Basic type validation
      if (!Array.isArray(tasks)) {
        validationResult.valid = false;
        validationResult.errors.push('Tasks must be an array');
        return this.recordValidationResult(validationResult);
      }

      if (tasks.length === 0) {
        validationResult.valid = false;
        validationResult.errors.push('Tasks array cannot be empty');
        return this.recordValidationResult(validationResult);
      }

      // Performance validation
      const performanceCheck = this.validatePerformance(tasks, constraints);
      if (!performanceCheck.valid) {
        validationResult.valid = false;
        validationResult.errors.push(...performanceCheck.errors);
        this.validationMetrics.performanceViolations++;
      }

      // Validate individual tasks
      const sanitizedTasks = [];
      for (let i = 0; i < tasks.length; i++) {
        const taskValidation = await this.validateTask(tasks[i], i);

        if (!taskValidation.valid) {
          validationResult.valid = false;
          validationResult.errors.push(
            ...taskValidation.errors.map(e => `Task ${i}: ${e}`)
          );
        } else {
          sanitizedTasks.push(taskValidation.sanitized);
        }

        validationResult.warnings.push(
          ...taskValidation.warnings.map(w => `Task ${i}: ${w}`)
        );
      }

      // Validate constraints
      const constraintValidation = this.validateConstraints(constraints);
      if (!constraintValidation.valid) {
        validationResult.valid = false;
        validationResult.errors.push(...constraintValidation.errors);
      }

      // Validate task dependencies
      const dependencyValidation = this.validateDependencies(sanitizedTasks);
      if (!dependencyValidation.valid) {
        validationResult.valid = false;
        validationResult.errors.push(...dependencyValidation.errors);
      }

      // Security validation
      const securityValidation = await this.validateSecurity(
        sanitizedTasks,
        constraints
      );
      if (!securityValidation.valid) {
        validationResult.valid = false;
        validationResult.errors.push(...securityValidation.errors);
        this.validationMetrics.securityViolations++;
      }

      // Set sanitized data if validation passed
      if (validationResult.valid) {
        validationResult.sanitized = {
          tasks: sanitizedTasks,
          constraints: constraintValidation.sanitized,
        };
      }

      return this.recordValidationResult(validationResult);
    } catch (error) {
      this.logger.error('Validation failed with exception:', error);
      this.validationMetrics.failedValidations++;

      return {
        valid: false,
        errors: [`Validation exception: ${error.message}`],
        warnings: [],
        sanitized: null,
        metadata: { validatedAt: new Date().toISOString(), exception: true },
      };
    }
  }

  /**
   * Validate individual task object
   */
  async validateTask(task, index = 0) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      sanitized: {},
    };

    if (!task || typeof task !== 'object') {
      result.valid = false;
      result.errors.push('Task must be an object');
      return result;
    }

    // Validate each field according to rules
    const taskRules = this.validationRules.task;

    for (const [field, rules] of Object.entries(taskRules)) {
      const value = task[field];
      const fieldValidation = this.validateField(field, value, rules);

      if (!fieldValidation.valid) {
        result.valid = false;
        result.errors.push(...fieldValidation.errors);
      } else {
        result.sanitized[field] = fieldValidation.sanitized;
      }

      result.warnings.push(...fieldValidation.warnings);
    }

    // Additional task-specific validations
    if (task.deadline && task.estimatedDuration) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const timeAvailable = deadline.getTime() - now.getTime();
      const timeRequired = (task.estimatedDuration || 60) * 60000;

      if (timeAvailable < timeRequired) {
        result.warnings.push(
          'Deadline may be too tight for estimated duration'
        );
      }
    }

    // Validate resource requirements
    if (task.requiredResources) {
      const resourceValidation = this.validateResources(task.requiredResources);
      if (!resourceValidation.valid) {
        result.valid = false;
        result.errors.push(...resourceValidation.errors);
      } else {
        result.sanitized.requiredResources = resourceValidation.sanitized;
      }
    }

    return result;
  }

  /**
   * Validate field according to rules
   */
  validateField(fieldName, value, rules) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      sanitized: value,
    };

    // Required field check
    if (
      rules.required &&
      (value === undefined || value === null || value === '')
    ) {
      result.valid = false;
      result.errors.push(`${fieldName} is required`);
      return result;
    }

    // Skip further validation if field is optional and not provided
    if (!rules.required && (value === undefined || value === null)) {
      result.sanitized = undefined;
      return result;
    }

    // Type validation
    if (rules.type && !this.validateType(value, rules.type)) {
      result.valid = false;
      result.errors.push(`${fieldName} must be of type ${rules.type}`);
      return result;
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.maxLength && value.length > rules.maxLength) {
        result.sanitized = value.substring(0, rules.maxLength);
        result.warnings.push(
          `${fieldName} truncated to ${rules.maxLength} characters`
        );
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        result.valid = false;
        result.errors.push(`${fieldName} does not match required pattern`);
      }

      if (rules.enum && !rules.enum.includes(value)) {
        result.valid = false;
        result.errors.push(
          `${fieldName} must be one of: ${rules.enum.join(', ')}`
        );
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        result.sanitized = rules.min;
        result.warnings.push(
          `${fieldName} adjusted to minimum value ${rules.min}`
        );
      }

      if (rules.max !== undefined && value > rules.max) {
        result.sanitized = rules.max;
        result.warnings.push(
          `${fieldName} adjusted to maximum value ${rules.max}`
        );
      }
    }

    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.maxItems && value.length > rules.maxItems) {
        result.sanitized = value.slice(0, rules.maxItems);
        result.warnings.push(
          `${fieldName} truncated to ${rules.maxItems} items`
        );
      }
    }

    // Date validations
    if (rules.type === 'date') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        result.valid = false;
        result.errors.push(`${fieldName} must be a valid date`);
      } else if (rules.futureOnly && date <= new Date()) {
        result.valid = false;
        result.errors.push(`${fieldName} must be in the future`);
      } else {
        result.sanitized = date.toISOString();
      }
    }

    return result;
  }

  /**
   * Validate type of value
   */
  validateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return (
          value !== null && typeof value === 'object' && !Array.isArray(value)
        );
      case 'date':
        return (
          value instanceof Date ||
          (typeof value === 'string' && !isNaN(Date.parse(value)))
        );
      case 'map':
        return value instanceof Map;
      default:
        return true;
    }
  }

  /**
   * Validate constraints object
   */
  validateConstraints(constraints) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      sanitized: {},
    };

    if (!constraints || typeof constraints !== 'object') {
      result.sanitized = {};
      return result;
    }

    const constraintRules = this.validationRules.constraints;

    for (const [field, rules] of Object.entries(constraintRules)) {
      const value = constraints[field];
      const fieldValidation = this.validateField(field, value, rules);

      if (!fieldValidation.valid) {
        result.valid = false;
        result.errors.push(...fieldValidation.errors);
      } else {
        result.sanitized[field] = fieldValidation.sanitized;
      }

      result.warnings.push(...fieldValidation.warnings);
    }

    return result;
  }

  /**
   * Validate task dependencies for cycles and validity
   */
  validateDependencies(tasks) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const taskIds = new Set(tasks.map(t => t.id));
    const dependencyGraph = new Map();

    // Build dependency graph and validate references
    for (const task of tasks) {
      if (task.dependencies) {
        dependencyGraph.set(task.id, task.dependencies);

        // Check if all dependencies exist
        for (const depId of task.dependencies) {
          if (!taskIds.has(depId)) {
            result.valid = false;
            result.errors.push(
              `Task ${task.id} depends on non-existent task ${depId}`
            );
          }
        }
      }
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(dependencyGraph);
    if (circularDeps.length > 0) {
      result.valid = false;
      result.errors.push(
        `Circular dependencies detected: ${circularDeps.join(', ')}`
      );
    }

    return result;
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCircularDependencies(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (taskId, path) => {
      if (recursionStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        cycles.push(path.slice(cycleStart).concat(taskId));
        return;
      }

      if (visited.has(taskId)) return;

      visited.add(taskId);
      recursionStack.add(taskId);

      const dependencies = graph.get(taskId) || [];
      for (const depId of dependencies) {
        dfs(depId, [...path, taskId]);
      }

      recursionStack.delete(taskId);
    };

    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId, []);
      }
    }

    return cycles.map(cycle => cycle.join(' -> '));
  }

  /**
   * Validate resources array
   */
  validateResources(resources) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      sanitized: [],
    };

    if (!Array.isArray(resources)) {
      result.valid = false;
      result.errors.push('Resources must be an array');
      return result;
    }

    const validResources = ['cpu', 'memory', 'io', 'network', 'gpu', 'storage'];
    const seenResources = new Set();

    for (const resource of resources) {
      if (typeof resource !== 'string') {
        result.warnings.push('Non-string resource ignored');
        continue;
      }

      const sanitizedResource = resource.toLowerCase().trim();

      if (seenResources.has(sanitizedResource)) {
        result.warnings.push(`Duplicate resource ${sanitizedResource} removed`);
        continue;
      }

      if (!validResources.includes(sanitizedResource)) {
        result.warnings.push(`Unknown resource type ${sanitizedResource}`);
      }

      seenResources.add(sanitizedResource);
      result.sanitized.push(sanitizedResource);
    }

    return result;
  }

  /**
   * Security validation to prevent injection attacks
   */
  async validateSecurity(tasks, constraints) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Check all string fields for security patterns
      const allStrings = this.extractAllStrings(tasks, constraints);

      for (const str of allStrings) {
        const securityCheck = this.checkSecurityPatterns(str);
        if (!securityCheck.safe) {
          result.valid = false;
          result.errors.push(
            `Security violation detected: ${securityCheck.violations.join(', ')}`
          );
        }
      }

      // Additional security checks
      if (tasks.length > this.performanceThresholds.maxTasksPerBatch) {
        result.errors.push(
          `Task count exceeds security limit: ${this.performanceThresholds.maxTasksPerBatch}`
        );
        result.valid = false;
      }
    } catch (error) {
      this.logger.error('Security validation failed:', error);
      result.valid = false;
      result.errors.push('Security validation failed');
    }

    return result;
  }

  /**
   * Extract all string values for security scanning
   */
  extractAllStrings(tasks, constraints) {
    const strings = [];

    const extractFromObject = obj => {
      if (typeof obj === 'string') {
        strings.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(extractFromObject);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(extractFromObject);
      }
    };

    extractFromObject(tasks);
    extractFromObject(constraints);

    return strings;
  }

  /**
   * Check string against security patterns
   */
  checkSecurityPatterns(str) {
    const result = {
      safe: true,
      violations: [],
    };

    for (const [patternName, pattern] of Object.entries(
      this.securityPatterns
    )) {
      if (pattern.test(str)) {
        result.safe = false;
        result.violations.push(patternName);
      }
    }

    return result;
  }

  /**
   * Validate performance constraints
   */
  validatePerformance(tasks, constraints) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check task count limit
    if (tasks.length > this.performanceThresholds.maxTasksPerBatch) {
      result.valid = false;
      result.errors.push(
        `Too many tasks: ${tasks.length} exceeds limit of ${this.performanceThresholds.maxTasksPerBatch}`
      );
    }

    // Estimate memory usage
    const estimatedMemory = this.estimateMemoryUsage(tasks, constraints);
    if (estimatedMemory > this.performanceThresholds.maxMemoryUsage) {
      result.valid = false;
      result.errors.push(
        `Estimated memory usage ${Math.round(estimatedMemory / 1024 / 1024)}MB exceeds limit`
      );
    }

    // Check complexity
    const totalDuration = tasks.reduce(
      (sum, task) => sum + (task.estimatedDuration || 60),
      0
    );
    if (totalDuration > this.performanceThresholds.maxPlanningTime / 1000) {
      result.warnings.push(
        'High complexity planning detected - may take longer'
      );
    }

    return result;
  }

  /**
   * Estimate memory usage for planning operation
   */
  estimateMemoryUsage(tasks, constraints) {
    // Rough estimation based on task count and complexity
    const baseUsage = 1024 * 1024; // 1MB base
    const perTaskUsage = 1024; // 1KB per task
    const superpositionStates = (constraints.maxStates || 8) * tasks.length;
    const entanglementPairs = Math.min(
      (tasks.length * (tasks.length - 1)) / 2,
      1000
    );

    return (
      baseUsage +
      tasks.length * perTaskUsage +
      superpositionStates * 512 +
      entanglementPairs * 256
    );
  }

  /**
   * Validate quantum state structure
   */
  validateQuantumState(quantumState) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!quantumState || typeof quantumState !== 'object') {
      result.valid = false;
      result.errors.push('Quantum state must be an object');
      return result;
    }

    const stateRules = this.validationRules.quantumState;

    for (const [field, rules] of Object.entries(stateRules)) {
      const value = quantumState[field];
      const fieldValidation = this.validateField(field, value, rules);

      if (!fieldValidation.valid) {
        result.valid = false;
        result.errors.push(...fieldValidation.errors);
      }

      result.warnings.push(...fieldValidation.warnings);
    }

    // Additional quantum state validations
    if (quantumState.coherence < 0.1) {
      result.warnings.push('Very low quantum coherence detected');
    }

    if (quantumState.superposition && quantumState.superposition.size === 0) {
      result.warnings.push('Empty superposition state');
    }

    return result;
  }

  /**
   * Record validation result and update metrics
   */
  recordValidationResult(result) {
    if (result.valid) {
      this.validationMetrics.passedValidations++;
    } else {
      this.validationMetrics.failedValidations++;
    }

    this.logger.debug('Validation completed:', {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    });

    return result;
  }

  /**
   * Get validation metrics
   */
  getValidationMetrics() {
    return {
      ...this.validationMetrics,
      successRate:
        this.validationMetrics.totalValidations > 0
          ? this.validationMetrics.passedValidations /
            this.validationMetrics.totalValidations
          : 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset validation metrics
   */
  resetMetrics() {
    this.validationMetrics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      securityViolations: 0,
      performanceViolations: 0,
    };

    this.logger.info('Validation metrics reset');
  }
}

module.exports = { QuantumValidator };
