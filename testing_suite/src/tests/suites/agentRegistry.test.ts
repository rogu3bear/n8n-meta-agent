import { AgentRegistry } from '../../services/agentRegistry';
import { TestUtils } from '../utils/testUtils';
import { Agent, AgentStatus } from '../../types/agent';
import { AgentTemplate } from '../../types/template';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let testDir: string;

  beforeAll(async () => {
    // Create a temporary test directory
    testDir = path.join(app.getPath('userData'), 'test-registry');
    await fs.mkdir(testDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create a fresh registry instance for each test
    registry = new AgentRegistry();
    await registry.init();
  });

  afterEach(async () => {
    // Clean up after each test
    await registry.cleanup();
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Agent Management', () => {
    it('should create a new agent', async () => {
      const template = TestUtils.createMockTemplate();
      const parameters = { testParam: 'test value' };

      const agent = await registry.createAgent(template, parameters);

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.templateId).toBe(template.id);
      expect(agent.parameters).toEqual(parameters);
      expect(agent.status).toBe('created');
    });

    it('should retrieve an agent by ID', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await registry.createAgent(template, { testParam: 'test value' });

      const retrieved = await registry.getAgent(agent.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(agent.id);
    });

    it('should update an agent', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await registry.createAgent(template, { testParam: 'test value' });

      const updatedAgent = {
        ...agent,
        name: 'Updated Agent',
        parameters: { testParam: 'updated value' }
      };

      const result = await registry.updateAgent(updatedAgent);
      expect(result.name).toBe('Updated Agent');
      expect(result.parameters.testParam).toBe('updated value');
    });

    it('should delete an agent', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await registry.createAgent(template, { testParam: 'test value' });

      const deleted = await registry.deleteAgent(agent.id);
      expect(deleted).toBe(true);

      const retrieved = await registry.getAgent(agent.id);
      expect(retrieved).toBeUndefined();
    });

    it('should update agent status', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await registry.createAgent(template, { testParam: 'test value' });

      const updated = await registry.updateAgentStatus(agent.id, 'running');
      expect(updated.status).toBe('running');
      expect(updated.lastRunAt).toBeDefined();
    });
  });

  describe('Template Management', () => {
    it('should add a new template', async () => {
      const template = TestUtils.createMockTemplate();
      const result = await registry.addTemplate(template);

      expect(result).toBeDefined();
      expect(result.id).toBe(template.id);
    });

    it('should retrieve a template by ID', async () => {
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);

      const retrieved = await registry.getTemplate(template.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(template.id);
    });

    it('should delete a template', async () => {
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);

      const deleted = await registry.deleteTemplate(template.id);
      expect(deleted).toBe(true);

      const retrieved = await registry.getTemplate(template.id);
      expect(retrieved).toBeUndefined();
    });

    it('should not delete a template in use by agents', async () => {
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);

      // Create an agent using the template
      await registry.createAgent(template, { testParam: 'test value' });

      await expect(registry.deleteTemplate(template.id)).rejects.toThrow();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test data
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);

      // Create agents with different statuses
      await registry.createAgent(template, { testParam: 'value1' });
      await registry.createAgent(template, { testParam: 'value2' });
      const runningAgent = await registry.createAgent(template, { testParam: 'value3' });
      await registry.updateAgentStatus(runningAgent.id, 'running');
    });

    it('should get agents by status', async () => {
      const runningAgents = await registry.getAgentsByStatus('running');
      expect(runningAgents.length).toBe(1);
      expect(runningAgents[0].status).toBe('running');
    });

    it('should get agents by template', async () => {
      const template = await registry.getTemplate(TestUtils.createMockTemplate().id);
      const templateAgents = await registry.getAgentsByTemplate(template!.id);
      expect(templateAgents.length).toBeGreaterThan(0);
      expect(templateAgents[0].templateId).toBe(template!.id);
    });

    it('should get agents by tag', async () => {
      const agents = await registry.getAgentsByTag('test');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].tags).toContain('test');
    });

    it('should get agents by owner', async () => {
      const agents = await registry.getAgentsByOwner('test-user');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].owner).toBe('test-user');
    });
  });

  describe('Backup and Recovery', () => {
    it('should create a backup', async () => {
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);
      await registry.createAgent(template, { testParam: 'test value' });

      const backup = await registry.createBackup({ reason: 'manual' });
      expect(backup).toBeDefined();
      expect(backup.data.agents.length).toBe(1);
      expect(backup.data.templates.length).toBe(1);
    });

    it('should restore from backup', async () => {
      // Create initial data
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);
      await registry.createAgent(template, { testParam: 'test value' });

      // Create backup
      const backup = await registry.createBackup({ reason: 'manual' });

      // Clear registry
      await registry.cleanup();

      // Restore from backup
      const result = await registry.restoreFromBackup(backup.id);
      expect(result.success).toBe(true);
      expect(result.data.agents.length).toBe(1);
      expect(result.data.templates.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid agent creation', async () => {
      const invalidTemplate = TestUtils.createMockTemplate({ id: '' });
      await expect(registry.createAgent(invalidTemplate, {})).rejects.toThrow();
    });

    it('should handle invalid template creation', async () => {
      const invalidTemplate = TestUtils.createMockTemplate({ id: '' });
      await expect(registry.addTemplate(invalidTemplate)).rejects.toThrow();
    });

    it('should handle non-existent agent updates', async () => {
      const nonExistentAgent = TestUtils.createMockAgent();
      await expect(registry.updateAgent(nonExistentAgent)).rejects.toThrow();
    });

    it('should handle non-existent template updates', async () => {
      const nonExistentTemplate = TestUtils.createMockTemplate();
      await expect(registry.deleteTemplate(nonExistentTemplate.id)).resolves.toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of agents', async () => {
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);

      const startTime = Date.now();
      const numAgents = 100;

      for (let i = 0; i < numAgents; i++) {
        await registry.createAgent(template, { testParam: `value${i}` });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with many queries', async () => {
      const template = TestUtils.createMockTemplate();
      await registry.addTemplate(template);

      // Create test agents
      for (let i = 0; i < 50; i++) {
        await registry.createAgent(template, { testParam: `value${i}` });
      }

      const startTime = Date.now();
      const numQueries = 100;

      for (let i = 0; i < numQueries; i++) {
        await registry.getAgentsByStatus('created');
        await registry.getAgentsByTemplate(template.id);
        await registry.getAgentsByTag('test');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
}); 