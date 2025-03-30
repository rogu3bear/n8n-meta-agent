import { WrapperInterface, WrapperConfig, WorkflowStatus } from '../WrapperInterface';
import { N8nIntegration } from '../../n8n/N8nIntegration';
import { TemplateStorage } from '../../template/TemplateStorage';
import { Template } from '../../../types/template';

// Mock dependencies
jest.mock('../../n8n/N8nIntegration');
jest.mock('../../template/TemplateStorage');

describe('WrapperInterface', () => {
  let wrapperInterface: WrapperInterface;
  let mockN8nIntegration: jest.Mocked<N8nIntegration>;
  let mockTemplateStorage: jest.Mocked<TemplateStorage>;
  let mockConfig: WrapperConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockN8nIntegration = {
      getInstance: jest.fn().mockReturnThis(),
      createWorkflowFromTemplate: jest.fn(),
      executeWorkflow: jest.fn(),
      getWorkflowExecutionStatus: jest.fn()
    } as any;

    mockTemplateStorage = {
      getInstance: jest.fn().mockReturnThis(),
      getTemplate: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      listTemplates: jest.fn()
    } as any;

    // Setup config
    mockConfig = {
      n8nUrl: 'http://localhost:5678',
      n8nApiKey: 'test-key',
      templateDir: '/templates',
      logLevel: 'info'
    };

    // Create instance
    wrapperInterface = WrapperInterface.getInstance(mockConfig);
  });

  describe('createAndExecuteWorkflow', () => {
    const mockTemplate: Template = {
      id: 'test-template',
      name: 'Test Template',
      description: 'Test template description',
      type: 'workflow',
      currentVersion: '1.0.0',
      versions: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockParameters = {
      param1: 'value1'
    };

    it('should create and execute a workflow successfully', async () => {
      // Setup mocks
      mockN8nIntegration.createWorkflowFromTemplate.mockResolvedValue({
        id: 'workflow-1',
        name: 'Test Workflow',
        nodes: [],
        connections: [],
        settings: {}
      });
      mockN8nIntegration.executeWorkflow.mockResolvedValue('exec-1');

      // Execute
      const result = await wrapperInterface.createAndExecuteWorkflow(
        'test-template',
        '1.0.0',
        mockParameters
      );

      // Verify
      expect(result).toBe('exec-1');
      expect(mockN8nIntegration.createWorkflowFromTemplate).toHaveBeenCalledWith(
        'test-template',
        '1.0.0',
        mockParameters
      );
      expect(mockN8nIntegration.executeWorkflow).toHaveBeenCalledWith('workflow-1');
    });

    it('should emit error event on failure', async () => {
      // Setup mocks
      mockN8nIntegration.createWorkflowFromTemplate.mockRejectedValue(
        new Error('Creation failed')
      );

      // Setup event listener
      const errorHandler = jest.fn();
      wrapperInterface.on('error', errorHandler);

      // Execute and verify
      await expect(
        wrapperInterface.createAndExecuteWorkflow(
          'test-template',
          '1.0.0',
          mockParameters
        )
      ).rejects.toThrow('Creation failed');

      expect(errorHandler).toHaveBeenCalledWith({
        type: 'workflow_creation_failed',
        templateId: 'test-template',
        error: 'Creation failed'
      });
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return workflow status', async () => {
      // Setup mocks
      mockN8nIntegration.getWorkflowExecutionStatus.mockResolvedValue('running');

      // Execute
      const result = await wrapperInterface.getWorkflowStatus('exec-1');

      // Verify
      expect(result).toEqual({
        id: 'exec-1',
        name: 'Workflow',
        status: 'running',
        progress: 0,
        lastUpdated: expect.any(Date)
      });
      expect(mockN8nIntegration.getWorkflowExecutionStatus).toHaveBeenCalledWith('exec-1');
    });
  });

  describe('template management', () => {
    const mockTemplate: Template = {
      id: 'test-template',
      name: 'Test Template',
      description: 'Test template description',
      type: 'workflow',
      currentVersion: '1.0.0',
      versions: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should list templates', async () => {
      // Setup mocks
      mockTemplateStorage.listTemplates.mockResolvedValue([mockTemplate]);

      // Execute
      const result = await wrapperInterface.listTemplates();

      // Verify
      expect(result).toEqual([mockTemplate]);
      expect(mockTemplateStorage.listTemplates).toHaveBeenCalled();
    });

    it('should get template', async () => {
      // Setup mocks
      mockTemplateStorage.getTemplate.mockResolvedValue(mockTemplate);

      // Execute
      const result = await wrapperInterface.getTemplate('test-template');

      // Verify
      expect(result).toEqual(mockTemplate);
      expect(mockTemplateStorage.getTemplate).toHaveBeenCalledWith('test-template');
    });

    it('should create template', async () => {
      // Setup mocks
      mockTemplateStorage.createTemplate.mockResolvedValue(mockTemplate);

      // Execute
      const result = await wrapperInterface.createTemplate({
        name: 'Test Template',
        description: 'Test template description',
        type: 'workflow',
        currentVersion: '1.0.0',
        versions: [],
        metadata: {}
      });

      // Verify
      expect(result).toEqual(mockTemplate);
      expect(mockTemplateStorage.createTemplate).toHaveBeenCalled();
    });

    it('should update template', async () => {
      // Setup mocks
      mockTemplateStorage.updateTemplate.mockResolvedValue(mockTemplate);

      // Execute
      const result = await wrapperInterface.updateTemplate('test-template', {
        name: 'Updated Template'
      });

      // Verify
      expect(result).toEqual(mockTemplate);
      expect(mockTemplateStorage.updateTemplate).toHaveBeenCalledWith(
        'test-template',
        { name: 'Updated Template' }
      );
    });

    it('should delete template', async () => {
      // Execute
      await wrapperInterface.deleteTemplate('test-template');

      // Verify
      expect(mockTemplateStorage.deleteTemplate).toHaveBeenCalledWith('test-template');
    });
  });
}); 