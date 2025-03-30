import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import { Agent } from '../types/agent';
import { AgentTemplate } from '../types/template';
import { WorkflowStartedEvent, WorkflowCompletedEvent, WorkflowFailedEvent } from '../types/orchestration';

export interface N8nWorkflowNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
  inputs?: string[];
  outputs?: string[];
}

export interface N8nConnection {
  source: string;
  sourceOutput?: string;
  target: string;
  targetInput?: string;
}

export interface N8nWorkflow {
  id?: string;
  name: string;
  nodes: N8nWorkflowNode[];
  connections: {
    [key: string]: N8nConnection[];
  };
  active: boolean;
  settings?: {
    executionOrder: string;
    saveExecutionProgress: boolean;
    saveManualExecutions: boolean;
    timezone: string;
  };
  tags?: string[];
  meta?: Record<string, any>;
}

export interface N8nExecutionResult {
  id: string;
  finished: boolean;
  mode: string;
  data: {
    resultData: {
      runData: Record<string, any[]>;
    };
    executionData: {
      contextData: Record<string, any>;
      nodeExecutionStack: any[];
      waitingExecution: Record<string, any>;
      waitingExecutionSource: Record<string, any>;
    };
  };
  status: 'running' | 'success' | 'error' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
}

export interface N8nConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
  baseFolder?: string;
}

export interface N8nWorkflowExecutionOptions {
  runWithoutWaitingForWebhooks?: boolean;
  workflowData?: any;
  additionalData?: Record<string, any>;
}

export type N8nEventType = 
  | 'workflow.started' 
  | 'workflow.completed' 
  | 'workflow.error' 
  | 'connection.error'
  | 'api.error'
  | 'translation.error'
  | 'cache.hit'
  | 'cache.miss';

export interface N8nEventListener {
  event: N8nEventType;
  handler: (data: any) => void;
}

export class N8nIntegrationManager {
  private apiClient: AxiosInstance;
  private config: N8nConfig;
  private eventEmitter: EventEmitter;
  private workflowCache: Map<string, N8nWorkflow> = new Map();
  private executionCache: Map<string, any> = new Map();
  private listeners: N8nEventListener[] = [];
  
  constructor(config: N8nConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000, // Default 30 second timeout
    };
    
    this.eventEmitter = new EventEmitter();
    
    // Create axios instance with configured base URL and auth
    this.apiClient = axios.create({
      baseURL: config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      }
    });
    
    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        const errorData = {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        };
        
        this.emitEvent('api.error', errorData);
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Translates an agent configuration to an n8n workflow
   * @param agent Agent to translate
   * @param template Template to use for the workflow
   * @returns Translated workflow
   */
  public async translateAgentToWorkflow(agent: Agent, template?: AgentTemplate): Promise<N8nWorkflow> {
    try {
      // First check cache
      const cacheKey = `${agent.id}-${agent.version}`;
      if (this.workflowCache.has(cacheKey)) {
        this.emitEvent('cache.hit', { agent: agent.id });
        return this.workflowCache.get(cacheKey) as N8nWorkflow;
      }
      
      this.emitEvent('cache.miss', { agent: agent.id });
      
      const workflow: N8nWorkflow = {
        name: `${agent.name} (${agent.id})`,
        nodes: [],
        connections: {},
        active: true,
        tags: agent.tags,
        meta: {
          agentId: agent.id,
          version: agent.version,
          description: agent.description
        },
        settings: {
          executionOrder: 'sequential',
          saveExecutionProgress: true,
          saveManualExecutions: true,
          timezone: 'UTC'
        }
      };
      
      // Create start node
      const startNode: N8nWorkflowNode = {
        id: 'start',
        name: 'Start',
        type: 'n8n-nodes-base.start',
        position: [100, 300],
        parameters: {}
      };
      
      workflow.nodes.push(startNode);
      
      // Create nodes based on agent configuration
      let positionX = 300;
      const positionY = 300;
      
      // Add configuration node
      const configNode: N8nWorkflowNode = {
        id: 'config',
        name: 'Agent Configuration',
        type: 'n8n-nodes-base.set',
        position: [positionX, positionY],
        parameters: {
          values: {
            number: [
              {
                name: 'agentId',
                value: agent.id
              }
            ],
            string: [
              {
                name: 'agentName',
                value: agent.name
              },
              {
                name: 'version',
                value: agent.version
              }
            ],
            boolean: [],
            object: [
              {
                name: 'config',
                value: agent.config || {}
              }
            ]
          }
        }
      };
      
      workflow.nodes.push(configNode);
      positionX += 200;
      
      // Add main processing node based on the template type or agent type
      const mainNode: N8nWorkflowNode = {
        id: 'main',
        name: 'Main Process',
        type: this.determineNodeType(agent, template),
        position: [positionX, positionY],
        parameters: this.transformParameters(agent, template)
      };
      
      workflow.nodes.push(mainNode);
      positionX += 200;
      
      // Add output node to handle results
      const outputNode: N8nWorkflowNode = {
        id: 'output',
        name: 'Results',
        type: 'n8n-nodes-base.set',
        position: [positionX, positionY],
        parameters: {
          values: {
            boolean: [
              {
                name: 'success',
                value: true
              }
            ],
            object: [
              {
                name: 'results',
                value: '={{ $json }}'
              }
            ]
          }
        }
      };
      
      workflow.nodes.push(outputNode);
      
      // Generate connections
      workflow.connections = this.generateConnections(workflow.nodes);
      
      // Cache the workflow
      this.workflowCache.set(cacheKey, workflow);
      
      return workflow;
    } catch (error) {
      const errorData = {
        message: error instanceof Error ? error.message : 'Unknown error during workflow translation',
        agent: agent.id,
        template: template?.id
      };
      
      this.emitEvent('translation.error', errorData);
      throw error;
    }
  }
  
  /**
   * Executes an agent's workflow
   * @param agent Agent to execute
   * @param options Execution options
   * @returns Execution result
   */
  public async executeWorkflow(
    agent: Agent, 
    options: N8nWorkflowExecutionOptions = {}
  ): Promise<any> {
    try {
      const workflow = await this.translateAgentToWorkflow(agent);
      
      // Create a workflow execution event to emit
      const startEvent: WorkflowStartedEvent = {
        type: 'workflow.started',
        timestamp: new Date(),
        agentId: agent.id,
        workflowId: workflow.id || '',
        data: {
          agent: agent.name,
          options
        }
      };
      
      this.emitEvent('workflow.started', startEvent);
      
      // Execute the workflow via n8n API
      const response = await this.apiClient.post<N8nExecutionResult>(
        '/workflows/run',
        {
          workflowData: workflow,
          runData: options.workflowData || {},
          startNodes: [],
          destinationNode: '',
          additionalData: options.additionalData || {},
          runWithoutWebhooks: options.runWithoutWaitingForWebhooks || false
        }
      );
      
      // Process the response
      const result = this.resultParser(response.data);
      
      // Cache execution result
      this.executionCache.set(agent.id, result);
      
      // Create a completion event
      const completeEvent: WorkflowCompletedEvent = {
        type: 'workflow.completed',
        timestamp: new Date(),
        agentId: agent.id,
        workflowId: workflow.id || '',
        data: {
          result,
          executionId: response.data.id
        }
      };
      
      this.emitEvent('workflow.completed', completeEvent);
      
      return result;
    } catch (error) {
      // Create an error event
      const errorEvent: WorkflowFailedEvent = {
        type: 'workflow.failed',
        timestamp: new Date(),
        agentId: agent.id,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        data: {
          agent: agent.name,
          options
        }
      };
      
      this.emitEvent('workflow.error', errorEvent);
      throw error;
    }
  }
  
  /**
   * Gets a workflow by ID
   * @param id Workflow ID
   * @returns Workflow data
   */
  public async getWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.apiClient.get<N8nWorkflow>(`/workflows/${id}`);
    return response.data;
  }
  
  /**
   * Creates a new workflow
   * @param workflow Workflow data
   * @returns Created workflow
   */
  public async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
    const response = await this.apiClient.post<N8nWorkflow>('/workflows', workflow);
    return response.data;
  }
  
  /**
   * Updates an existing workflow
   * @param id Workflow ID
   * @param workflow Updated workflow data
   * @returns Updated workflow
   */
  public async updateWorkflow(id: string, workflow: N8nWorkflow): Promise<N8nWorkflow> {
    const response = await this.apiClient.put<N8nWorkflow>(`/workflows/${id}`, workflow);
    return response.data;
  }
  
  /**
   * Deletes a workflow
   * @param id Workflow ID
   * @returns Success status
   */
  public async deleteWorkflow(id: string): Promise<boolean> {
    await this.apiClient.delete(`/workflows/${id}`);
    return true;
  }
  
  /**
   * Gets execution details
   * @param executionId Execution ID
   * @returns Execution details
   */
  public async getExecution(executionId: string): Promise<N8nExecutionResult> {
    const response = await this.apiClient.get<N8nExecutionResult>(`/executions/${executionId}`);
    return response.data;
  }
  
  /**
   * Parses an execution result into a more usable format
   * @param executionResult Raw execution result
   * @returns Parsed result
   */
  private resultParser(executionResult: N8nExecutionResult): any {
    if (!executionResult.data?.resultData?.runData) {
      return { success: false, error: 'No result data available' };
    }
    
    const outputNodeData = executionResult.data.resultData.runData.output?.[0]?.data;
    
    if (!outputNodeData) {
      // Try to get data from the last executed node
      const nodeIds = Object.keys(executionResult.data.resultData.runData);
      if (nodeIds.length > 0) {
        const lastNodeId = nodeIds[nodeIds.length - 1];
        const lastNodeData = executionResult.data.resultData.runData[lastNodeId]?.[0]?.data;
        
        if (lastNodeData) {
          return {
            success: executionResult.status === 'success',
            data: lastNodeData,
            nodeId: lastNodeId
          };
        }
      }
      
      return { 
        success: false, 
        error: 'No output data found in execution result' 
      };
    }
    
    return {
      success: executionResult.status === 'success',
      data: outputNodeData,
      executionId: executionResult.id,
      startedAt: executionResult.startedAt,
      stoppedAt: executionResult.stoppedAt
    };
  }
  
  /**
   * Adds an event listener
   * @param event Event type
   * @param handler Event handler
   */
  public addListener(event: N8nEventType, handler: (data: any) => void): void {
    this.listeners.push({ event, handler });
    this.eventEmitter.on(event, handler);
  }
  
  /**
   * Removes an event listener
   * @param event Event type
   * @param handler Event handler
   */
  public removeListener(event: N8nEventType, handler: (data: any) => void): void {
    this.listeners = this.listeners.filter(
      listener => !(listener.event === event && listener.handler === handler)
    );
    this.eventEmitter.off(event, handler);
  }
  
  /**
   * Emits an event
   * @param event Event type
   * @param data Event data
   */
  private emitEvent(event: N8nEventType, data: any): void {
    this.eventEmitter.emit(event, data);
  }
  
  /**
   * Determines the appropriate node type based on the agent and template
   * @param agent Agent configuration
   * @param template Template data
   * @returns Node type
   */
  private determineNodeType(agent: Agent, template?: AgentTemplate): string {
    if (template?.workflows?.main?.nodeType) {
      return template.workflows.main.nodeType;
    }
    
    if (agent.type === 'http') {
      return 'n8n-nodes-base.httpRequest';
    }
    
    if (agent.type === 'function') {
      return 'n8n-nodes-base.function';
    }
    
    if (agent.type === 'ai') {
      return 'n8n-nodes-base.openAi';
    }
    
    // Default to function node if no specific type
    return 'n8n-nodes-base.function';
  }
  
  /**
   * Transforms agent parameters to node parameters
   * @param agent Agent configuration
   * @param template Template data
   * @returns Node parameters
   */
  private transformParameters(agent: Agent, template?: AgentTemplate): Record<string, any> {
    const params: Record<string, any> = {};
    
    // If we have a template with parameter mappings, use them
    if (template?.workflows?.main?.parameterMappings) {
      const mappings = template.workflows.main.parameterMappings;
      
      for (const [nodeParam, agentConfig] of Object.entries(mappings)) {
        if (typeof agentConfig === 'string' && agentConfig.startsWith('config.')) {
          const configKey = agentConfig.replace('config.', '');
          if (agent.config && configKey in agent.config) {
            params[nodeParam] = agent.config[configKey];
          }
        } else {
          params[nodeParam] = agentConfig;
        }
      }
      
      return params;
    }
    
    // Otherwise, build parameters based on agent type
    switch (agent.type) {
      case 'http':
        return {
          url: agent.config?.url || '',
          method: agent.config?.method || 'GET',
          authentication: agent.config?.authentication || 'none',
          options: {}
        };
        
      case 'function':
        return {
          functionCode: agent.config?.code || 'return { success: true };'
        };
        
      case 'ai':
        return {
          authentication: 'apiKey',
          resource: 'completion',
          prompt: agent.config?.prompt || '',
          model: agent.config?.model || 'gpt-3.5-turbo',
          temperature: agent.config?.temperature || 0.7
        };
        
      default:
        return params;
    }
  }
  
  /**
   * Generates connections between nodes
   * @param nodes Workflow nodes
   * @returns Node connections
   */
  private generateConnections(nodes: N8nWorkflowNode[]): Record<string, N8nConnection[]> {
    const connections: Record<string, N8nConnection[]> = {};
    
    // Create a simple linear connection flow
    for (let i = 0; i < nodes.length - 1; i++) {
      const sourceNode = nodes[i];
      const targetNode = nodes[i + 1];
      
      if (!connections[sourceNode.id]) {
        connections[sourceNode.id] = [];
      }
      
      connections[sourceNode.id].push({
        source: sourceNode.id,
        sourceOutput: 'main',
        target: targetNode.id,
        targetInput: 'main'
      });
    }
    
    return connections;
  }
  
  /**
   * Clears the workflow cache
   */
  public clearCache(): void {
    this.workflowCache.clear();
    this.executionCache.clear();
  }
  
  /**
   * Gets a list of active workflows
   * @returns List of active workflows
   */
  public async getActiveWorkflows(): Promise<N8nWorkflow[]> {
    const response = await this.apiClient.get<{ data: N8nWorkflow[] }>('/workflows', {
      params: { active: true }
    });
    return response.data.data;
  }
  
  /**
   * Activates a workflow
   * @param id Workflow ID
   * @returns Activated workflow
   */
  public async activateWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.apiClient.put<N8nWorkflow>(`/workflows/${id}/activate`, {});
    return response.data;
  }
  
  /**
   * Deactivates a workflow
   * @param id Workflow ID
   * @returns Deactivated workflow
   */
  public async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    const response = await this.apiClient.put<N8nWorkflow>(`/workflows/${id}/deactivate`, {});
    return response.data;
  }
}

export default N8nIntegrationManager; 