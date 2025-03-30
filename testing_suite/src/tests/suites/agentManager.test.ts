import { AgentManager } from '../../services/agentManager';
import { AgentRegistry } from '../../services/agentRegistry';
import { N8nIntegrationManager } from '../../services/n8nIntegration';
import { TestUtils } from '../utils/testUtils';
import { Agent } from '../../types/agent';
import { AgentTemplate } from '../../types/template';
import { N8nMock } from '../mocks/n8nMock';

describe('AgentManager', () => {
  let manager: AgentManager;
  let registry: AgentRegistry;
  let integration: N8nIntegrationManager;
  let mockN8n: N8nMock;

  beforeEach(() => {
    mockN8n = new N8nMock();
    registry = new AgentRegistry();
    integration = new N8nIntegrationManager({
      apiUrl: 'http://localhost:5678',
      apiKey: 'test-key'
    });
    manager = new AgentManager(registry, integration);
  });

  afterEach(() => {
    mockN8n.clear();
  });

  describe('Agent Lifecycle', () => {
    it('should create an agent from template', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id,
        config: { test: 'config' }
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Test Agent');
      expect(agent.templateId).toBe(template.id);
      expect(agent.status).toBe('created');
    });

    it('should start an agent', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      const startedAgent = await manager.startAgent(agent.id);
      expect(startedAgent.status).toBe('running');
    });

    it('should stop an agent', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await manager.startAgent(agent.id);
      const stoppedAgent = await manager.stopAgent(agent.id);
      expect(stoppedAgent.status).toBe('stopped');
    });

    it('should delete an agent', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await manager.deleteAgent(agent.id);
      await expect(manager.getAgent(agent.id)).rejects.toThrow();
    });
  });

  describe('Agent State Management', () => {
    it('should update agent configuration', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id,
        config: { initial: 'config' }
      });

      const updatedAgent = await manager.updateAgentConfig(agent.id, {
        new: 'config'
      });

      expect(updatedAgent.config).toEqual({ new: 'config' });
    });

    it('should handle agent state transitions', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      expect(agent.status).toBe('created');
      
      const startedAgent = await manager.startAgent(agent.id);
      expect(startedAgent.status).toBe('running');

      const pausedAgent = await manager.pauseAgent(agent.id);
      expect(pausedAgent.status).toBe('paused');

      const resumedAgent = await manager.resumeAgent(agent.id);
      expect(resumedAgent.status).toBe('running');

      const stoppedAgent = await manager.stopAgent(agent.id);
      expect(stoppedAgent.status).toBe('stopped');
    });

    it('should validate state transitions', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await expect(manager.stopAgent(agent.id)).rejects.toThrow();
      await expect(manager.pauseAgent(agent.id)).rejects.toThrow();
      await expect(manager.resumeAgent(agent.id)).rejects.toThrow();
    });
  });

  describe('Agent Monitoring', () => {
    it('should get agent metrics', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await manager.startAgent(agent.id);
      const metrics = await manager.getAgentMetrics(agent.id);

      expect(metrics).toBeDefined();
      expect(metrics.status).toBe('running');
      expect(metrics.uptime).toBeDefined();
      expect(metrics.executions).toBeDefined();
    });

    it('should get agent logs', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await manager.startAgent(agent.id);
      const logs = await manager.getAgentLogs(agent.id);

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should monitor agent health', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await manager.startAgent(agent.id);
      const health = await manager.checkAgentHealth(agent.id);

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.lastCheck).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle agent creation errors', async () => {
      const invalidTemplate = { id: 'invalid' } as AgentTemplate;
      await expect(manager.createAgent({
        name: 'Test Agent',
        templateId: invalidTemplate.id
      })).rejects.toThrow();
    });

    it('should handle agent operation errors', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      // Configure mock to simulate errors
      mockN8n.setHealthStatus(false);

      await expect(manager.startAgent(agent.id)).rejects.toThrow();
    });

    it('should handle non-existent agent operations', async () => {
      const nonExistentId = 'non-existent-id';
      await expect(manager.getAgent(nonExistentId)).rejects.toThrow();
      await expect(manager.startAgent(nonExistentId)).rejects.toThrow();
      await expect(manager.stopAgent(nonExistentId)).rejects.toThrow();
      await expect(manager.deleteAgent(nonExistentId)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent agents', async () => {
      const template = TestUtils.createMockTemplate();
      const numAgents = 5;

      const startTime = Date.now();
      const agents = await Promise.all(
        Array(numAgents).fill(null).map((_, i) => 
          manager.createAgent({
            name: `Test Agent ${i}`,
            templateId: template.id
          })
        )
      );

      const startedAgents = await Promise.all(
        agents.map(agent => manager.startAgent(agent.id))
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(startedAgents.length).toBe(numAgents);
      expect(startedAgents.every(a => a.status === 'running')).toBe(true);
    });

    it('should maintain performance with many agents', async () => {
      const template = TestUtils.createMockTemplate();
      const numAgents = 50;

      const startTime = Date.now();
      for (let i = 0; i < numAgents; i++) {
        await manager.createAgent({
          name: `Test Agent ${i}`,
          templateId: template.id
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Event Handling', () => {
    it('should emit agent lifecycle events', async () => {
      const template = TestUtils.createMockTemplate();
      const events: any[] = [];

      manager.addListener('agent.created', (data) => events.push(data));
      manager.addListener('agent.started', (data) => events.push(data));
      manager.addListener('agent.stopped', (data) => events.push(data));

      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      await manager.startAgent(agent.id);
      await manager.stopAgent(agent.id);

      expect(events.length).toBe(3);
      expect(events.map(e => e.type)).toContain('agent.created');
      expect(events.map(e => e.type)).toContain('agent.started');
      expect(events.map(e => e.type)).toContain('agent.stopped');
    });

    it('should handle agent error events', async () => {
      const template = TestUtils.createMockTemplate();
      const events: any[] = [];

      manager.addListener('agent.error', (data) => events.push(data));

      const agent = await manager.createAgent({
        name: 'Test Agent',
        templateId: template.id
      });

      // Configure mock to simulate errors
      mockN8n.setHealthStatus(false);

      await expect(manager.startAgent(agent.id)).rejects.toThrow();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('agent.error');
    });
  });
}); 