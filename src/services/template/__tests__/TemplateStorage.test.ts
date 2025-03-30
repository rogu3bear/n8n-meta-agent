import { TemplateStorage } from '../TemplateStorage';
import { Template, CreateTemplate, UpdateTemplate, TemplateVersion } from '../../../types/template';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('TemplateStorage', () => {
  let storage: TemplateStorage;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdir(path.join(os.tmpdir(), 'template-storage-test'), { recursive: true });
    const backupDir = path.join(tempDir, 'backups');

    // Initialize storage
    storage = TemplateStorage.getInstance({
      basePath: tempDir,
      cacheSize: 100,
      backupEnabled: true,
      backupPath: backupDir,
      maxBackups: 5
    });

    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test',
        parameters: [{
          name: 'param1',
          type: 'string',
          description: 'Test parameter',
          required: true
        }],
        dependencies: [{
          name: 'dep1',
          version: '1.0.0',
          type: 'runtime',
          description: 'Test dependency'
        }],
        capabilities: [{
          name: 'cap1',
          description: 'Test capability',
          parameters: ['param1'],
          requiredPermissions: ['dep1']
        }],
        metadata: {
          author: 'Test Author',
          category: 'Test Category',
          tags: ['test'],
          license: 'MIT',
          repository: 'https://github.com/test/test',
          documentation: 'https://docs.test.com',
          examples: ['example1']
        }
      };

      const result = await storage.createTemplate(template);

      expect(result.id).toBeDefined();
      expect(result.name).toBe(template.name);
      expect(result.description).toBe(template.description);
      expect(result.type).toBe(template.type);
      expect(result.currentVersion).toBe('1.0.0');
      expect(result.versions).toHaveLength(1);
      expect(result.versions[0].version).toBe('1.0.0');
      expect(result.versions[0].parameters).toEqual(template.parameters);
      expect(result.versions[0].dependencies).toEqual(template.dependencies);
      expect(result.versions[0].capabilities).toEqual(template.capabilities);
      expect(result.metadata).toEqual({
        ...template.metadata,
        rating: 0,
        downloads: 0,
        lastUpdated: expect.any(Date)
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      // Verify file was created
      const files = await fs.readdir(tempDir);
      expect(files).toContain(`${result.id}.json`);
    });

    it('should handle invalid template data', async () => {
      const template: CreateTemplate = {
        name: '', // Invalid: empty name
        description: 'Test Description',
        type: 'test'
      };

      await expect(storage.createTemplate(template)).rejects.toThrow();
    });
  });

  describe('getTemplate', () => {
    it('should retrieve an existing template', async () => {
      // Create a template first
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test'
      };

      const created = await storage.createTemplate(template);
      const retrieved = await storage.getTemplate(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent template', async () => {
      const result = await storage.getTemplate('non-existent-id');
      expect(result).toBeNull();
    });

    it('should use cache for subsequent retrievals', async () => {
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test'
      };

      const created = await storage.createTemplate(template);
      
      // First retrieval (from storage)
      const first = await storage.getTemplate(created.id);
      
      // Delete the file to simulate cache-only access
      await fs.unlink(path.join(tempDir, `${created.id}.json`));
      
      // Second retrieval (from cache)
      const second = await storage.getTemplate(created.id);
      
      expect(first).toEqual(second);
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      // Create a template first
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test'
      };

      const created = await storage.createTemplate(template);

      // Update the template
      const update: UpdateTemplate = {
        name: 'Updated Template',
        description: 'Updated Description',
        type: 'updated',
        metadata: {
          author: 'Updated Author',
          category: 'Updated Category',
          tags: ['updated'],
          license: 'MIT',
          repository: 'https://github.com/test/updated',
          documentation: 'https://docs.test.com/updated',
          examples: ['updated1']
        }
      };

      const updated = await storage.updateTemplate(created.id, update);

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe(update.name);
      expect(updated.description).toBe(update.description);
      expect(updated.type).toBe(update.type);
      expect(updated.metadata).toEqual({
        ...update.metadata,
        rating: 0,
        downloads: 0,
        lastUpdated: expect.any(Date)
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should handle non-existent template', async () => {
      const update: UpdateTemplate = {
        name: 'Updated Template'
      };

      await expect(storage.updateTemplate('non-existent-id', update)).rejects.toThrow();
    });
  });

  describe('addTemplateVersion', () => {
    it('should add a new version to an existing template', async () => {
      // Create a template first
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test'
      };

      const created = await storage.createTemplate(template);

      // Add new version
      const newVersion: Omit<TemplateVersion, 'version'> = {
        changelog: 'Updated version',
        compatibility: {},
        parameters: [{
          name: 'param1',
          type: 'string',
          description: 'New parameter',
          required: true
        }],
        dependencies: [],
        capabilities: [],
        deprecated: false
      };

      const updated = await storage.addTemplateVersion(created.id, newVersion);

      expect(updated.versions).toHaveLength(2);
      expect(updated.currentVersion).toBe('1.1.0');
      expect(updated.versions[0].version).toBe('1.1.0');
      expect(updated.versions[1].version).toBe('1.0.0');
      expect(updated.versions[1].deprecated).toBe(true);
    });

    it('should handle non-existent template', async () => {
      const newVersion: Omit<TemplateVersion, 'version'> = {
        changelog: 'Updated version',
        compatibility: {},
        parameters: [],
        dependencies: [],
        capabilities: [],
        deprecated: false
      };

      await expect(storage.addTemplateVersion('non-existent-id', newVersion)).rejects.toThrow();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete an existing template', async () => {
      // Create a template first
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test'
      };

      const created = await storage.createTemplate(template);

      // Delete the template
      await storage.deleteTemplate(created.id);

      // Verify template was deleted
      const retrieved = await storage.getTemplate(created.id);
      expect(retrieved).toBeNull();

      // Verify file was deleted
      const files = await fs.readdir(tempDir);
      expect(files).not.toContain(`${created.id}.json`);
    });

    it('should handle non-existent template', async () => {
      await expect(storage.deleteTemplate('non-existent-id')).rejects.toThrow();
    });
  });

  describe('listTemplates', () => {
    it('should list all templates', async () => {
      // Create multiple templates
      const templates: CreateTemplate[] = [
        {
          name: 'Template 1',
          description: 'Description 1',
          type: 'test'
        },
        {
          name: 'Template 2',
          description: 'Description 2',
          type: 'test'
        }
      ];

      const created = await Promise.all(
        templates.map(template => storage.createTemplate(template))
      );

      // List templates
      const listed = await storage.listTemplates();

      expect(listed).toHaveLength(2);
      expect(listed.map(t => t.id)).toEqual(expect.arrayContaining(created.map(t => t.id)));
    });

    it('should return empty array when no templates exist', async () => {
      const listed = await storage.listTemplates();
      expect(listed).toHaveLength(0);
    });
  });

  describe('backup and restore', () => {
    it('should create and restore backup', async () => {
      // Create a template
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test'
      };

      const created = await storage.createTemplate(template);

      // Create backup
      await storage.createBackup();

      // Delete template
      await storage.deleteTemplate(created.id);

      // Get backup timestamp
      const backups = await fs.readdir(path.join(tempDir, 'backups'));
      const backupTimestamp = backups[0];

      // Restore backup
      await storage.restoreBackup(backupTimestamp);

      // Verify template was restored
      const restored = await storage.getTemplate(created.id);
      expect(restored).toEqual(created);
    });

    it('should handle backup cleanup', async () => {
      // Create multiple templates
      const templates: CreateTemplate[] = Array(6).fill(null).map((_, i) => ({
        name: `Template ${i + 1}`,
        description: `Description ${i + 1}`,
        type: 'test'
      }));

      await Promise.all(templates.map(template => storage.createTemplate(template)));

      // Create multiple backups
      for (let i = 0; i < 6; i++) {
        await storage.createBackup();
        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Verify only maxBackups (5) backups exist
      const backups = await fs.readdir(path.join(tempDir, 'backups'));
      expect(backups).toHaveLength(5);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Create multiple templates with multiple versions
      const templates: CreateTemplate[] = [
        {
          name: 'Template 1',
          description: 'Description 1',
          type: 'test'
        },
        {
          name: 'Template 2',
          description: 'Description 2',
          type: 'test'
        }
      ];

      const created = await Promise.all(
        templates.map(template => storage.createTemplate(template))
      );

      // Add versions to first template
      const newVersion: Omit<TemplateVersion, 'version'> = {
        changelog: 'Updated version',
        compatibility: {},
        parameters: [],
        dependencies: [],
        capabilities: [],
        deprecated: false
      };

      await storage.addTemplateVersion(created[0].id, newVersion);

      // Get stats
      const stats = await storage.getStats();

      expect(stats.totalTemplates).toBe(2);
      expect(stats.totalVersions).toBe(3); // 2 initial versions + 1 new version
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.cacheSize).toBe(2);
      expect(stats.lastBackup).toBeNull(); // No backup created yet
    });
  });
}); 