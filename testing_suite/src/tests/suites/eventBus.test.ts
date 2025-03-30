import { EventBus } from '../../services/eventBus';
import { TestUtils } from '../utils/testUtils';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('Event Publishing', () => {
    it('should publish events', async () => {
      const event = {
        type: 'test.event',
        data: { test: 'data' },
        timestamp: Date.now()
      };

      const published = await bus.publish(event);
      expect(published).toBeDefined();
      expect(published.type).toBe(event.type);
      expect(published.data).toEqual(event.data);
    });

    it('should handle event metadata', async () => {
      const event = {
        type: 'test.event',
        data: { test: 'data' },
        metadata: {
          source: 'test',
          correlationId: 'test-correlation',
          priority: 'high'
        }
      };

      const published = await bus.publish(event);
      expect(published.metadata).toEqual(event.metadata);
    });

    it('should validate event structure', async () => {
      const invalidEvent = {
        type: '',
        data: null
      };

      await expect(bus.publish(invalidEvent)).rejects.toThrow();
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to events', async () => {
      const events: any[] = [];
      const handler = (event: any) => events.push(event);

      await bus.subscribe('test.event', handler);
      await bus.publish({
        type: 'test.event',
        data: { test: 'data' }
      });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('test.event');
    });

    it('should handle multiple subscribers', async () => {
      const events1: any[] = [];
      const events2: any[] = [];
      const handler1 = (event: any) => events1.push(event);
      const handler2 = (event: any) => events2.push(event);

      await bus.subscribe('test.event', handler1);
      await bus.subscribe('test.event', handler2);
      await bus.publish({
        type: 'test.event',
        data: { test: 'data' }
      });

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
    });

    it('should handle wildcard subscriptions', async () => {
      const events: any[] = [];
      const handler = (event: any) => events.push(event);

      await bus.subscribe('test.*', handler);
      await bus.publish({
        type: 'test.event1',
        data: { test: 'data1' }
      });
      await bus.publish({
        type: 'test.event2',
        data: { test: 'data2' }
      });

      expect(events.length).toBe(2);
      expect(events.map(e => e.type)).toContain('test.event1');
      expect(events.map(e => e.type)).toContain('test.event2');
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by type', async () => {
      const events: any[] = [];
      const handler = (event: any) => events.push(event);

      await bus.subscribe('test.event', handler);
      await bus.publish({
        type: 'other.event',
        data: { test: 'data' }
      });

      expect(events.length).toBe(0);
    });

    it('should filter events by data', async () => {
      const events: any[] = [];
      const handler = (event: any) => events.push(event);

      await bus.subscribe('test.event', handler, {
        filter: (event) => event.data.value > 5
      });

      await bus.publish({
        type: 'test.event',
        data: { value: 3 }
      });
      await bus.publish({
        type: 'test.event',
        data: { value: 7 }
      });

      expect(events.length).toBe(1);
      expect(events[0].data.value).toBe(7);
    });

    it('should handle complex filters', async () => {
      const events: any[] = [];
      const handler = (event: any) => events.push(event);

      await bus.subscribe('test.event', handler, {
        filter: (event) => 
          event.data.value > 5 && 
          event.metadata?.priority === 'high'
      });

      await bus.publish({
        type: 'test.event',
        data: { value: 7 },
        metadata: { priority: 'low' }
      });
      await bus.publish({
        type: 'test.event',
        data: { value: 7 },
        metadata: { priority: 'high' }
      });

      expect(events.length).toBe(1);
      expect(events[0].metadata.priority).toBe('high');
    });
  });

  describe('Event Handling', () => {
    it('should handle async event handlers', async () => {
      const events: any[] = [];
      const handler = async (event: any) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        events.push(event);
      };

      await bus.subscribe('test.event', handler);
      await bus.publish({
        type: 'test.event',
        data: { test: 'data' }
      });

      expect(events.length).toBe(1);
    });

    it('should handle handler errors', async () => {
      const errors: any[] = [];
      const handler = (event: any) => {
        throw new Error('Test error');
      };

      bus.on('error', (error) => errors.push(error));
      await bus.subscribe('test.event', handler);
      await bus.publish({
        type: 'test.event',
        data: { test: 'data' }
      });

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Test error');
    });

    it('should handle handler timeouts', async () => {
      const errors: any[] = [];
      const handler = async (event: any) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      };

      bus.on('error', (error) => errors.push(error));
      await bus.subscribe('test.event', handler, { timeout: 100 });
      await bus.publish({
        type: 'test.event',
        data: { test: 'data' }
      });

      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('timeout');
    });
  });

  describe('Event Retry', () => {
    it('should retry failed events', async () => {
      let attempts = 0;
      const handler = (event: any) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
      };

      await bus.subscribe('test.event', handler, {
        retry: {
          maxAttempts: 3,
          delay: 100
        }
      });

      await bus.publish({
        type: 'test.event',
        data: { test: 'data' }
      });

      expect(attempts).toBe(3);
    });

    it('should handle retry exhaustion', async () => {
      const errors: any[] = [];
      const handler = (event: any) => {
        throw new Error('Test error');
      };

      bus.on('error', (error) => errors.push(error));
      await bus.subscribe('test.event', handler, {
        retry: {
          maxAttempts: 3,
          delay: 100
        }
      });

      await bus.publish({
        type: 'test.event',
        data: { test: 'data' }
      });

      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('max attempts');
    });
  });

  describe('Event Batching', () => {
    it('should batch events', async () => {
      const batches: any[] = [];
      const handler = (events: any[]) => batches.push(events);

      await bus.subscribe('test.event', handler, {
        batch: {
          size: 3,
          timeout: 1000
        }
      });

      await Promise.all([
        bus.publish({ type: 'test.event', data: { value: 1 } }),
        bus.publish({ type: 'test.event', data: { value: 2 } }),
        bus.publish({ type: 'test.event', data: { value: 3 } })
      ]);

      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(3);
    });

    it('should handle batch timeouts', async () => {
      const batches: any[] = [];
      const handler = (events: any[]) => batches.push(events);

      await bus.subscribe('test.event', handler, {
        batch: {
          size: 3,
          timeout: 100
        }
      });

      await bus.publish({
        type: 'test.event',
        data: { value: 1 }
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle publishing errors', async () => {
      const invalidEvent = {
        type: null,
        data: null
      };

      await expect(bus.publish(invalidEvent)).rejects.toThrow();
    });

    it('should handle subscription errors', async () => {
      await expect(bus.subscribe('test.event', null)).rejects.toThrow();
    });

    it('should handle unsubscription errors', async () => {
      await expect(bus.unsubscribe('non-existent')).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high event throughput', async () => {
      const startTime = Date.now();
      const numEvents = 1000;

      for (let i = 0; i < numEvents; i++) {
        await bus.publish({
          type: 'test.event',
          data: { value: i }
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain performance with many subscribers', async () => {
      const startTime = Date.now();
      const numSubscribers = 100;

      for (let i = 0; i < numSubscribers; i++) {
        await bus.subscribe('test.event', () => {});
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent event publishing', async () => {
      const startTime = Date.now();
      const numPublishers = 10;

      const publishers = Array(numPublishers).fill(null).map((_, i) => 
        bus.publish({
          type: 'test.event',
          data: { value: i }
        })
      );

      const results = await Promise.all(publishers);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.length).toBe(numPublishers);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
}); 