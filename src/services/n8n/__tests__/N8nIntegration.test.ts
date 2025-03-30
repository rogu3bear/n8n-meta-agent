import { N8nIntegration, N8nWorkflow } from '../N8nIntegration';
import { TemplateStorage } from '../../template/TemplateStorage';
import { TemplateValidationService } from '../../template/TemplateValidationService';
import { Template, TemplateVersion } from '../../../types/template';

// Mock dependencies
jest.mock('../../template/TemplateStorage');
jest.mock('../../template/TemplateValidationService');

describe('N8nIntegration', () => {
  let n8nIntegration: N8nIntegration;
  let mockTemplateStorage: jest.Mocked<TemplateStorage>;
  let mockTemplateValidator: jest.Mocked<TemplateValidationService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockTemplateStorage = {
      getInstance: jest.fn().mockReturnThis(),
      getTemplate: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      listTemplates: jest.fn(),
      addTemplateVersion: jest.fn(),
      createBackup: jest.fn(),
      restoreBackup: jest.fn(),
      getStats: jest.fn()
    } as any;

    mockTemplateValidator = {
      getInstance: jest.fn().mockReturnThis(),
      validateParameters: jest.fn(),
      validateDependencies: jest.fn()
    } as any;

    // Create instance
    n8nIntegration = N8nIntegration.getInstance();
  });

  describe('createWorkflowFromTemplate', () => {
    const mockTemplate: Template = {
      id: 'test-template',
      name: 'Test Template',
      description: 'Test template description',
      type: 'workflow',
      currentVersion: '1.0.0',
      versions: [
        {
          version: '1.0.0',
          content: 'test content',
          parameters: [
            {
              name: 'param1',
              type: 'string',
              required: true,
              description: 'Test parameter'
            }
          ]
        }
      ],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockParameters = {
      param1: 'test value'
    };

    it('should create a workflow from a valid template', async () => {
      // Setup mocks
      mockTemplateStorage.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateValidator.validateParameters.mockResolvedValue({
        isValid: true,
        errors: []
      });

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'workflow-1',
          name: 'Test Workflow',
          nodes: [],
          connections: [],
          settings: {}
        })
      });

      // Execute
      const result = await n8nIntegration.createWorkflowFromTemplate(
        'test-template',
        '1.0.0',
        mockParameters
      );

      // Verify
      expect(result).toBeDefined();
      expect(result.id).toBe('workflow-1');
      expect(result.name).toBe('Test Workflow');
      expect(mockTemplateStorage.getTemplate).toHaveBeenCalledWith('test-template');
      expect(mockTemplateValidator.validateParameters).toHaveBeenCalled();
    });

    it('should throw error if template not found', async () => {
      // Setup mocks
      mockTemplateStorage.getTemplate.mockResolvedValue(null);

      // Execute and verify
      await expect(
        n8nIntegration.createWorkflowFromTemplate(
          'non-existent',
          '1.0.0',
          mockParameters
        )
      ).rejects.toThrow('Template non-existent not found');
    });

    it('should throw error if version not found', async () => {
      // Setup mocks
      mockTemplateStorage.getTemplate.mockResolvedValue(mockTemplate);

      // Execute and verify
      await expect(
        n8nIntegration.createWorkflowFromTemplate(
          'test-template',
          '2.0.0',
          mockParameters
        )
      ).rejects.toThrow('Version 2.0.0 not found for template test-template');
    });

    it('should throw error if parameters are invalid', async () => {
      // Setup mocks
      mockTemplateStorage.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateValidator.validateParameters.mockResolvedValue({
        isValid: false,
        errors: ['Invalid parameter']
      });

      // Execute and verify
      await expect(
        n8nIntegration.createWorkflowFromTemplate(
          'test-template',
          '1.0.0',
          mockParameters
        )
      ).rejects.toThrow('Invalid parameters: Invalid parameter');
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a workflow and return execution ID', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          executionId: 'exec-1'
        })
      });

      // Execute
      const result = await n8nIntegration.executeWorkflow('workflow-1');

      // Verify
      expect(result).toBe('exec-1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workflows/workflow-1/execute'),
        expect.any(Object)
      );
    });

    it('should throw error if execution fails', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Execution failed'
      });

      // Execute and verify
      await expect(
        n8nIntegration.executeWorkflow('workflow-1')
      ).rejects.toThrow('Failed to execute workflow: Execution failed');
    });
  });

  describe('getWorkflowExecutionStatus', () => {
    it('should return execution status', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'completed'
        })
      });

      // Execute
      const result = await n8nIntegration.getWorkflowExecutionStatus('exec-1');

      // Verify
      expect(result).toBe('completed');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/executions/exec-1'),
        expect.any(Object)
      );
    });

    it('should throw error if status check fails', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Status check failed'
      });

      // Execute and verify
      await expect(
        n8nIntegration.getWorkflowExecutionStatus('exec-1')
      ).rejects.toThrow('Failed to get execution status: Status check failed');
    });
  });
}); 