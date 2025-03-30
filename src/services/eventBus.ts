import { OrchestrationEvent } from '../types/orchestration';
import { EventEmitter } from 'events';

interface EventHandler {
  handler: (event: OrchestrationEvent) => Promise<void>;
  filter?: (event: OrchestrationEvent) => boolean;
  priority: number;
}

interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  createdAt: Date;
}

export class EventBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, EventSubscription[]>;
  private errorHandlers: ((error: Error, event: OrchestrationEvent) => Promise<void>)[];
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor() {
    this.emitter = new EventEmitter();
    this.subscriptions = new Map();
    this.errorHandlers = [];
  }

  // Event Publishing

  public async publish(event: OrchestrationEvent): Promise<void> {
    try {
      // Emit the event to all subscribers
      this.emitter.emit(event.type, event);

      // Process subscriptions with retries
      const subscriptions = this.subscriptions.get(event.type) || [];
      for (const subscription of subscriptions) {
        await this.processSubscription(subscription, event);
      }
    } catch (error) {
      await this.handleError(error as Error, event);
    }
  }

  private async processSubscription(
    subscription: EventSubscription,
    event: OrchestrationEvent
  ): Promise<void> {
    const { handler } = subscription;

    // Apply filter if present
    if (handler.filter && !handler.filter(event)) {
      return;
    }

    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        await handler.handler(event);
        return;
      } catch (error) {
        retries++;
        if (retries === this.MAX_RETRIES) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      }
    }
  }

  // Event Subscription

  public subscribe(
    eventType: string,
    handler: (event: OrchestrationEvent) => Promise<void>,
    options: {
      filter?: (event: OrchestrationEvent) => boolean;
      priority?: number;
    } = {}
  ): string {
    const subscription: EventSubscription = {
      id: Math.random().toString(36).substring(7),
      eventType,
      handler: {
        handler,
        filter: options.filter,
        priority: options.priority || 0
      },
      createdAt: new Date()
    };

    const subscriptions = this.subscriptions.get(eventType) || [];
    subscriptions.push(subscription);
    subscriptions.sort((a, b) => b.handler.priority - a.handler.priority);
    this.subscriptions.set(eventType, subscriptions);

    return subscription.id;
  }

  public unsubscribe(subscriptionId: string): void {
    for (const [eventType, subscriptions] of this.subscriptions.entries()) {
      const filteredSubscriptions = subscriptions.filter(s => s.id !== subscriptionId);
      if (filteredSubscriptions.length !== subscriptions.length) {
        this.subscriptions.set(eventType, filteredSubscriptions);
        return;
      }
    }
  }

  // Error Handling

  public addErrorHandler(
    handler: (error: Error, event: OrchestrationEvent) => Promise<void>
  ): void {
    this.errorHandlers.push(handler);
  }

  public removeErrorHandler(
    handler: (error: Error, event: OrchestrationEvent) => Promise<void>
  ): void {
    this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
  }

  private async handleError(error: Error, event: OrchestrationEvent): Promise<void> {
    for (const handler of this.errorHandlers) {
      try {
        await handler(error, event);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }
  }

  // Event Filtering

  public filterEvents(
    events: OrchestrationEvent[],
    filter: (event: OrchestrationEvent) => boolean
  ): OrchestrationEvent[] {
    return events.filter(filter);
  }

  public filterByType(events: OrchestrationEvent[], eventType: string): OrchestrationEvent[] {
    return events.filter(event => event.type === eventType);
  }

  public filterByTimeRange(
    events: OrchestrationEvent[],
    startTime: Date,
    endTime: Date
  ): OrchestrationEvent[] {
    return events.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  // Event Routing

  public routeEvent(
    event: OrchestrationEvent,
    routes: { [key: string]: (event: OrchestrationEvent) => Promise<void> }
  ): Promise<void> {
    const handler = routes[event.type];
    if (handler) {
      return handler(event);
    }
    return Promise.resolve();
  }

  // Event Batching

  public async batchEvents(
    events: OrchestrationEvent[],
    batchSize: number
  ): Promise<OrchestrationEvent[][]> {
    const batches: OrchestrationEvent[][] = [];
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }
    return batches;
  }

  // Event Statistics

  public getEventStats(): {
    totalEvents: number;
    eventsByType: { [key: string]: number };
    averageProcessingTime: number;
  } {
    const stats = {
      totalEvents: 0,
      eventsByType: {} as { [key: string]: number },
      averageProcessingTime: 0
    };

    // Calculate statistics from event history
    // Implementation would depend on how event history is stored

    return stats;
  }

  // Cleanup

  public async cleanup(): Promise<void> {
    this.subscriptions.clear();
    this.errorHandlers = [];
  }
}

export default EventBus; 