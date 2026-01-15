/**
 * Simple Dependency Injection Container
 * Inspired by NestJS but simplified for Next.js integration
 */
class Container {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a service with its dependencies
   * @param {string} name - Service name
   * @param {Function} factory - Factory function that creates the service
   * @param {boolean} singleton - Whether to create a singleton instance
   */
  register(name, factory, singleton = true) {
    this.services.set(name, { factory, singleton });
  }

  /**
   * Get a service instance
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    const service = this.services.get(name);

    if (!service) {
      throw new Error(`Service '${name}' not found in container`);
    }

    // Return singleton if exists
    if (service.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Create new instance
    const instance = service.factory(this);

    // Store singleton
    if (service.singleton) {
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Check if service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Clear all singletons (useful for testing)
   */
  clearSingletons() {
    this.singletons.clear();
  }

  /**
   * Reset container (remove all services)
   */
  reset() {
    this.services.clear();
    this.singletons.clear();
  }
}

// Create global container instance
const container = new Container();

// Export container and helper functions
export { container };

/**
 * Injectable decorator (simplified for JavaScript)
 * Marks a class as injectable - mainly for documentation
 * @returns {Function} Class decorator
 */
export function Injectable() {
  return function (target) {
    target.prototype.__injectable__ = true;
    return target;
  };
}

/**
 * Get service from container
 * @param {string} name - Service name
 * @returns {*} Service instance
 */
export function getService(name) {
  return container.get(name);
}

/**
 * Register service in container
 * @param {string} name - Service name
 * @param {Function} factory - Factory function
 * @param {boolean} singleton - Whether to use singleton pattern
 */
export function registerService(name, factory, singleton = true) {
  container.register(name, factory, singleton);
}
