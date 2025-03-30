import { RegistryConfig } from '../../types/registry';
import { AgentRegistry } from './AgentRegistry';
import { RegistryPersistence } from './RegistryPersistence';
import { RegistryEventEmitter } from './RegistryEventEmitter';

export class RegistryFactory {
  private static instance: AgentRegistry | null = null;
  private static persistence: RegistryPersistence | null = null;
  private static eventEmitter: RegistryEventEmitter | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  static async initialize(config: RegistryConfig): Promise<void> {
    try {
      // Initialize event emitter
      this.eventEmitter = new RegistryEventEmitter();

      // Initialize persistence
      this.persistence = new RegistryPersistence(config);
      await this.persistence.initialize();

      // Initialize registry
      this.instance = new AgentRegistry(config, this.eventEmitter);
    } catch (error) {
      throw new Error(`Failed to initialize registry: ${error}`);
    }
  }

  static getRegistry(): AgentRegistry {
    if (!this.instance) {
      throw new Error('Registry not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  static getPersistence(): RegistryPersistence {
    if (!this.persistence) {
      throw new Error('Registry persistence not initialized. Call initialize() first.');
    }
    return this.persistence;
  }

  static getEventEmitter(): RegistryEventEmitter {
    if (!this.eventEmitter) {
      throw new Error('Registry event emitter not initialized. Call initialize() first.');
    }
    return this.eventEmitter;
  }

  static async shutdown(): Promise<void> {
    try {
      // Save final state
      if (this.instance && this.persistence) {
        const data = await this.persistence.loadData();
        await this.persistence.saveData(data);
      }

      // Clear instances
      this.instance = null;
      this.persistence = null;
      this.eventEmitter = null;
    } catch (error) {
      throw new Error(`Failed to shutdown registry: ${error}`);
    }
  }

  static isInitialized(): boolean {
    return this.instance !== null && this.persistence !== null && this.eventEmitter !== null;
  }

  static async createDefaultConfig(): Promise<RegistryConfig> {
    return {
      storagePath: './data/registry',
      backupPath: './data/backups',
      maxBackups: 10,
      backupInterval: 86400000, // 24 hours
      cleanupInterval: 604800000, // 7 days
      optimizeInterval: 2592000000, // 30 days
      compressionEnabled: true
    };
  }
} 