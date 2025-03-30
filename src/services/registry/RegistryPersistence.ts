import { promises as fs } from 'fs';
import path from 'path';
import { RegistryConfig, RegistryData, RegistryBackup } from '../../types/registry';
import { serializeRegistry, deserializeRegistry } from '../../types/registry';

export class RegistryPersistence {
  private config: RegistryConfig;
  private dataPath: string;
  private backupPath: string;

  constructor(config: RegistryConfig) {
    this.config = config;
    this.dataPath = path.resolve(config.storagePath);
    this.backupPath = path.resolve(config.backupPath);
  }

  async initialize(): Promise<void> {
    try {
      // Create necessary directories
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.mkdir(this.backupPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to initialize registry persistence: ${error}`);
    }
  }

  async loadData(): Promise<RegistryData> {
    try {
      const dataFile = path.join(this.dataPath, 'registry.json');
      const data = await fs.readFile(dataFile, 'utf-8');
      return deserializeRegistry(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Return default data if file doesn't exist
        return {
          agents: [],
          templates: [],
          lastUpdate: new Date(),
          version: '1.0.0'
        };
      }
      throw new Error(`Failed to load registry data: ${error}`);
    }
  }

  async saveData(data: RegistryData): Promise<void> {
    try {
      const dataFile = path.join(this.dataPath, 'registry.json');
      const serialized = serializeRegistry(data);
      await fs.writeFile(dataFile, serialized, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save registry data: ${error}`);
    }
  }

  async createBackup(reason: 'scheduled' | 'manual' | 'pre-update' | 'auto-recovery'): Promise<RegistryBackup> {
    try {
      const data = await this.loadData();
      const backup: RegistryBackup = {
        id: `backup_${Date.now()}`,
        timestamp: new Date(),
        data,
        reason
      };

      const backupFile = path.join(this.backupPath, `${backup.id}.json`);
      await fs.writeFile(backupFile, serializeRegistry(data), 'utf-8');

      // Clean up old backups if needed
      await this.cleanupOldBackups();

      return backup;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    try {
      const backupFile = path.join(this.backupPath, `${backupId}.json`);
      const backupData = await fs.readFile(backupFile, 'utf-8');
      const data = deserializeRegistry(backupData);
      await this.saveData(data);
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error}`);
    }
  }

  async listBackups(): Promise<RegistryBackup[]> {
    try {
      const files = await fs.readdir(this.backupPath);
      const backups: RegistryBackup[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const backupFile = path.join(this.backupPath, file);
          const backupData = await fs.readFile(backupFile, 'utf-8');
          const data = deserializeRegistry(backupData);
          backups.push({
            id: file.replace('.json', ''),
            timestamp: data.lastUpdate,
            data,
            reason: 'scheduled' // Default reason, could be stored in metadata
          });
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      throw new Error(`Failed to list backups: ${error}`);
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupFile = path.join(this.backupPath, `${backupId}.json`);
      await fs.unlink(backupFile);
    } catch (error) {
      throw new Error(`Failed to delete backup: ${error}`);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      if (backups.length <= this.config.maxBackups) {
        return;
      }

      // Sort backups by timestamp and keep only the most recent ones
      const backupsToDelete = backups
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(this.config.maxBackups);

      for (const backup of backupsToDelete) {
        await this.deleteBackup(backup.id);
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  async getStorageSize(): Promise<number> {
    try {
      let totalSize = 0;

      // Calculate main data file size
      const dataFile = path.join(this.dataPath, 'registry.json');
      try {
        const stats = await fs.stat(dataFile);
        totalSize += stats.size;
      } catch (error) {
        // File doesn't exist yet
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
      // Load current data
      const data = await this.loadData();

      // Remove any duplicate entries
      const uniqueAgents = new Map(data.agents.map(agent => [agent.id, agent]));
      const uniqueTemplates = new Map(data.templates.map(template => [template.id, template]));

      // Update data with unique entries
      data.agents = Array.from(uniqueAgents.values());
      data.templates = Array.from(uniqueTemplates.values());
      data.lastUpdate = new Date();

      // Save optimized data
      await this.saveData(data);

      // Create a backup before optimization
      await this.createBackup('pre-update');
    } catch (error) {
      throw new Error(`Failed to optimize registry: ${error}`);
    }
  }
} 