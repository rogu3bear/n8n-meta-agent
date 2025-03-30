import { promises as fs } from 'fs';
import path from 'path';
import { Template } from '../../types/template';
import { RegistryConfig } from '../../types/registry';

export class TemplatePersistence {
  private config: RegistryConfig;
  private templatePath: string;
  private backupPath: string;

  constructor(config: RegistryConfig) {
    this.config = config;
    this.templatePath = path.resolve(config.storagePath, 'templates');
    this.backupPath = path.resolve(config.backupPath, 'templates');
  }

  async initialize(): Promise<void> {
    try {
      // Create necessary directories
      await fs.mkdir(this.templatePath, { recursive: true });
      await fs.mkdir(this.backupPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to initialize template persistence: ${error}`);
    }
  }

  async saveTemplate(template: Template): Promise<void> {
    try {
      const templateFile = path.join(this.templatePath, `${template.id}.json`);
      await fs.writeFile(templateFile, JSON.stringify(template, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save template: ${error}`);
    }
  }

  async loadTemplate(id: string): Promise<Template | null> {
    try {
      const templateFile = path.join(this.templatePath, `${id}.json`);
      const data = await fs.readFile(templateFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to load template: ${error}`);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      const templateFile = path.join(this.templatePath, `${id}.json`);
      await fs.unlink(templateFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw new Error(`Failed to delete template: ${error}`);
    }
  }

  async listTemplates(): Promise<Template[]> {
    try {
      const files = await fs.readdir(this.templatePath);
      const templates: Template[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const templateFile = path.join(this.templatePath, file);
          const data = await fs.readFile(templateFile, 'utf-8');
          templates.push(JSON.parse(data));
        }
      }

      return templates;
    } catch (error) {
      throw new Error(`Failed to list templates: ${error}`);
    }
  }

  async createBackup(template: Template): Promise<void> {
    try {
      const backupFile = path.join(this.backupPath, `${template.id}_${Date.now()}.json`);
      await fs.writeFile(backupFile, JSON.stringify(template, null, 2), 'utf-8');
      await this.cleanupOldBackups(template.id);
    } catch (error) {
      throw new Error(`Failed to create template backup: ${error}`);
    }
  }

  async restoreBackup(templateId: string, timestamp: number): Promise<void> {
    try {
      const backupFile = path.join(this.backupPath, `${templateId}_${timestamp}.json`);
      const data = await fs.readFile(backupFile, 'utf-8');
      const template = JSON.parse(data);
      await this.saveTemplate(template);
    } catch (error) {
      throw new Error(`Failed to restore template backup: ${error}`);
    }
  }

  async listBackups(templateId: string): Promise<{ timestamp: number; template: Template }[]> {
    try {
      const files = await fs.readdir(this.backupPath);
      const backups: { timestamp: number; template: Template }[] = [];

      for (const file of files) {
        if (file.startsWith(`${templateId}_`) && file.endsWith('.json')) {
          const timestamp = parseInt(file.split('_')[1]);
          const backupFile = path.join(this.backupPath, file);
          const data = await fs.readFile(backupFile, 'utf-8');
          const template = JSON.parse(data);
          backups.push({ timestamp, template });
        }
      }

      return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      throw new Error(`Failed to list template backups: ${error}`);
    }
  }

  async deleteBackup(templateId: string, timestamp: number): Promise<void> {
    try {
      const backupFile = path.join(this.backupPath, `${templateId}_${timestamp}.json`);
      await fs.unlink(backupFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw new Error(`Failed to delete template backup: ${error}`);
    }
  }

  private async cleanupOldBackups(templateId: string): Promise<void> {
    try {
      const backups = await this.listBackups(templateId);
      if (backups.length <= this.config.maxBackups) {
        return;
      }

      // Sort backups by timestamp and keep only the most recent ones
      const backupsToDelete = backups
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(this.config.maxBackups);

      for (const backup of backupsToDelete) {
        await this.deleteBackup(templateId, backup.timestamp);
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  async getStorageSize(): Promise<number> {
    try {
      let totalSize = 0;

      // Calculate template files size
      const templateFiles = await fs.readdir(this.templatePath);
      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          const stats = await fs.stat(path.join(this.templatePath, file));
          totalSize += stats.size;
        }
      }

      // Calculate backup files size
      const backupFiles = await fs.readdir(this.backupPath);
      for (const file of backupFiles) {
        if (file.endsWith('.json')) {
          const stats = await fs.stat(path.join(this.backupPath, file));
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      throw new Error(`Failed to calculate storage size: ${error}`);
    }
  }

  async optimize(): Promise<void> {
    try {
      const templates = await this.listTemplates();
      
      // Remove any duplicate entries
      const uniqueTemplates = new Map(templates.map(t => [t.id, t]));
      
      // Save optimized templates
      for (const template of uniqueTemplates.values()) {
        await this.saveTemplate(template);
      }
    } catch (error) {
      throw new Error(`Failed to optimize templates: ${error}`);
    }
  }
} 