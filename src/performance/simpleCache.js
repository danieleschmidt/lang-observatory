/**
 * Simple in-memory cache with TTL and size limits
 */

class SimpleCache {
  constructor(options = {}) {
    this.max = options.max || 500;
    this.maxAge = options.maxAge || 60000; // 1 minute default
    this.stale = options.stale || false;
    this.updateAgeOnGet = options.updateAgeOnGet || false;

    this.cache = new Map();
    this.dispose = options.dispose || null;
  }

  set(key, value) {
    // Remove oldest item if at capacity
    if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      this.del(firstKey);
    }

    const item = {
      value,
      timestamp: Date.now(),
      accessed: Date.now(),
    };

    this.cache.set(key, item);
    return true;
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      return undefined;
    }

    const now = Date.now();
    const age = now - item.timestamp;

    // Check if expired
    if (this.maxAge > 0 && age > this.maxAge) {
      if (!this.stale) {
        this.del(key);
        return undefined;
      }
    }

    // Update access time if configured
    if (this.updateAgeOnGet) {
      item.accessed = now;
    }

    return item.value;
  }

  del(key) {
    const item = this.cache.get(key);
    if (item && this.dispose) {
      this.dispose(key, item.value);
    }
    return this.cache.delete(key);
  }

  reset() {
    if (this.dispose) {
      for (const [key, item] of this.cache) {
        this.dispose(key, item.value);
      }
    }
    this.cache.clear();
  }

  has(key) {
    return this.cache.has(key);
  }

  get itemCount() {
    return this.cache.size;
  }

  get length() {
    return this.cache.size;
  }

  keys() {
    return this.cache.keys();
  }

  values() {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  // Cleanup expired items
  prune() {
    const now = Date.now();
    const expired = [];

    for (const [key, item] of this.cache) {
      const age = now - item.timestamp;
      if (this.maxAge > 0 && age > this.maxAge) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.del(key);
    }

    return expired.length;
  }
}

module.exports = { SimpleCache };
