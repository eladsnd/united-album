/**
 * Environment-Aware Logger
 *
 * Production-ready logging utility that:
 * - Only logs debug/info messages in development
 * - Always logs errors and warnings
 * - Works in both browser and Node.js environments
 * - Can be easily swapped for services like Sentry
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Logger utility with environment-aware methods
 */
export const logger = {
  /**
   * Debug messages - only in development
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isDevelopment && !isTest) {
      console.log(...args);
    }
  },

  /**
   * Info messages - only in development
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    if (isDevelopment && !isTest) {
      console.info(...args);
    }
  },

  /**
   * Warning messages - always logged
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Error messages - always logged
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Log messages - only in development (alias for debug)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDevelopment && !isTest) {
      console.log(...args);
    }
  }
};

export default logger;
