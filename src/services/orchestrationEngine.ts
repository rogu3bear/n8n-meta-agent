import { EventEmitter } from 'events';
import { OrchestrationEvent } from '../types/orchestration';
import { Agent } from '../types/agent';
import { AgentTemplate } from '../types/template';
import { AgentRegistry } from './agentRegistry';
import { TemplateValidator } from './templateValidator';
import { N8nIntegrationManager } from './n8nIntegration';
import { StateManager } from './stateManager';
import { SecurityManager } from './securityManager';
import { EventBus } from './eventBus';
import { ResourceManager } from './resourceManager';
import { TaskManager } from './taskManager';

export class OrchestrationEngine extends EventEmitter {
  private agentRegistry: AgentRegistry;
  private templateValidator: TemplateValidator;
  private n8nIntegration: N8nIntegrationManager;
  private stateManager: StateManager;
  private securityManager: SecurityManager;
  private eventBus: EventBus;
  private resourceManager: ResourceManager;
  private taskManager: TaskManager;
  private isInitialized: boolean;

  constructor() {
    super();
    this.isInitialized = false;
  }

  // Initialization

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize components
      this.stateManager = new StateManager();
      this.securityManager = new SecurityManager();
      this.eventBus = new EventBus();
      this.resourceManager = new ResourceManager({
        cpu: 100,
        memory: 1024 * 1024 * 1024, // 1GB
        disk: 10 * 1024 * 1024 * 1024, // 10GB
        network: {
          in: 1024 * 1024 * 1024, // 1GB/s
          out: 1024 * 1024 * 1024 // 1GB/s
        }
      });
      this.taskManager = new TaskManager(this.resourceManager);
      this.agentRegistry = new AgentRegistry();
      this.templateValidator = new TemplateValidator();
      this.n8nIntegration = new N8nIntegrationManager();

      // Initialize each component
      await this.stateManager.init();
      await this.agentRegistry.init();
      await this.n8nIntegration.init();

      // Set up event handlers
      this.setupEventHandlers();

      // Start monitoring and processing
      this.resourceManager.startMonitoring();
      this.taskManager.startProcessing();

      this.isInitialized = true;

      // Emit initialization complete event
      this.emit('initialized', {
        type: 'engine.initialized',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to initialize OrchestrationEngine:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Handle resource events
    this.resourceManager.on('resourceWarning', this.handleResourceWarning.bind(this));
    this.resourceManager.on('resourceAllocated', this.handleResourceAllocated.bind(this));
    this.resourceManager.on('resourceDeallocated', this.handleResourceDeallocated.bind(this));

    // Handle task events
    this.taskManager.on('taskCreated', this.handleTaskCreated.bind(this));
    this.taskManager.on('taskStarted', this.handleTaskStarted.bind(this));
    this.taskManager.on('taskCompleted', this.handleTaskCompleted.bind(this));
    this.taskManager.on('taskFailed', this.handleTaskFailed.bind(this));
    this.taskManager.on('taskCancelled', this.handleTaskCancelled.bind(this));

    // Handle n8n events
    this.n8nIntegration.on('workflowStarted', this.handleWorkflowStarted.bind(this));
    this.n8nIntegration.on('workflowCompleted', this.handleWorkflowCompleted.bind(this));
    this.n8nIntegration.on('workflowFailed', this.handleWorkflowFailed.bind(this));
  }

  // Agent Management

  public async createAgent(
    template: AgentTemplate,
    parameters: any,
    userId: string
  ): Promise<Agent> {
    // Validate template
    const validationResult = await this.templateValidator.validateTemplate(template);
    if (!validationResult.isValid) {
      throw new Error(`Invalid template: ${validationResult.errors.join(', ')}`);
    }

    // Check user permissions
    const hasPermission = await this.securityManager.checkAccess(
      userId,
      template.id,
      'template',
      'create'
    );
    if (!hasPermission) {
      throw new Error('Insufficient permissions to create agent');
    }

    // Create agent
    const agent = await this.agentRegistry.createAgent(template, parameters);

    // Record event
    await this.stateManager.recordEvent({
      type: 'agent.created',
      timestamp: new Date(),
      payload: {
        agentId: agent.id,
        templateId: template.id,
        parameters
      }
    });

    // Log audit
    await this.securityManager.logAudit(
      userId,
      'create',
      agent.id,
      'agent',
      { templateId: template.id, parameters }
    );

    return agent;
  }

  public async startAgent(agentId: string, userId: string): Promise<void> {
    const agent = await this.agentRegistry.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Check user permissions
    const hasPermission = await this.securityManager.checkAccess(
      userId,
      agentId,
      'agent',
      'start'
    );
    if (!hasPermission) {
      throw new Error('Insufficient permissions to start agent');
    }

    // Check dependencies
    const canStart = await this.checkAgentDependencies(agent);
    if (!canStart) {
      throw new Error('Agent dependencies not satisfied');
    }

    // Allocate resources
    const allocation = await this.resourceManager.allocateResources(agentId, {
      cpu: 0.5,
      memory: 512 * 1024 * 1024 // 512MB
    });

    // Create and submit task
    await this.taskManager.submitTask(
      agentId,
      'start',
      { allocationId: allocation.id },
      { priority: 'high' }
    );

    // Record event
    await this.stateManager.recordEvent({
      type: 'agent.started',
      timestamp: new Date(),
      payload: { agentId }
    });

    // Log audit
    await this.securityManager.logAudit(
      userId,
      'start',
      agentId,
      'agent',
      {}
    );
  }

  public async stopAgent(agentId: string, userId: string): Promise<void> {
    const agent = await this.agentRegistry.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Check user permissions
    const hasPermission = await this.securityManager.checkAccess(
      userId,
      agentId,
      'agent',
      'stop'
    );
    if (!hasPermission) {
      throw new Error('Insufficient permissions to stop agent');
    }

    // Cancel active tasks
    const activeTasks = await this.taskManager.getQueueStatus();
    if (activeTasks.active > 0) {
      // Implement task cancellation logic
    }

    // Deallocate resources
    // Implementation would depend on how resource allocations are tracked

    // Update agent status
    await this.agentRegistry.updateAgentStatus(agentId, 'stopped');

    // Record event
    await this.stateManager.recordEvent({
      type: 'agent.stopped',
      timestamp: new Date(),
      payload: { agentId }
    });

    // Log audit
    await this.securityManager.logAudit(
      userId,
      'stop',
      agentId,
      'agent',
      {}
    );
  }

  // Event Handlers

  private async handleResourceWarning(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('resourceWarning', event);
  }

  private async handleResourceAllocated(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('resourceAllocated', event);
  }

  private async handleResourceDeallocated(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('resourceDeallocated', event);
  }

  private async handleTaskCreated(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('taskCreated', event);
  }

  private async handleTaskStarted(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('taskStarted', event);
  }

  private async handleTaskCompleted(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('taskCompleted', event);
  }

  private async handleTaskFailed(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('taskFailed', event);
  }

  private async handleTaskCancelled(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('taskCancelled', event);
  }

  private async handleWorkflowStarted(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('workflowStarted', event);
  }

  private async handleWorkflowCompleted(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('workflowCompleted', event);
  }

  private async handleWorkflowFailed(event: OrchestrationEvent): Promise<void> {
    await this.stateManager.recordEvent(event);
    this.emit('workflowFailed', event);
  }

  // Helper Methods

  private async checkAgentDependencies(agent: Agent): Promise<boolean> {
    if (!agent.dependencies || agent.dependencies.length === 0) {
      return true;
    }

    for (const depId of agent.dependencies) {
      const depAgent = await this.agentRegistry.getAgent(depId);
      if (!depAgent || depAgent.status !== 'running') {
        return false;
      }
    }

    return true;
  }

  // Cleanup

  public async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop monitoring and processing
      this.resourceManager.stopMonitoring();
      this.taskManager.stopProcessing();

      // Clean up components
      await this.stateManager.cleanup();
      await this.resourceManager.cleanup();
      await this.taskManager.cleanup();
      await this.agentRegistry.cleanup();
      await this.n8nIntegration.cleanup();

      this.isInitialized = false;

      // Emit cleanup complete event
      this.emit('cleanupComplete', {
        type: 'engine.cleanupComplete',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}

export default OrchestrationEngine; 