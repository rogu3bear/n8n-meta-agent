import { TemplateManager } from '../../services/templateManager';
import { AgentRegistry } from '../../services/agentRegistry';
import { TestUtils } from '../utils/testUtils';
import { AgentTemplate } from '../../types/template';

describe('TemplateManager', () => {
  let manager: TemplateManager;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    manager = new TemplateManager(registry);
  });

  describe('Template Management', () => {
    it('should create a template', async () => {
      const template = await manager.createTemplate({
        name: 'Test Template',
        description: 'Test Description',
        type: 'http',
        config: { test: 'config' }
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.description).toBe('Test Description');
      expect(template.type).toBe('http');
      expect(template.config).toEqual({ test: 'config' });
    });

    it('should get a template by id', async () => {
      const created = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      const retrieved = await manager.getTemplate(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should update a template', async () => {
      const created = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      const updated = await manager.updateTemplate(created.id, {
        name: 'Updated Template',
        description: 'Updated Description'
      });

      expect(updated.name).toBe('Updated Template');
      expect(updated.description).toBe('Updated Description');
    });

    it('should delete a template', async () => {
      const created = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      await manager.deleteTemplate(created.id);
      await expect(manager.getTemplate(created.id)).rejects.toThrow();
    });
  });

  describe('Template Validation', () => {
    it('should validate template structure', async () => {
      const invalidTemplate = {
        name: 'Invalid Template'
        // Missing required fields
      };

      await expect(manager.createTemplate(invalidTemplate)).rejects.toThrow();
    });

    it('should validate template type', async () => {
      const invalidTemplate = {
        name: 'Invalid Template',
        type: 'invalid_type'
      };

      await expect(manager.createTemplate(invalidTemplate)).rejects.toThrow();
    });

    it('should validate template configuration', async () => {
      const invalidTemplate = {
        name: 'Invalid Template',
        type: 'http',
        config: null // Invalid config
      };

      await expect(manager.createTemplate(invalidTemplate)).rejects.toThrow();
    });
  });

  describe('Template Queries', () => {
    it('should get templates by type', async () => {
      const httpTemplate = await manager.createTemplate({
        name: 'HTTP Template',
        type: 'http'
      });

      const functionTemplate = await manager.createTemplate({
        name: 'Function Template',
        type: 'function'
      });

      const httpTemplates = await manager.getTemplatesByType('http');
      const functionTemplates = await manager.getTemplatesByType('function');

      expect(httpTemplates).toContainEqual(httpTemplate);
      expect(functionTemplates).toContainEqual(functionTemplate);
    });

    it('should get templates by tag', async () => {
      const taggedTemplate = await manager.createTemplate({
        name: 'Tagged Template',
        type: 'http',
        tags: ['test', 'example']
      });

      const untaggedTemplate = await manager.createTemplate({
        name: 'Untagged Template',
        type: 'http'
      });

      const taggedTemplates = await manager.getTemplatesByTag('test');
      expect(taggedTemplates).toContainEqual(taggedTemplate);
      expect(taggedTemplates).not.toContainEqual(untaggedTemplate);
    });

    it('should search templates', async () => {
      const searchableTemplate = await manager.createTemplate({
        name: 'Searchable Template',
        description: 'This is a searchable template',
        type: 'http'
      });

      const otherTemplate = await manager.createTemplate({
        name: 'Other Template',
        description: 'This is not searchable',
        type: 'http'
      });

      const searchResults = await manager.searchTemplates('searchable');
      expect(searchResults).toContainEqual(searchableTemplate);
      expect(searchResults).not.toContainEqual(otherTemplate);
    });
  });

  describe('Template Dependencies', () => {
    it('should prevent deletion of in-use templates', async () => {
      const template = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      // Create an agent using the template
      await registry.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await expect(manager.deleteTemplate(template.id)).rejects.toThrow();
    });

    it('should track template usage', async () => {
      const template = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      const usage = await manager.getTemplateUsage(template.id);
      expect(usage).toBe(0);

      // Create an agent using the template
      await registry.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      const updatedUsage = await manager.getTemplateUsage(template.id);
      expect(updatedUsage).toBe(1);
    });
  });

  describe('Template Versioning', () => {
    it('should create template versions', async () => {
      const template = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      const version = await manager.createTemplateVersion(template.id, {
        name: 'Test Template v2',
        description: 'Updated description'
      });

      expect(version).toBeDefined();
      expect(version.version).toBe(2);
      expect(version.name).toBe('Test Template v2');
    });

    it('should get template version history', async () => {
      const template = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      await manager.createTemplateVersion(template.id, {
        name: 'Test Template v2'
      });

      const history = await manager.getTemplateVersionHistory(template.id);
      expect(history.length).toBe(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });

    it('should rollback to previous version', async () => {
      const template = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      await manager.createTemplateVersion(template.id, {
        name: 'Test Template v2'
      });

      const rolledBack = await manager.rollbackTemplate(template.id, 1);
      expect(rolledBack.name).toBe('Test Template');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template operations', async () => {
      const nonExistentId = 'non-existent-id';
      await expect(manager.getTemplate(nonExistentId)).rejects.toThrow();
      await expect(manager.updateTemplate(nonExistentId, {})).rejects.toThrow();
      await expect(manager.deleteTemplate(nonExistentId)).rejects.toThrow();
    });

    it('should handle template validation errors', async () => {
      const invalidTemplate = {
        name: 'Invalid Template',
        type: 'invalid_type',
        config: null
      };

      await expect(manager.createTemplate(invalidTemplate)).rejects.toThrow();
    });

    it('should handle version control errors', async () => {
      const template = await manager.createTemplate({
        name: 'Test Template',
        type: 'http'
      });

      await expect(manager.rollbackTemplate(template.id, 999)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle many templates', async () => {
      const startTime = Date.now();
      const numTemplates = 50;

      for (let i = 0; i < numTemplates; i++) {
        await manager.createTemplate({
          name: `Test Template ${i}`,
          type: 'http'
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with complex queries', async () => {
      // Create templates with various properties
      for (let i = 0; i < 20; i++) {
        await manager.createTemplate({
          name: `Template ${i}`,
          type: i % 2 === 0 ? 'http' : 'function',
          tags: [`tag${i}`, 'common'],
          description: `Description ${i}`
        });
      }

      const startTime = Date.now();
      const results = await Promise.all([
        manager.getTemplatesByType('http'),
        manager.getTemplatesByTag('common'),
        manager.searchTemplates('Template')
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.every(r => Array.isArray(r))).toBe(true);
    });
  });
}); 