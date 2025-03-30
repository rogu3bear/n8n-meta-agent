import { N8nIntegrationManager } from '../../services/n8nIntegration';
import { N8nMock } from '../mocks/n8nMock';
import { TestUtils } from '../utils/testUtils';
import { Agent } from '../../types/agent';
import { AgentTemplate } from '../../types/template';

describe('N8nIntegrationManager', () => {
  let integration: N8nIntegrationManager;
  let mockN8n: N8nMock;

  beforeEach(() => {
    mockN8n = new N8nMock();
    integration = new N8nIntegrationManager({
      apiUrl: 'http://localhost:5678',
      apiKey: 'test-key'
    });
  });

  afterEach(() => {
    mockN8n.clear();
  });

  describe('Workflow Translation', () => {
    it('should translate an agent to a workflow', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      const workflow = await integration.translateAgentToWorkflow(agent, template);

      expect(workflow).toBeDefined();
      expect(workflow.name).toContain(agent.name);
      expect(workflow.nodes.length).toBeGreaterThan(0);
      expect(workflow.connections).toBeDefined();
    });

    it('should handle different agent types', async () => {
      const template = TestUtils.createMockTemplate();
      const httpAgent = TestUtils.createMockAgent({ 
        templateId: template.id,
        type: 'http'
      });
      const functionAgent = TestUtils.createMockAgent({ 
        templateId: template.id,
        type: 'function'
      });

      const httpWorkflow = await integration.translateAgentToWorkflow(httpAgent, template);
      const functionWorkflow = await integration.translateAgentToWorkflow(functionAgent, template);

      expect(httpWorkflow.nodes.some(n => n.type.includes('http'))).toBe(true);
      expect(functionWorkflow.nodes.some(n => n.type.includes('function'))).toBe(true);
    });

    it('should cache translated workflows', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      const firstWorkflow = await integration.translateAgentToWorkflow(agent, template);
      const secondWorkflow = await integration.translateAgentToWorkflow(agent, template);

      expect(secondWorkflow).toBe(firstWorkflow); // Should return cached version
    });
  });

  describe('Workflow Execution', () => {
    it('should execute a workflow successfully', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      const result = await integration.executeWorkflow(agent);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle workflow execution errors', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      // Configure mock to simulate errors
      mockN8n.setHealthStatus(false);

      await expect(integration.executeWorkflow(agent)).rejects.toThrow();
    });

    it('should emit workflow events', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      const events: any[] = [];
      integration.addListener('workflow.started', (data) => events.push(data));
      integration.addListener('workflow.completed', (data) => events.push(data));

      await integration.executeWorkflow(agent);

      expect(events.length).toBe(2);
      expect(events[0].type).toBe('workflow.started');
      expect(events[1].type).toBe('workflow.completed');
    });
  });

  describe('Workflow Management', () => {
    it('should create a workflow', async () => {
      const workflow = TestUtils.createMockWorkflow();
      const result = await integration.createWorkflow(workflow);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(workflow.name);
    });

    it('should update a workflow', async () => {
      const workflow = TestUtils.createMockWorkflow();
      const created = await integration.createWorkflow(workflow);

      const updated = await integration.updateWorkflow(created.id, {
        ...created,
        name: 'Updated Workflow'
      });

      expect(updated.name).toBe('Updated Workflow');
    });

    it('should delete a workflow', async () => {
      const workflow = TestUtils.createMockWorkflow();
      const created = await integration.createWorkflow(workflow);

      const deleted = await integration.deleteWorkflow(created.id);
      expect(deleted).toBe(true);

      await expect(integration.getWorkflow(created.id)).rejects.toThrow();
    });

    it('should get workflow execution details', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      const execution = await integration.executeWorkflow(agent);
      const details = await integration.getExecution(execution.executionId);

      expect(details).toBeDefined();
      expect(details.id).toBe(execution.executionId);
    });
  });

  describe('Error Handling', () => {
    it('should handle API connection errors', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      // Configure mock to simulate connection errors
      mockN8n.setHealthStatus(false);

      await expect(integration.executeWorkflow(agent)).rejects.toThrow();
    });

    it('should handle invalid workflow data', async () => {
      const invalidWorkflow = { name: 'Invalid Workflow' };
      await expect(integration.createWorkflow(invalidWorkflow)).rejects.toThrow();
    });

    it('should handle non-existent workflow operations', async () => {
      const nonExistentId = 'non-existent-id';
      await expect(integration.getWorkflow(nonExistentId)).rejects.toThrow();
      await expect(integration.updateWorkflow(nonExistentId, {})).rejects.toThrow();
      await expect(integration.deleteWorkflow(nonExistentId)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle concurrent workflow executions', async () => {
      const template = TestUtils.createMockTemplate();
      const agents = Array(5).fill(null).map(() => 
        TestUtils.createMockAgent({ templateId: template.id })
      );

      const startTime = Date.now();
      const executions = await Promise.all(
        agents.map(agent => integration.executeWorkflow(agent))
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(executions.length).toBe(agents.length);
      expect(executions.every(e => e.success)).toBe(true);
    });

    it('should maintain performance with many workflows', async () => {
      const startTime = Date.now();
      const numWorkflows = 50;

      for (let i = 0; i < numWorkflows; i++) {
        const workflow = TestUtils.createMockWorkflow({ name: `Workflow ${i}` });
        await integration.createWorkflow(workflow);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Event Handling', () => {
    it('should add and remove event listeners', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      const events: any[] = [];
      const handler = (data: any) => events.push(data);

      integration.addListener('workflow.started', handler);
      await integration.executeWorkflow(agent);
      expect(events.length).toBe(1);

      integration.removeListener('workflow.started', handler);
      await integration.executeWorkflow(agent);
      expect(events.length).toBe(1); // Should not increase
    });

    it('should handle multiple event types', async () => {
      const template = TestUtils.createMockTemplate();
      const agent = TestUtils.createMockAgent({ templateId: template.id });

      const events: any[] = [];
      integration.addListener('workflow.started', (data) => events.push(data));
      integration.addListener('workflow.completed', (data) => events.push(data));
      integration.addListener('workflow.error', (data) => events.push(data));

      await integration.executeWorkflow(agent);

      expect(events.length).toBe(2);
      expect(events.map(e => e.type)).toContain('workflow.started');
      expect(events.map(e => e.type)).toContain('workflow.completed');
    });
  });
}); 