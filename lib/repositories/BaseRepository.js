/**
 * Base Repository (Template Method Pattern)
 *
 * Abstract base class for all Prisma repositories.
 * Provides common CRUD operations with automatic JSON serialization.
 *
 * Design Pattern: Template Method
 * - Defines the skeleton of operations in base class
 * - Subclasses override specific steps (model name, serialization)
 *
 * Benefits:
 * - Eliminates 80% of duplicate CRUD code
 * - Automatic JSON array/object serialization for SQLite
 * - Consistent error handling across all repositories
 * - Single source of truth for database operations
 *
 * Usage:
 * ```javascript
 * class PhotoRepository extends BaseRepository {
 *   getModel() { return 'photo'; }
 *   serialize(data) { return { ...data, faceIds: JSON.stringify(data.faceIds) }; }
 *   deserialize(record) { return { ...record, faceIds: JSON.parse(record.faceIds) }; }
 * }
 * ```
 */

import prisma from '../prisma.js';
import { NotFoundError, InternalServerError } from '../api/errors.js';

export class BaseRepository {
  /**
   * Get Prisma client instance
   * @returns {Object} Prisma client
   */
  get prisma() {
    return prisma;
  }

  /**
   * Get Prisma model name (must be overridden by subclass)
   * @abstract
   * @returns {string} Model name (e.g., 'photo', 'face', 'challenge')
   */
  getModel() {
    throw new Error('getModel() must be implemented by subclass');
  }

  /**
   * Get Prisma model client
   * @returns {Object} Prisma model client
   */
  _getClient() {
    const modelName = this.getModel();
    if (!prisma[modelName]) {
      throw new Error(`Prisma model "${modelName}" not found`);
    }
    return prisma[modelName];
  }

  /**
   * Serialize data before saving to database
   * Override this to handle JSON array/object conversion
   *
   * @param {Object} data - Data to serialize
   * @returns {Object} Serialized data
   */
  serialize(data) {
    return data; // Default: no serialization
  }

  /**
   * Deserialize data after reading from database
   * Override this to parse JSON strings back to arrays/objects
   *
   * @param {Object} record - Record from database
   * @returns {Object} Deserialized data
   */
  deserialize(record) {
    return record; // Default: no deserialization
  }

  /**
   * Deserialize array of records
   * @private
   * @param {Array} records - Records from database
   * @returns {Array} Deserialized records
   */
  _deserializeMany(records) {
    return records.map(record => this.deserialize(record));
  }

  /**
   * Create a new record
   *
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} Created record (deserialized)
   * @throws {InternalServerError} When creation fails
   */
  async create(data) {
    try {
      const serialized = this.serialize(data);
      const client = this._getClient();
      const record = await client.create({ data: serialized });
      return this.deserialize(record);
    } catch (error) {
      console.error(`[${this.constructor.name}] Create failed:`, error);
      throw new InternalServerError(
        `Failed to create ${this.getModel()} record`,
        'DATABASE_CREATE_FAILED'
      );
    }
  }

  /**
   * Find all records with optional filtering and ordering
   *
   * @param {Object} options - Query options
   * @param {Object} options.where - Where clause
   * @param {Object} options.orderBy - Order by clause
   * @param {number} options.take - Limit results
   * @param {number} options.skip - Skip results
   * @returns {Promise<Array>} Found records (deserialized)
   * @throws {InternalServerError} When query fails
   */
  async findMany(options = {}) {
    try {
      const client = this._getClient();
      const records = await client.findMany(options);
      return this._deserializeMany(records);
    } catch (error) {
      console.error(`[${this.constructor.name}] FindMany failed:`, error);
      throw new InternalServerError(
        `Failed to query ${this.getModel()} records`,
        'DATABASE_QUERY_FAILED'
      );
    }
  }

  /**
   * Find a single record by unique field
   *
   * @param {Object} where - Where clause (e.g., { id: 123 })
   * @returns {Promise<Object|null>} Found record (deserialized) or null
   * @throws {InternalServerError} When query fails
   */
  async findUnique(where) {
    try {
      const client = this._getClient();
      const record = await client.findUnique({ where });
      return record ? this.deserialize(record) : null;
    } catch (error) {
      console.error(`[${this.constructor.name}] FindUnique failed:`, error);
      throw new InternalServerError(
        `Failed to find ${this.getModel()} record`,
        'DATABASE_QUERY_FAILED'
      );
    }
  }

  /**
   * Find first record matching criteria
   *
   * @param {Object} options - Query options (where, orderBy, etc.)
   * @returns {Promise<Object|null>} Found record (deserialized) or null
   * @throws {InternalServerError} When query fails
   */
  async findFirst(options = {}) {
    try {
      const client = this._getClient();
      const record = await client.findFirst(options);
      return record ? this.deserialize(record) : null;
    } catch (error) {
      console.error(`[${this.constructor.name}] FindFirst failed:`, error);
      throw new InternalServerError(
        `Failed to find ${this.getModel()} record`,
        'DATABASE_QUERY_FAILED'
      );
    }
  }

  /**
   * Update a record
   *
   * @param {Object} where - Where clause (e.g., { id: 123 })
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated record (deserialized)
   * @throws {NotFoundError} When record doesn't exist
   * @throws {InternalServerError} When update fails
   */
  async update(where, data) {
    try {
      const serialized = this.serialize(data);
      const client = this._getClient();
      const record = await client.update({
        where,
        data: serialized,
      });
      return this.deserialize(record);
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma error: Record not found
        throw new NotFoundError(`${this.getModel()} record not found`);
      }
      console.error(`[${this.constructor.name}] Update failed:`, error);
      throw new InternalServerError(
        `Failed to update ${this.getModel()} record`,
        'DATABASE_UPDATE_FAILED'
      );
    }
  }

  /**
   * Delete a record
   *
   * @param {Object} where - Where clause (e.g., { id: 123 })
   * @returns {Promise<Object>} Deleted record (deserialized)
   * @throws {NotFoundError} When record doesn't exist
   * @throws {InternalServerError} When deletion fails
   */
  async delete(where) {
    try {
      const client = this._getClient();
      const record = await client.delete({ where });
      return this.deserialize(record);
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma error: Record not found
        throw new NotFoundError(`${this.getModel()} record not found`);
      }
      console.error(`[${this.constructor.name}] Delete failed:`, error);
      throw new InternalServerError(
        `Failed to delete ${this.getModel()} record`,
        'DATABASE_DELETE_FAILED'
      );
    }
  }

  /**
   * Delete many records
   *
   * @param {Object} where - Where clause
   * @returns {Promise<{count: number}>} Number of deleted records
   * @throws {InternalServerError} When deletion fails
   */
  async deleteMany(where = {}) {
    try {
      const client = this._getClient();
      return await client.deleteMany({ where });
    } catch (error) {
      console.error(`[${this.constructor.name}] DeleteMany failed:`, error);
      throw new InternalServerError(
        `Failed to delete ${this.getModel()} records`,
        'DATABASE_DELETE_FAILED'
      );
    }
  }

  /**
   * Count records
   *
   * @param {Object} where - Where clause (optional)
   * @returns {Promise<number>} Count of records
   * @throws {InternalServerError} When count fails
   */
  async count(where = {}) {
    try {
      const client = this._getClient();
      return await client.count({ where });
    } catch (error) {
      console.error(`[${this.constructor.name}] Count failed:`, error);
      throw new InternalServerError(
        `Failed to count ${this.getModel()} records`,
        'DATABASE_QUERY_FAILED'
      );
    }
  }

  /**
   * Upsert a record (create if not exists, update if exists)
   *
   * @param {Object} where - Where clause for finding existing record
   * @param {Object} create - Data to use if creating
   * @param {Object} update - Data to use if updating
   * @returns {Promise<Object>} Upserted record (deserialized)
   * @throws {InternalServerError} When upsert fails
   */
  async upsert(where, create, update) {
    try {
      const serializedCreate = this.serialize(create);
      const serializedUpdate = this.serialize(update);
      const client = this._getClient();
      const record = await client.upsert({
        where,
        create: serializedCreate,
        update: serializedUpdate,
      });
      return this.deserialize(record);
    } catch (error) {
      console.error(`[${this.constructor.name}] Upsert failed:`, error);
      throw new InternalServerError(
        `Failed to upsert ${this.getModel()} record`,
        'DATABASE_UPSERT_FAILED'
      );
    }
  }
}
