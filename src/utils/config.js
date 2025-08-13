/**
 * Configuration Management Utility
 * Handles configuration loading and validation
 */

const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(initialConfig = {}) {
    this.config = this._loadConfiguration(initialConfig);
    this.envOverrides = this._loadEnvironmentOverrides();
    this.mergedConfig = this._mergeConfigurations();
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.mergedConfig;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let target = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = value;
    this.mergedConfig = this._mergeConfigurations();
  }

  validate() {
    const errors = [];

    // Required configuration checks
    const required = [
      'langfuse.publicKey',
      'langfuse.secretKey',
      'openlit.endpoint',
    ];

    for (const key of required) {
      if (!this.get(key)) {
        errors.push(`Missing required configuration: ${key}`);
      }
    }

    // Validation rules
    const validations = [
      {
        key: 'langfuse.host',
        validator: value =>
          value &&
          (value.startsWith('http://') || value.startsWith('https://')),
        message: 'Langfuse host must be a valid HTTP/HTTPS URL',
      },
      {
        key: 'openlit.endpoint',
        validator: value =>
          value &&
          (value.startsWith('http://') || value.startsWith('https://')),
        message: 'OpenLIT endpoint must be a valid HTTP/HTTPS URL',
      },
      {
        key: 'metrics.retentionDays',
        validator: value => !value || (Number.isInteger(value) && value > 0),
        message: 'Metrics retention days must be a positive integer',
      },
    ];

    for (const validation of validations) {
      const value = this.get(validation.key);
      if (value && !validation.validator(value)) {
        errors.push(validation.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getAll() {
    return JSON.parse(JSON.stringify(this.mergedConfig));
  }

  reload() {
    this.envOverrides = this._loadEnvironmentOverrides();
    this.mergedConfig = this._mergeConfigurations();
  }

  // Private methods
  _loadConfiguration(initialConfig) {
    // Try to load from configuration file
    const configPaths = [
      process.env.LANG_OBSERVATORY_CONFIG,
      path.join(process.cwd(), 'config.json'),
      path.join(process.cwd(), 'lang-observatory.config.json'),
      path.join(process.cwd(), '.lang-observatory.json'),
    ].filter(Boolean);

    let fileConfig = {};

    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf8');
          fileConfig = JSON.parse(content);
          break;
        }
      } catch (error) {
        console.warn(
          `Failed to load config from ${configPath}:`,
          error.message
        );
      }
    }

    // Merge with initial config
    return this._deepMerge(this._getDefaultConfig(), fileConfig, initialConfig);
  }

  _loadEnvironmentOverrides() {
    const envConfig = {};

    // Map environment variables to config keys
    const envMappings = {
      LANGFUSE_HOST: 'langfuse.host',
      LANGFUSE_PUBLIC_KEY: 'langfuse.publicKey',
      LANGFUSE_SECRET_KEY: 'langfuse.secretKey',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'openlit.endpoint',
      LANG_OBSERVATORY_SERVICE_NAME: 'openlit.serviceName',
      LANG_OBSERVATORY_LOG_LEVEL: 'logging.level',
      LANG_OBSERVATORY_METRICS_ENABLED: 'metrics.enabled',
      LANG_OBSERVATORY_RETENTION_DAYS: 'metrics.retentionDays',
    };

    for (const [envVar, configKey] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this._setNestedValue(envConfig, configKey, this._parseEnvValue(value));
      }
    }

    return envConfig;
  }

  _mergeConfigurations() {
    return this._deepMerge(this.config, this.envOverrides);
  }

  _getDefaultConfig() {
    return {
      langfuse: {
        host: 'http://localhost:3000',
        enabled: true,
        flushInterval: 5000,
        batchSize: 100,
      },
      openlit: {
        endpoint: 'http://localhost:4317',
        serviceName: 'lang-observatory',
        enabled: true,
        exportInterval: 5000,
        maxExportBatchSize: 512,
      },
      metrics: {
        enabled: true,
        retentionDays: 30,
        aggregationInterval: 60000,
        alertThresholds: {
          errorRate: 0.05,
          avgLatency: 5000,
          costPerHour: 100,
        },
      },
      logging: {
        level: 'info',
        format: 'json',
      },
    };
  }

  _deepMerge(...objects) {
    const result = {};

    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue;

      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this._deepMerge(result[key] || {}, value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  _parseEnvValue(value) {
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // If not JSON, try boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;

      // Try number
      if (/^\d+$/.test(value)) return parseInt(value, 10);
      if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

      // Return as string
      return value;
    }
  }
}

module.exports = { ConfigManager };
