import { RegistryConfig } from '../../types/registry';
import { TemplateManager } from './TemplateManager';
import { TemplatePersistence } from './TemplatePersistence';
import { RegistryEventEmitter } from '../registry/RegistryEventEmitter';

export class TemplateFactory {
  private static instance: TemplateManager | null = null;
  private static persistence: TemplatePersistence | null = null;
  private static eventEmitter: RegistryEventEmitter | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  static async initialize(config: RegistryConfig): Promise<void> {
    try {
      // Initialize event emitter
      this.eventEmitter = new RegistryEventEmitter();

      // Initialize persistence
      this.persistence = new TemplatePersistence(config);
      await this.persistence.initialize();

      // Initialize template manager
      this.instance = new TemplateManager(this.eventEmitter);

      // Load existing templates
      const templates = await this.persistence.listTemplates();
      for (const template of templates) {
        this.instance.createTemplate({
          name: template.name,
          description: template.description,
          type: template.type,
          compatibility: template.versions[0].compatibility,
          parameters: template.versions[0].parameters,
          dependencies: template.versions[0].dependencies,
          capabilities: template.versions[0].capabilities,
          metadata: template.metadata
        });
      }
    } catch (error) {
      throw new Error(`Failed to initialize template management: ${error}`);
    }
  }

  static getTemplateManager(): TemplateManager {
    if (!this.instance) {
      throw new Error('Template manager not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  static getPersistence(): TemplatePersistence {
    if (!this.persistence) {
      throw new Error('Template persistence not initialized. Call initialize() first.');
    }
    return this.persistence;
  }

  static getEventEmitter(): RegistryEventEmitter {
    if (!this.eventEmitter) {
      throw new Error('Template event emitter not initialized. Call initialize() first.');
    }
    return this.eventEmitter;
  }

  static async shutdown(): Promise<void> {
    try {
      // Save final state
      if (this.instance && this.persistence) {
        const templates = await this.persistence.listTemplates();
        for (const template of templates) {
          await this.persistence.saveTemplate(template);
        }
      }

      // Clear instances
      this.instance = null;
      this.persistence = null;
      this.eventEmitter = null;
    } catch (error) {
      throw new Error(`Failed to shutdown template management: ${error}`);
    }
  }

  static isInitialized(): boolean {
    return this.instance !== null && this.persistence !== null && this.eventEmitter !== null;
  }

  static async createDefaultConfig(): Promise<RegistryConfig> {
    return {
      storagePath: './data/templates',
      backupPath: './data/backups',
      maxBackups: 10,
      backupInterval: 86400000, // 24 hours
      cleanupInterval: 604800000, // 7 days
      optimizeInterval: 2592000000, // 30 days
      compressionEnabled: true
    };
  }
} 