import { EventEmitter } from 'events';
import { TestUtils } from '../utils/testUtils';

export interface N8nMockConfig {
  delay?: number;
  errorRate?: number;
  timeout?: number;
}

export class N8nMock extends EventEmitter {
  private workflows: Map<string, any> = new Map();
  private executions: Map<string, any> = new Map();
  private config: N8nMockConfig;
  private isHealthy: boolean = true;

  constructor(config: N8nMockConfig = {}) {
    super();
    this.config = {
      delay: config.delay || 0,
      errorRate: config.errorRate || 0,
      timeout: config.timeout || 30000
    };
  }

  /**
   * Simulates n8n API health check
   */
  async healthCheck(): Promise<boolean> {
    await this.simulateDelay();
    return this.isHealthy;
  }

  /**
   * Simulates creating a workflow
   */
  async createWorkflow(workflow: any): Promise<any> {
    await this.simulateDelay();
    await this.simulateError();
    
    const id = workflow.id || TestUtils.generateRandomString(8);
    const savedWorkflow = { ...workflow, id };
    this.workflows.set(id, savedWorkflow);
    
    return savedWorkflow;
  }

  /**
   * Simulates getting a workflow
   */
  async getWorkflow(id: string): Promise<any> {
    await this.simulateDelay();
    await this.simulateError();
    
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`);
    }
    
    return workflow;
  }

  /**
   * Simulates updating a workflow
   */
  async updateWorkflow(id: string, workflow: any): Promise<any> {
    await this.simulateDelay();
    await this.simulateError();
    
    if (!this.workflows.has(id)) {
      throw new Error(`Workflow ${id} not found`);
    }
    
    const updatedWorkflow = { ...workflow, id };
    this.workflows.set(id, updatedWorkflow);
    
    return updatedWorkflow;
  }

  /**
   * Simulates deleting a workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    await this.simulateDelay();
    await this.simulateError();
    
    if (!this.workflows.has(id)) {
      throw new Error(`Workflow ${id} not found`);
    }
    
    this.workflows.delete(id);
  }

  /**
   * Simulates executing a workflow
   */
  async executeWorkflow(id: string, options: any = {}): Promise<any> {
    await this.simulateDelay();
    await this.simulateError();
    
    const workflow = await this.getWorkflow(id);
    const execution = TestUtils.createMockExecutionResult({
      workflowId: id,
      options
    });
    
    this.executions.set(execution.id, execution);
    
    // Emit execution events
    this.emit('workflow.started', { workflowId: id, executionId: execution.id });
    
    // Simulate execution time
    await TestUtils.delay(1000);
    
    this.emit('workflow.completed', { workflowId: id, executionId: execution.id });
    
    return execution;
  }

  /**
   * Simulates getting execution details
   */
  async getExecution(id: string): Promise<any> {
    await this.simulateDelay();
    await this.simulateError();
    
    const execution = this.executions.get(id);
    if (!execution) {
      throw new Error(`Execution ${id} not found`);
    }
    
    return execution;
  }

  /**
   * Simulates activating a workflow
   */
  async activateWorkflow(id: string): Promise<any> {
    await this.simulateDelay();
    await this.simulateError();
    
    const workflow = await this.getWorkflow(id);
    workflow.active = true;
    this.workflows.set(id, workflow);
    
    return workflow;
  }

  /**
   * Simulates deactivating a workflow
   */
  async deactivateWorkflow(id: string): Promise<any> {
    await this.simulateDelay();
    await this.simulateError();
    
    const workflow = await this.getWorkflow(id);
    workflow.active = false;
    this.workflows.set(id, workflow);
    
    return workflow;
  }

  /**
   * Simulates a network delay
   */
  private async simulateDelay(): Promise<void> {
    if (this.config.delay && this.config.delay > 0) {
      await TestUtils.delay(this.config.delay);
    }
  }

  /**
   * Simulates random API errors
   */
  private async simulateError(): Promise<void> {
    if (this.config.errorRate && Math.random() < this.config.errorRate) {
      throw new Error('Simulated API error');
    }
  }

  /**
   * Sets the health status of the mock API
   */
  setHealthStatus(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  /**
   * Clears all mock data
   */
  clear(): void {
    this.workflows.clear();
    this.executions.clear();
    this.removeAllListeners();
  }

  /**
   * Gets the number of workflows
   */
  getWorkflowCount(): number {
    return this.workflows.size;
  }

  /**
   * Gets the number of executions
   */
  getExecutionCount(): number {
    return this.executions.size;
  }
}

export default N8nMock; 