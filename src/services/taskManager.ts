import { EventEmitter } from 'events';
import { OrchestrationEvent } from '../types/orchestration';
import { ResourceManager } from './resourceManager';

interface Task {
  id: string;
  agentId: string;
  type: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  parameters: any;
  dependencies: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
  retries: number;
  maxRetries: number;
  timeout: number;
}

interface TaskQueue {
  high: Task[];
  medium: Task[];
  low: Task[];
}

export class TaskManager extends EventEmitter {
  private queues: TaskQueue;
  private activeTasks: Map<string, Task>;
  private resourceManager: ResourceManager;
  private processingInterval: NodeJS.Timeout | null;
  private readonly MAX_CONCURRENT_TASKS = 5;
  private readonly DEFAULT_PROCESSING_INTERVAL = 1000; // 1 second
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private readonly DEFAULT_MAX_RETRIES = 3;

  constructor(resourceManager: ResourceManager) {
    super();
    this.queues = {
      high: [],
      medium: [],
      low: []
    };
    this.activeTasks = new Map();
    this.resourceManager = resourceManager;
    this.processingInterval = null;
  }

  // Task Creation and Submission

  public async submitTask(
    agentId: string,
    type: string,
    parameters: any,
    options: {
      priority?: 'high' | 'medium' | 'low';
      dependencies?: string[];
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<Task> {
    const task: Task = {
      id: Math.random().toString(36).substring(7),
      agentId,
      type,
      priority: this.getPriorityValue(options.priority || 'medium'),
      status: 'pending',
      parameters,
      dependencies: options.dependencies || [],
      createdAt: new Date(),
      retries: 0,
      maxRetries: options.maxRetries || this.DEFAULT_MAX_RETRIES,
      timeout: options.timeout || this.DEFAULT_TIMEOUT
    };

    // Add to appropriate queue
    this.enqueueTask(task);

    // Emit task created event
    this.emit('taskCreated', {
      type: 'task.created',
      timestamp: new Date(),
      payload: task
    });

    return task;
  }

  // Task Queue Management

  private enqueueTask(task: Task): void {
    const queue = this.getQueueForPriority(task.priority);
    queue.push(task);
    queue.sort((a, b) => b.priority - a.priority);
  }

  private getQueueForPriority(priority: number): Task[] {
    if (priority >= 8) return this.queues.high;
    if (priority >= 4) return this.queues.medium;
    return this.queues.low;
  }

  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high':
        return 10;
      case 'medium':
        return 5;
      case 'low':
        return 1;
      default:
        return 5;
    }
  }

  // Task Processing

  public startProcessing(interval: number = this.DEFAULT_PROCESSING_INTERVAL): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processTaskQueue();
    }, interval);
  }

  public stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async processTaskQueue(): Promise<void> {
    // Check if we can process more tasks
    if (this.activeTasks.size >= this.MAX_CONCURRENT_TASKS) {
      return;
    }

    // Process tasks from each queue in priority order
    for (const queue of [this.queues.high, this.queues.medium, this.queues.low]) {
      for (let i = 0; i < queue.length; i++) {
        const task = queue[i];

        // Check dependencies
        if (!this.canExecuteTask(task)) {
          continue;
        }

        // Remove from queue and start processing
        queue.splice(i, 1);
        await this.executeTask(task);
        break;
      }
    }
  }

  private canExecuteTask(task: Task): boolean {
    // Check if all dependencies are completed
    return task.dependencies.every(depId => {
      const depTask = this.activeTasks.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  private async executeTask(task: Task): Promise<void> {
    try {
      // Update task status
      task.status = 'processing';
      task.startedAt = new Date();
      this.activeTasks.set(task.id, task);

      // Emit task started event
      this.emit('taskStarted', {
        type: 'task.started',
        timestamp: new Date(),
        payload: task
      });

      // Execute task with timeout
      await Promise.race([
        this.executeTaskLogic(task),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), task.timeout)
        )
      ]);

      // Update task status
      task.status = 'completed';
      task.completedAt = new Date();

      // Emit task completed event
      this.emit('taskCompleted', {
        type: 'task.completed',
        timestamp: new Date(),
        payload: task
      });
    } catch (error) {
      await this.handleTaskError(task, error as Error);
    }
  }

  private async executeTaskLogic(task: Task): Promise<void> {
    // Implement actual task execution logic
    // This would typically involve:
    // 1. Allocating resources
    // 2. Running the task
    // 3. Collecting results
    // 4. Releasing resources
  }

  private async handleTaskError(task: Task, error: Error): Promise<void> {
    task.error = error;
    task.retries++;

    if (task.retries < task.maxRetries) {
      // Retry task
      task.status = 'pending';
      this.enqueueTask(task);
    } else {
      // Mark task as failed
      task.status = 'failed';
      task.completedAt = new Date();
    }

    // Emit task failed event
    this.emit('taskFailed', {
      type: 'task.failed',
      timestamp: new Date(),
      payload: {
        task,
        error: error.message
      }
    });
  }

  // Task Status and Monitoring

  public getTaskStatus(taskId: string): Task | undefined {
    return this.activeTasks.get(taskId);
  }

  public getQueueStatus(): {
    high: number;
    medium: number;
    low: number;
    active: number;
  } {
    return {
      high: this.queues.high.length,
      medium: this.queues.medium.length,
      low: this.queues.low.length,
      active: this.activeTasks.size
    };
  }

  // Task Cancellation

  public async cancelTask(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Remove from active tasks
    this.activeTasks.delete(taskId);

    // Emit task cancelled event
    this.emit('taskCancelled', {
      type: 'task.cancelled',
      timestamp: new Date(),
      payload: task
    });
  }

  // Task Dependencies

  public async addDependency(taskId: string, dependencyId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!task.dependencies.includes(dependencyId)) {
      task.dependencies.push(dependencyId);
    }
  }

  public async removeDependency(taskId: string, dependencyId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    task.dependencies = task.dependencies.filter(id => id !== dependencyId);
  }

  // Cleanup

  public async cleanup(): Promise<void> {
    this.stopProcessing();
    this.queues = {
      high: [],
      medium: [],
      low: []
    };
    this.activeTasks.clear();
  }
}

export default TaskManager; 