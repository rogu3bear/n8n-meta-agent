import { EventEmitter, EventHandler, OrchestrationEvent } from '../../types/orchestration';

export class RegistryEventEmitter implements EventEmitter {
  private handlers: Set<EventHandler>;

  constructor() {
    this.handlers = new Set();
  }

  async emit(event: OrchestrationEvent): Promise<void> {
    try {
      // Emit event to all registered handlers
      const promises = Array.from(this.handlers).map(handler => {
        switch (event.type) {
          case event.type.startsWith('agent.') ? event.type : null:
            return handler.handleAgentEvent(event);
          case event.type.startsWith('template.') ? event.type : null:
            return handler.handleTemplateEvent(event);
          case event.type.startsWith('registry.') ? event.type : null:
            return handler.handleRegistryEvent(event);
          default:
            console.warn(`Unknown event type: ${event.type}`);
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error emitting event:', error);
      throw error;
    }
  }

  subscribe(handler: EventHandler): void {
    if (this.handlers.has(handler)) {
      console.warn('Handler already subscribed');
      return;
    }
    this.handlers.add(handler);
  }

  unsubscribe(handler: EventHandler): void {
    if (!this.handlers.has(handler)) {
      console.warn('Handler not subscribed');
      return;
    }
    this.handlers.delete(handler);
  }

  getHandlerCount(): number {
    return this.handlers.size;
  }

  clearHandlers(): void {
    this.handlers.clear();
  }
} 