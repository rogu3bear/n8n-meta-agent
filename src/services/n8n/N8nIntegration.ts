import { Template, TemplateVersion } from '../../types/template';
import { TemplateStorage } from '../template/TemplateStorage';
import { TemplateValidationService } from '../template/TemplateValidationService';
import { TemplateParser } from './TemplateParser';
import { z } from 'zod';

export interface N8nWorkflow {
  id: string;
  name: string;
  nodes: N8nNode[];
  connections: N8nConnection[];
  settings: N8nWorkflowSettings;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
}

export interface N8nConnection {
  from: {
    node: string;
    index: number;
  };
  to: {
    node: string;
    index: number;
  };
}

export interface N8nWorkflowSettings {
  saveExecutionData: boolean;
  saveManualExecutions: boolean;
  saveDataErrorExecution: 'all' | 'none';
  saveDataSuccessExecution: 'all' | 'none';
  executionTimeout: number;
  timezone: string;
}

export class N8nIntegration {
  private static instance: N8nIntegration;
  private templateStorage: TemplateStorage;
  private templateValidator: TemplateValidationService;
  private n8nApiUrl: string;
  private n8nApiKey: string;

  private constructor() {
    this.templateStorage = TemplateStorage.getInstance();
    this.templateValidator = TemplateValidationService.getInstance();
    this.n8nApiUrl = process.env.N8N_API_URL || 'http://localhost:5678/api/v1';
    this.n8nApiKey = process.env.N8N_API_KEY || '';
  }

  public static getInstance(): N8nIntegration {
    if (!N8nIntegration.instance) {
      N8nIntegration.instance = new N8nIntegration();
    }
    return N8nIntegration.instance;
  }

  /**
   * Creates an n8n workflow from a template
   */
  public async createWorkflowFromTemplate(
    templateId: string,
    version: string,
    parameters: Record<string, any>
  ): Promise<N8nWorkflow> {
    // Get template and validate parameters
    const template = await this.templateStorage.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const templateVersion = template.versions.find(v => v.version === version);
    if (!templateVersion) {
      throw new Error(`Version ${version} not found for template ${templateId}`);
    }

    // Validate parameters
    const validationResult = await this.templateValidator.validateParameters(
      templateVersion,
      parameters
    );
    if (!validationResult.isValid) {
      throw new Error(`Invalid parameters: ${validationResult.errors.join(', ')}`);
    }

    // Parse template content into n8n nodes and connections
    const { nodes, connections } = TemplateParser.parseTemplateContent(
      template,
      templateVersion,
      parameters
    );

    // Create workflow
    const workflow: N8nWorkflow = {
      id: `workflow-${template.id}-${version}`,
      name: `${template.name} (${version})`,
      nodes,
      connections,
      settings: {
        saveExecutionData: true,
        saveManualExecutions: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionTimeout: 3600,
        timezone: 'UTC'
      }
    };

    // Create workflow in n8n
    return this.createWorkflow(workflow);
  }

  /**
   * Creates a workflow in n8n
   */
  private async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
    const response = await fetch(`${this.n8nApiUrl}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': this.n8nApiKey
      },
      body: JSON.stringify(workflow)
    });

    if (!response.ok) {
      throw new Error(`Failed to create workflow: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Executes a workflow in n8n
   */
  public async executeWorkflow(workflowId: string): Promise<string> {
    const response = await fetch(`${this.n8nApiUrl}/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': this.n8nApiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.statusText}`);
    }

    const result = await response.json();
    return result.executionId;
  }

  /**
   * Gets the status of a workflow execution
   */
  public async getWorkflowExecutionStatus(executionId: string): Promise<string> {
    const response = await fetch(`${this.n8nApiUrl}/executions/${executionId}`, {
      headers: {
        'X-N8N-API-KEY': this.n8nApiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get execution status: ${response.statusText}`);
    }

    const result = await response.json();
    return result.status;
  }
} 