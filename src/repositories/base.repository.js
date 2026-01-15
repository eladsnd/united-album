import { promises as fs } from 'fs';
import path from 'path';

/**
 * Base repository for JSON file storage
 * Provides CRUD operations with automatic serialization
 */
export class BaseRepository {
  /**
   * @param {string} filePath - Path to JSON storage file
   * @param {string} idField - Name of the ID field (default: 'id')
   */
  constructor(filePath, idField = 'id') {
    this.filePath = filePath;
    this.idField = idField;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Read all entities from storage
   * @returns {Promise<Array>} Array of entities
   */
  async findAll() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty array
        return [];
      }
      throw error;
    }
  }

  /**
   * Find entity by ID
   * @param {string|number} id - Entity ID
   * @returns {Promise<Object|null>} Entity or null if not found
   */
  async findById(id) {
    const entities = await this.findAll();
    return entities.find((entity) => entity[this.idField] === id) || null;
  }

  /**
   * Find entities matching criteria
   * @param {Function} predicate - Filter function
   * @returns {Promise<Array>} Matching entities
   */
  async findWhere(predicate) {
    const entities = await this.findAll();
    return entities.filter(predicate);
  }

  /**
   * Find single entity matching criteria
   * @param {Function} predicate - Filter function
   * @returns {Promise<Object|null>} First matching entity or null
   */
  async findOne(predicate) {
    const entities = await this.findAll();
    return entities.find(predicate) || null;
  }

  /**
   * Save a new entity or update existing
   * @param {Object} entity - Entity to save
   * @returns {Promise<Object>} Saved entity
   */
  async save(entity) {
    const entities = await this.findAll();

    // Check if entity exists
    const existingIndex = entities.findIndex(
      (e) => e[this.idField] === entity[this.idField]
    );

    if (existingIndex !== -1) {
      // Update existing entity
      entities[existingIndex] = { ...entities[existingIndex], ...entity };
      await this.writeAll(entities);
      return entities[existingIndex];
    } else {
      // Add new entity
      // Generate ID if not provided
      if (!entity[this.idField]) {
        entity[this.idField] = this.generateId(entities);
      }
      entities.push(entity);
      await this.writeAll(entities);
      return entity;
    }
  }

  /**
   * Update entity by ID
   * @param {string|number} id - Entity ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated entity or null
   */
  async update(id, updates) {
    const entities = await this.findAll();
    const index = entities.findIndex((e) => e[this.idField] === id);

    if (index === -1) {
      return null;
    }

    entities[index] = { ...entities[index], ...updates };
    await this.writeAll(entities);
    return entities[index];
  }

  /**
   * Delete entity by ID
   * @param {string|number} id - Entity ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(id) {
    const entities = await this.findAll();
    const filtered = entities.filter((e) => e[this.idField] !== id);

    if (filtered.length === entities.length) {
      return false; // Nothing deleted
    }

    await this.writeAll(filtered);
    return true;
  }

  /**
   * Delete entities matching criteria
   * @param {Function} predicate - Filter function
   * @returns {Promise<number>} Number of deleted entities
   */
  async deleteWhere(predicate) {
    const entities = await this.findAll();
    const filtered = entities.filter((e) => !predicate(e));
    const deletedCount = entities.length - filtered.length;

    if (deletedCount > 0) {
      await this.writeAll(filtered);
    }

    return deletedCount;
  }

  /**
   * Count entities
   * @param {Function} [predicate] - Optional filter function
   * @returns {Promise<number>} Count of entities
   */
  async count(predicate = null) {
    const entities = await this.findAll();
    return predicate ? entities.filter(predicate).length : entities.length;
  }

  /**
   * Write all entities to storage (queued to prevent race conditions)
   * @private
   * @param {Array} entities - Entities to write
   * @returns {Promise<void>}
   */
  async writeAll(entities) {
    this.writeQueue = this.writeQueue.then(async () => {
      const tempFile = `${this.filePath}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(entities, null, 2));
      await fs.rename(tempFile, this.filePath);
    });
    return this.writeQueue;
  }

  /**
   * Generate new ID for entity
   * @private
   * @param {Array} entities - Existing entities
   * @returns {number} New ID
   */
  generateId(entities) {
    if (entities.length === 0) {
      return 1;
    }
    const maxId = Math.max(...entities.map((e) => e[this.idField] || 0));
    return maxId + 1;
  }

  /**
   * Clear all entities (use with caution!)
   * @returns {Promise<void>}
   */
  async clear() {
    await this.writeAll([]);
  }
}
