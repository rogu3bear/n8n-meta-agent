import EventEmitter from 'events';
import { Agent, AgentStatus } from '../types/agent';
import { OrchestrationEvent, OrchestrationEventType } from '../types/orchestration';
import { AgentRegistry } from './agentRegistry';

// Interface for state changes that can be tracked
export interface StateChange {
  id: string;
  timestamp: Date;
  entityType: 'agent' | 'workflow' | 'task' | 'resource';
  entityId: string;
  property: string;
  oldValue: any;
  newValue: any;
  source: string;
  transactionId?: string;
}

// Interface for state transactions
export interface StateTransaction {
  id: string;
  timestamp: Date;
  description: string;
  changes: StateChange[];
  status: 'pending' | 'committed' | 'rolledback';
  commitTimestamp?: Date;
  rollbackTimestamp?: Date;
}

// Observer interface for state changes
export interface StateObserver {
  onStateChanged(change: StateChange): void;
  onTransactionCompleted(transaction: StateTransaction): void;
}

// State persistence options
export interface StatePersistenceOptions {
  interval: number; // in milliseconds
  maxChanges: number;
  persistPath?: string;
}

export class StateManager {
  private state: Map<string, Map<string, any>> = new Map();
  private transactions: Map<string, StateTransaction> = new Map();
  private history: StateChange[] = [];
  private observers: Set<StateObserver> = new Set();
  private eventEmitter: EventEmitter;
  private registry: AgentRegistry;
  private historyLimit: number = 1000;
  private activeTxId: string | null = null;
  private persistence: StatePersistenceOptions;
  private persistenceTimer: NodeJS.Timeout | null = null;
  private pendingChanges: number = 0;

  constructor(
    registry: AgentRegistry,
    persistence: Partial<StatePersistenceOptions> = {}
  ) {
    this.registry = registry;
    this.eventEmitter = new EventEmitter();
    
    // Set up default persistence options
    this.persistence = {
      interval: persistence.interval || 30000, // 30 seconds
      maxChanges: persistence.maxChanges || 100,
      persistPath: persistence.persistPath
    };

    // Initialize state categories
    this.state.set('agents', new Map());
    this.state.set('workflows', new Map());
    this.state.set('tasks', new Map());
    this.state.set('resources', new Map());
    this.state.set('system', new Map());

    // Start persistence timer if enabled
    if (this.persistence.interval > 0) {
      this.startPersistenceTimer();
    }
  }

  /**
   * Initializes the state manager with current registry data
   */
  public async initialize(): Promise<void> {
    // Load agents from registry
    const agents = await this.registry.getAllAgents();
    agents.forEach(agent => {
      this.setState('agents', agent.id, agent);
    });

    // Set system state defaults
    this.setState('system', 'status', 'running');
    this.setState('system', 'startTime', new Date());
    this.setState('system', 'version', '1.0.0');
    this.setState('system', 'activeAgents', 0);
  }

  /**
   * Sets a state value
   * @param category State category
   * @param id Entity ID
   * @param state State object or value
   */
  public setState<T>(category: string, id: string, state: T): void {
    if (!this.state.has(category)) {
      this.state.set(category, new Map());
    }

    const categoryMap = this.state.get(category)!;
    const oldValue = categoryMap.get(id);
    
    // Detect if there's an actual change
    const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(state);
    
    if (hasChanged) {
      // Record state change
      const change: StateChange = {
        id: this.generateId(),
        timestamp: new Date(),
        entityType: this.entityTypeFromCategory(category),
        entityId: id,
        property: category === 'agents' ? 'state' : id,
        oldValue,
        newValue: state,
        source: 'stateManager',
        transactionId: this.activeTxId || undefined
      };

      // Add to transaction if one is active
      if (this.activeTxId) {
        const transaction = this.transactions.get(this.activeTxId)!;
        transaction.changes.push(change);
      } else {
        // Add to history and notify observers
        this.addToHistory(change);
        this.notifyObservers(change);
      }

      // Update state
      categoryMap.set(id, state);
      this.pendingChanges++;

      // Auto-persist if threshold reached
      if (this.pendingChanges >= this.persistence.maxChanges) {
        this.persistState();
      }
    }
  }

  /**
   * Retrieves a state value
   * @param category State category
   * @param id Entity ID
   * @returns The state value or undefined if not found
   */
  public getState<T>(category: string, id: string): T | undefined {
    if (!this.state.has(category)) {
      return undefined;
    }
    return this.state.get(category)!.get(id) as T | undefined;
  }

  /**
   * Gets all states for a category
   * @param category State category
   * @returns Map of all states for the category
   */
  public getAllStatesByCategory<T>(category: string): Map<string, T> {
    if (!this.state.has(category)) {
      return new Map();
    }
    return this.state.get(category) as Map<string, T>;
  }

  /**
   * Starts a new transaction
   * @param description Description of the transaction
   * @returns Transaction ID
   */
  public beginTransaction(description: string): string {
    if (this.activeTxId) {
      throw new Error('A transaction is already active');
    }

    const txId = this.generateId();
    const transaction: StateTransaction = {
      id: txId,
      timestamp: new Date(),
      description,
      changes: [],
      status: 'pending'
    };

    this.transactions.set(txId, transaction);
    this.activeTxId = txId;
    return txId;
  }

  /**
   * Commits an active transaction
   * @param txId Transaction ID
   */
  public commitTransaction(txId?: string): void {
    const effectiveTxId = txId || this.activeTxId;
    if (!effectiveTxId) {
      throw new Error('No active transaction to commit');
    }

    if (!this.transactions.has(effectiveTxId)) {
      throw new Error(`Transaction ${effectiveTxId} not found`);
    }

    const transaction = this.transactions.get(effectiveTxId)!;
    if (transaction.status !== 'pending') {
      throw new Error(`Transaction ${effectiveTxId} is already ${transaction.status}`);
    }

    // Apply all changes to history
    transaction.changes.forEach(change => {
      this.addToHistory(change);
      this.notifyObservers(change);
    });

    // Update transaction status
    transaction.status = 'committed';
    transaction.commitTimestamp = new Date();

    // Reset active transaction if it was this one
    if (effectiveTxId === this.activeTxId) {
      this.activeTxId = null;
    }

    // Notify transaction completion
    this.notifyTransactionCompleted(transaction);

    // Trigger state persistence since we committed changes
    this.pendingChanges += transaction.changes.length;
    if (this.pendingChanges >= this.persistence.maxChanges) {
      this.persistState();
    }
  }

  /**
   * Rolls back an active transaction
   * @param txId Transaction ID
   */
  public rollbackTransaction(txId?: string): void {
    const effectiveTxId = txId || this.activeTxId;
    if (!effectiveTxId) {
      throw new Error('No active transaction to rollback');
    }

    if (!this.transactions.has(effectiveTxId)) {
      throw new Error(`Transaction ${effectiveTxId} not found`);
    }

    const transaction = this.transactions.get(effectiveTxId)!;
    if (transaction.status !== 'pending') {
      throw new Error(`Transaction ${effectiveTxId} is already ${transaction.status}`);
    }

    // Rollback changes in reverse order
    const reversedChanges = [...transaction.changes].reverse();
    
    reversedChanges.forEach(change => {
      const categoryMap = this.state.get(this.categoryFromEntityType(change.entityType));
      if (categoryMap && categoryMap.has(change.entityId)) {
        // Restore the old value
        categoryMap.set(change.entityId, change.oldValue);
      }
    });

    // Update transaction status
    transaction.status = 'rolledback';
    transaction.rollbackTimestamp = new Date();

    // Reset active transaction if it was this one
    if (effectiveTxId === this.activeTxId) {
      this.activeTxId = null;
    }

    // Notify transaction completion
    this.notifyTransactionCompleted(transaction);
  }

  /**
   * Registers a state observer
   * @param observer The observer to register
   */
  public registerObserver(observer: StateObserver): void {
    this.observers.add(observer);
  }

  /**
   * Unregisters a state observer
   * @param observer The observer to unregister
   */
  public unregisterObserver(observer: StateObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Gets state history for an entity
   * @param entityType Entity type
   * @param entityId Entity ID
   * @param limit Maximum number of changes to return
   * @returns Array of state changes
   */
  public getEntityHistory(entityType: string, entityId: string, limit: number = 100): StateChange[] {
    return this.history
      .filter(change => change.entityType === entityType && change.entityId === entityId)
      .slice(-limit);
  }

  /**
   * Syncs agent state with registry
   * @param agentId Agent ID
   */
  public async syncAgentState(agentId: string): Promise<void> {
    // Get current agent state
    const agentState = this.getState<Agent>('agents', agentId);
    
    if (!agentState) {
      console.warn(`Cannot sync state for non-existent agent: ${agentId}`);
      return;
    }

    // Start a transaction for the sync
    const txId = this.beginTransaction(`Sync agent state: ${agentId}`);

    try {
      // Get the latest agent from registry
      const agent = await this.registry.getAgent(agentId);
      
      if (!agent) {
        console.warn(`Agent not found in registry: ${agentId}`);
        return;
      }
      
      // Update the state with latest from registry
      this.setState('agents', agentId, agent);
      
      // Commit the transaction
      this.commitTransaction(txId);
    } catch (error) {
      // Rollback on error
      this.rollbackTransaction(txId);
      console.error(`Failed to sync agent state: ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Updates an agent's status and emits appropriate events
   * @param agentId Agent ID
   * @param newStatus New status
   * @param reason Optional reason for the status change
   */
  public async updateAgentStatus(agentId: string, newStatus: AgentStatus, reason?: string): Promise<void> {
    const agent = this.getState<Agent>('agents', agentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const oldStatus = agent.status;
    
    if (oldStatus === newStatus) {
      return; // No change needed
    }

    // Start a transaction for status update
    const txId = this.beginTransaction(`Update agent status: ${agentId} ${oldStatus} -> ${newStatus}`);

    try {
      // Create a copy of the agent with the new status
      const updatedAgent: Agent = {
        ...agent,
        status: newStatus,
        updatedAt: new Date()
      };

      if (newStatus === 'failed' && reason) {
        updatedAgent.lastError = reason;
      }

      // Update state
      this.setState('agents', agentId, updatedAgent);
      
      // Update the agent in the registry
      await this.registry.updateAgent(agentId, updatedAgent);

      // Emit status change event
      const eventType = this.statusToEventType(newStatus);
      if (eventType) {
        const event: OrchestrationEvent = {
          id: this.generateId(),
          timestamp: new Date(),
          type: eventType,
          payload: {
            agentId,
            oldStatus,
            newStatus,
            reason
          }
        };
        
        this.emitEvent(event);
      }
      
      // Commit transaction
      this.commitTransaction(txId);
      
      // Update system stats
      this.updateSystemStats();
    } catch (error) {
      // Rollback on error
      this.rollbackTransaction(txId);
      console.error(`Failed to update agent status: ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Emits an orchestration event
   * @param event The event to emit
   */
  private emitEvent(event: OrchestrationEvent): void {
    this.eventEmitter.emit('orchestration.event', event);
    this.eventEmitter.emit(event.type, event);
  }

  /**
   * Adds listener for orchestration events
   * @param eventType Event type to listen for
   * @param listener Event listener function
   */
  public addEventListener(eventType: OrchestrationEventType | string, listener: (event: OrchestrationEvent) => void): void {
    this.eventEmitter.on(eventType, listener);
  }

  /**
   * Removes listener for orchestration events
   * @param eventType Event type
   * @param listener Event listener function
   */
  public removeEventListener(eventType: OrchestrationEventType | string, listener: (event: OrchestrationEvent) => void): void {
    this.eventEmitter.off(eventType, listener);
  }

  /**
   * Persists the current state
   */
  public async persistState(): Promise<void> {
    if (!this.persistence.persistPath) {
      return; // Persistence not configured
    }

    try {
      // Here we would serialize and persist the state
      // For demo purposes we'll just simulate this
      console.log(`[StateManager] Persisting state with ${this.pendingChanges} pending changes`);
      
      // Reset pending changes counter
      this.pendingChanges = 0;
    } catch (error) {
      console.error('[StateManager] Failed to persist state:', error);
    }
  }

  /**
   * Updates system stats based on current state
   */
  private updateSystemStats(): void {
    const agents = this.getAllStatesByCategory<Agent>('agents');
    
    // Count active agents
    let activeAgents = 0;
    agents.forEach(agent => {
      if (agent.status === 'running') {
        activeAgents++;
      }
    });
    
    this.setState('system', 'activeAgents', activeAgents);
    this.setState('system', 'totalAgents', agents.size);
    this.setState('system', 'lastUpdated', new Date());
  }

  /**
   * Starts the persistence timer
   */
  private startPersistenceTimer(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    
    this.persistenceTimer = setInterval(() => {
      if (this.pendingChanges > 0) {
        this.persistState();
      }
    }, this.persistence.interval);
  }

  /**
   * Notifies all observers of a state change
   * @param change The state change
   */
  private notifyObservers(change: StateChange): void {
    this.observers.forEach(observer => {
      try {
        observer.onStateChanged(change);
      } catch (error) {
        console.error('[StateManager] Error notifying observer:', error);
      }
    });
  }

  /**
   * Notifies all observers of a transaction completion
   * @param transaction The completed transaction
   */
  private notifyTransactionCompleted(transaction: StateTransaction): void {
    this.observers.forEach(observer => {
      try {
        observer.onTransactionCompleted(transaction);
      } catch (error) {
        console.error('[StateManager] Error notifying transaction completion:', error);
      }
    });
  }

  /**
   * Adds a state change to history
   * @param change The state change to add
   */
  private addToHistory(change: StateChange): void {
    this.history.push(change);
    
    // Trim history if it exceeds the limit
    if (this.history.length > this.historyLimit) {
      this.history = this.history.slice(-this.historyLimit);
    }
  }

  /**
   * Gets event type corresponding to a status
   * @param status Agent status
   * @returns Corresponding event type
   */
  private statusToEventType(status: AgentStatus): OrchestrationEventType | null {
    switch (status) {
      case 'created':
        return OrchestrationEventType.AGENT_CREATED;
      case 'running':
        return OrchestrationEventType.AGENT_STARTED;
      case 'stopped':
        return OrchestrationEventType.AGENT_STOPPED;
      case 'paused':
        return OrchestrationEventType.AGENT_PAUSED;
      case 'failed':
        return OrchestrationEventType.AGENT_STATUS_CHANGED;
      default:
        return null;
    }
  }

  /**
   * Gets entity type from category name
   * @param category Category name
   * @returns Entity type
   */
  private entityTypeFromCategory(category: string): 'agent' | 'workflow' | 'task' | 'resource' {
    switch (category) {
      case 'agents':
        return 'agent';
      case 'workflows':
        return 'workflow';
      case 'tasks':
        return 'task';
      case 'resources':
        return 'resource';
      default:
        return 'agent';
    }
  }

  /**
   * Gets category from entity type
   * @param entityType Entity type
   * @returns Category name
   */
  private categoryFromEntityType(entityType: string): string {
    switch (entityType) {
      case 'agent':
        return 'agents';
      case 'workflow':
        return 'workflows';
      case 'task':
        return 'tasks';
      case 'resource':
        return 'resources';
      default:
        return 'system';
    }
  }

  /**
   * Generates a unique ID
   * @returns Unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Cleans up resources
   */
  public dispose(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    
    // Persist any pending changes
    if (this.pendingChanges > 0) {
      this.persistState();
    }
    
    this.eventEmitter.removeAllListeners();
    this.observers.clear();
  }
}

export default StateManager; 