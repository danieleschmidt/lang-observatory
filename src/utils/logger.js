/**
 * Logging Utility
 * Provides structured logging for Lang Observatory
 */

class Logger {
  constructor(config = {}) {
    this.config = {
      level: config.level || process.env.LOG_LEVEL || 'info',
      format: config.format || 'json',
      service: config.service || 'lang-observatory',
      timestamp: config.timestamp !== false,
      ...config,
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4,
    };

    this.currentLevel = this.levels[this.config.level] || this.levels.info;
  }

  error(message, ...args) {
    this._log('error', message, ...args);
  }

  warn(message, ...args) {
    this._log('warn', message, ...args);
  }

  info(message, ...args) {
    this._log('info', message, ...args);
  }

  debug(message, ...args) {
    this._log('debug', message, ...args);
  }

  trace(message, ...args) {
    this._log('trace', message, ...args);
  }

  child(childConfig) {
    return new Logger({
      ...this.config,
      ...childConfig,
    });
  }

  // Private methods
  _log(level, message, ...args) {
    if (this.levels[level] > this.currentLevel) {
      return;
    }

    const logEntry = this._createLogEntry(level, message, ...args);

    if (this.config.format === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(this._formatPlainText(logEntry));
    }
  }

  _createLogEntry(level, message, ...args) {
    const entry = {
      level,
      service: this.config.service,
      message,
    };

    if (this.config.timestamp) {
      entry.timestamp = new Date().toISOString();
    }

    // Process additional arguments
    if (args.length > 0) {
      // If first arg is an object, merge it
      if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
        Object.assign(entry, args[0]);
        args = args.slice(1);
      }

      // If there are still args, add them as data
      if (args.length > 0) {
        entry.data = args.length === 1 ? args[0] : args;
      }
    }

    // Add error stack if present
    if (entry.error && entry.error instanceof Error) {
      entry.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    return entry;
  }

  _formatPlainText(entry) {
    const timestamp = entry.timestamp ? `[${entry.timestamp}] ` : '';
    const level = entry.level.toUpperCase().padEnd(5);
    const service = entry.service ? `[${entry.service}] ` : '';

    let text = `${timestamp}${level} ${service}${entry.message}`;

    // Add additional data
    const additionalData = { ...entry };
    delete additionalData.timestamp;
    delete additionalData.level;
    delete additionalData.service;
    delete additionalData.message;

    if (Object.keys(additionalData).length > 0) {
      text += ` ${JSON.stringify(additionalData)}`;
    }

    return text;
  }
}

module.exports = { Logger };
