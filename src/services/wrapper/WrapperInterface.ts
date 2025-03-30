import { EventEmitter } from 'events';
import { N8nIntegration } from '../n8n/N8nIntegration';
import { TemplateStorage } from '../template/TemplateStorage';
import { Template } from '../../types/template';

export interface WrapperConfig {
  n8nUrl: string;
  n8nApiKey: string;
  templateDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface WorkflowStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  lastUpdated: Date;
}

export class WrapperInterface extends EventEmitter {
  private static instance: WrapperInterface;
  private n8nIntegration: N8nIntegration;
  private templateStorage: TemplateStorage;
  private activeWorkflows: Map<string, WorkflowStatus>;
  private config: WrapperConfig;

  private constructor(config: WrapperConfig) {
    super();
    this.config = config;
    this.n8nIntegration = N8nIntegration.getInstance(config.n8nUrl, config.n8nApiKey);
    this.templateStorage = TemplateStorage.getInstance(config.templateDir);
    this.activeWorkflows = new Map();
  }

  public static getInstance(config: WrapperConfig): WrapperInterface {
    if (!WrapperInterface.instance) {
      WrapperInterface.instance = new WrapperInterface(config);
    }
    return WrapperInterface.instance;
  }

  public async createAndExecuteWorkflow(
    templateId: string,
    version: string,
    parameters: Record<string, any>
  ): Promise<string> {
    try {
      // Create workflow from template
      const workflow = await this.n8nIntegration.createWorkflowFromTemplate(
        templateId,
        version,
        parameters
      );

      // Execute workflow
      const executionId = await this.n8nIntegration.executeWorkflow(workflow.id);

      // Initialize status tracking
      this.activeWorkflows.set(executionId, {
        id: executionId,
        name: workflow.name,
        status: 'pending',
        progress: 0,
        lastUpdated: new Date()
      });

      // Start monitoring
      this.monitorWorkflowStatus(executionId);

      return executionId;
    } catch (error) {
      this.emit('error', {
        type: 'workflow_creation_failed',
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async getWorkflowStatus(executionId: string): Promise<WorkflowStatus> {
    const status = await this.n8nIntegration.getWorkflowExecutionStatus(executionId);
    const mappedStatus = this.mapN8nStatus(status);
    
    const currentStatus = this.activeWorkflows.get(executionId) || {
      id: executionId,
      name: 'Workflow',
      status: mappedStatus,
      progress: 0,
      lastUpdated: new Date()
    };

    currentStatus.status = mappedStatus;
    currentStatus.lastUpdated = new Date();
    this.activeWorkflows.set(executionId, currentStatus);

    return currentStatus;
  }

  public async listTemplates(): Promise<Template[]> {
    return this.templateStorage.listTemplates();
  }

  public async getTemplate(templateId: string): Promise<Template> {
    return this.templateStorage.getTemplate(templateId);
  }

  public async createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    return this.templateStorage.createTemplate(template);
  }

  public async updateTemplate(templateId: string, updates: Partial<Template>): Promise<Template> {
    return this.templateStorage.updateTemplate(templateId, updates);
  }

  public async deleteTemplate(templateId: string): Promise<void> {
    await this.templateStorage.deleteTemplate(templateId);
  }

  private async monitorWorkflowStatus(executionId: string): Promise<void> {
    const interval = setInterval(async () => {
      try {
        const status = await this.getWorkflowStatus(executionId);
        
        this.emit('workflowStatusUpdate', status);

        if (['completed', 'failed', 'cancelled'].includes(status.status)) {
          clearInterval(interval);
        }
      } catch (error) {
        this.emit('error', {
          type: 'workflow_monitoring_failed',
          executionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        clearInterval(interval);
      }
    }, 5000); // Check every 5 seconds
  }

  private mapN8nStatus(status: string): WorkflowStatus['status'] {
    switch (status.toLowerCase()) {
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
} 