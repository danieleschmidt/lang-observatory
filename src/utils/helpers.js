/**
 * Helper Utilities
 * Common utility functions for Lang Observatory
 */

const crypto = require('crypto');

class Helpers {
    /**
     * Generate a unique trace ID
     */
    static generateTraceId() {
        return crypto.randomUUID();
    }

    /**
     * Generate a unique session ID
     */
    static generateSessionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Calculate the hash of an object for caching
     */
    static calculateHash(obj) {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    /**
     * Deep clone an object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }
        
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        
        return obj;
    }

    /**
     * Safely parse JSON with error handling
     */
    static safeJsonParse(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (error) {
            return defaultValue;
        }
    }

    /**
     * Format duration from milliseconds to human readable
     */
    static formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        
        if (ms < 60000) {
            return `${(ms / 1000).toFixed(2)}s`;
        }
        
        if (ms < 3600000) {
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(0);
            return `${minutes}m ${seconds}s`;
        }
        
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    }

    /**
     * Format bytes to human readable size
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * Format cost to currency string
     */
    static formatCost(cost, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(cost);
    }

    /**
     * Throttle function execution
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Debounce function execution
     */
    static debounce(func, delay) {
        let timeoutId;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }

    /**
     * Retry async function with exponential backoff
     */
    static async retry(fn, options = {}) {
        const {
            maxRetries = 3,
            initialDelay = 1000,
            maxDelay = 10000,
            backoffFactor = 2,
            retryCondition = () => true
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries || !retryCondition(error)) {
                    throw error;
                }
                
                const delay = Math.min(
                    initialDelay * Math.pow(backoffFactor, attempt),
                    maxDelay
                );
                
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    /**
     * Sleep for specified milliseconds
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if value is empty (null, undefined, empty string, empty array, empty object)
     */
    static isEmpty(value) {
        if (value === null || value === undefined) {
            return true;
        }
        
        if (typeof value === 'string' && value.trim() === '') {
            return true;
        }
        
        if (Array.isArray(value) && value.length === 0) {
            return true;
        }
        
        if (typeof value === 'object' && Object.keys(value).length === 0) {
            return true;
        }
        
        return false;
    }

    /**
     * Get nested property from object safely
     */
    static getNestedProperty(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result === null || result === undefined || typeof result !== 'object') {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    }

    /**
     * Set nested property in object
     */
    static setNestedProperty(obj, path, value) {
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
        return obj;
    }

    /**
     * Calculate percentile from array of numbers
     */
    static calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        
        return sorted[Math.max(0, index)];
    }

    /**
     * Calculate statistical summary of array
     */
    static calculateStats(values) {
        if (values.length === 0) {
            return {
                count: 0,
                sum: 0,
                min: 0,
                max: 0,
                mean: 0,
                median: 0,
                p95: 0,
                p99: 0
            };
        }
        
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        
        return {
            count: values.length,
            sum,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            mean,
            median: this.calculatePercentile(values, 50),
            p95: this.calculatePercentile(values, 95),
            p99: this.calculatePercentile(values, 99)
        };
    }

    /**
     * Generate time-based buckets for aggregation
     */
    static generateTimeBuckets(startTime, endTime, bucketSize = 60000) {
        const buckets = [];
        let current = Math.floor(startTime / bucketSize) * bucketSize;
        const end = Math.ceil(endTime / bucketSize) * bucketSize;
        
        while (current < end) {
            buckets.push({
                start: current,
                end: current + bucketSize,
                label: new Date(current).toISOString()
            });
            current += bucketSize;
        }
        
        return buckets;
    }

    /**
     * Mask sensitive data in strings
     */
    static maskSensitiveData(str, visibleChars = 4) {
        if (typeof str !== 'string' || str.length <= visibleChars) {
            return str;
        }
        
        const visible = str.substring(0, visibleChars);
        const masked = '*'.repeat(Math.min(str.length - visibleChars, 8));
        
        return `${visible}${masked}`;
    }

    /**
     * Validate and normalize URL
     */
    static normalizeUrl(url) {
        try {
            const normalized = new URL(url);
            return normalized.toString();
        } catch (error) {
            throw new Error(`Invalid URL: ${url}`);
        }
    }

    /**
     * Rate limiting helper
     */
    static createRateLimiter(maxRequests, windowMs) {
        const requests = new Map();
        
        return (key) => {
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Clean old requests
            if (requests.has(key)) {
                requests.set(key, requests.get(key).filter(time => time > windowStart));
            } else {
                requests.set(key, []);
            }
            
            const requestTimes = requests.get(key);
            
            if (requestTimes.length >= maxRequests) {
                return false; // Rate limit exceeded
            }
            
            requestTimes.push(now);
            return true; // Request allowed
        };
    }

    /**
     * Convert object to query string
     */
    static objectToQueryString(obj) {
        const params = new URLSearchParams();
        
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null && value !== undefined) {
                if (Array.isArray(value)) {
                    value.forEach(item => params.append(key, item));
                } else {
                    params.append(key, value);
                }
            }
        }
        
        return params.toString();
    }
}

module.exports = { Helpers };