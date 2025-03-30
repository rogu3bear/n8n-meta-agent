import { QueueManager } from '../../services/queueManager';
import { TestUtils } from '../utils/testUtils';

describe('QueueManager', () => {
  let queue: QueueManager;

  beforeEach(() => {
    queue = new QueueManager();
  });

  describe('Queue Operations', () => {
    it('should enqueue and dequeue items', async () => {
      const item = { test: 'data' };

      await queue.enqueue('test.queue', item);
      const dequeued = await queue.dequeue('test.queue');

      expect(dequeued).toEqual(item);
    });

    it('should handle different item types', async () => {
      const items = {
        string: 'test string',
        number: 42,
        boolean: true,
        object: { test: 'data' },
        array: [1, 2, 3],
        null: null
      };

      for (const [type, value] of Object.entries(items)) {
        await queue.enqueue('test.queue', value);
        const dequeued = await queue.dequeue('test.queue');
        expect(dequeued).toEqual(value);
      }
    });

    it('should handle empty queues', async () => {
      const dequeued = await queue.dequeue('empty.queue');
      expect(dequeued).toBeNull();
    });
  });

  describe('Queue Priority', () => {
    it('should handle priority levels', async () => {
      const items = [
        { data: 'low', priority: 1 },
        { data: 'high', priority: 3 },
        { data: 'medium', priority: 2 }
      ];

      for (const item of items) {
        await queue.enqueue('test.queue', item, { priority: item.priority });
      }

      const dequeued = await queue.dequeue('test.queue');
      expect(dequeued.data).toBe('high');
    });

    it('should handle default priority', async () => {
      const item = { test: 'data' };

      await queue.enqueue('test.queue', item);
      const dequeued = await queue.dequeue('test.queue');

      expect(dequeued).toEqual(item);
    });

    it('should handle negative priorities', async () => {
      const items = [
        { data: 'normal', priority: 0 },
        { data: 'low', priority: -1 }
      ];

      for (const item of items) {
        await queue.enqueue('test.queue', item, { priority: item.priority });
      }

      const dequeued = await queue.dequeue('test.queue');
      expect(dequeued.data).toBe('normal');
    });
  });

  describe('Queue Size', () => {
    it('should track queue size', async () => {
      const items = [
        { data: 'item1' },
        { data: 'item2' },
        { data: 'item3' }
      ];

      for (const item of items) {
        await queue.enqueue('test.queue', item);
      }

      const size = await queue.size('test.queue');
      expect(size).toBe(3);
    });

    it('should handle queue limits', async () => {
      const maxSize = 2;
      const items = [
        { data: 'item1' },
        { data: 'item2' },
        { data: 'item3' }
      ];

      for (const item of items) {
        await queue.enqueue('test.queue', item, { maxSize });
      }

      const size = await queue.size('test.queue');
      expect(size).toBe(maxSize);
    });

    it('should handle zero size limit', async () => {
      await expect(queue.enqueue('test.queue', { data: 'item' }, { maxSize: 0 }))
        .rejects.toThrow();
    });
  });

  describe('Queue Peeking', () => {
    it('should peek at next item', async () => {
      const item = { test: 'data' };

      await queue.enqueue('test.queue', item);
      const peeked = await queue.peek('test.queue');

      expect(peeked).toEqual(item);
      const size = await queue.size('test.queue');
      expect(size).toBe(1);
    });

    it('should handle peeking empty queue', async () => {
      const peeked = await queue.peek('empty.queue');
      expect(peeked).toBeNull();
    });

    it('should peek multiple items', async () => {
      const items = [
        { data: 'item1' },
        { data: 'item2' },
        { data: 'item3' }
      ];

      for (const item of items) {
        await queue.enqueue('test.queue', item);
      }

      const peeked = await queue.peek('test.queue', 3);
      expect(peeked).toEqual(items);
    });
  });

  describe('Queue Processing', () => {
    it('should process items in order', async () => {
      const items = [
        { data: 'item1' },
        { data: 'item2' },
        { data: 'item3' }
      ];

      for (const item of items) {
        await queue.enqueue('test.queue', item);
      }

      const processed = [];
      while (true) {
        const item = await queue.dequeue('test.queue');
        if (!item) break;
        processed.push(item);
      }

      expect(processed).toEqual(items);
    });

    it('should handle batch processing', async () => {
      const items = [
        { data: 'item1' },
        { data: 'item2' },
        { data: 'item3' }
      ];

      for (const item of items) {
        await queue.enqueue('test.queue', item);
      }

      const batch = await queue.dequeueBatch('test.queue', 2);
      expect(batch).toEqual(items.slice(0, 2));
    });

    it('should handle processing timeouts', async () => {
      const item = { test: 'data' };

      await queue.enqueue('test.queue', item);
      const dequeued = await queue.dequeue('test.queue', { timeout: 100 });

      expect(dequeued).toEqual(item);
    });
  });

  describe('Queue Persistence', () => {
    it('should persist queue to disk', async () => {
      const item = { test: 'data' };

      await queue.enqueue('test.queue', item);
      await queue.persist();

      const newQueue = new QueueManager();
      await newQueue.restore();
      const dequeued = await newQueue.dequeue('test.queue');
      expect(dequeued).toEqual(item);
    });

    it('should handle persistence errors', async () => {
      const item = { test: 'data' };

      await queue.enqueue('test.queue', item);
      await expect(queue.persist()).resolves.not.toThrow();
    });

    it('should handle restoration errors', async () => {
      await expect(queue.restore()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queue names', async () => {
      await expect(queue.enqueue(null, 'value')).rejects.toThrow();
      await expect(queue.dequeue(null)).rejects.toThrow();
      await expect(queue.peek(null)).rejects.toThrow();
    });

    it('should handle invalid items', async () => {
      const circular = { a: 1 };
      circular.b = circular;

      await expect(queue.enqueue('test.queue', circular)).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      const item = { test: 'data' };

      await expect(queue.enqueue('test.queue', item)).resolves.not.toThrow();
      await expect(queue.dequeue('test.queue')).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();
      const numOperations = 1000;

      for (let i = 0; i < numOperations; i++) {
        await queue.enqueue('test.queue', { value: i });
        await queue.dequeue('test.queue');
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with large items', async () => {
      const startTime = Date.now();
      const item = { data: 'x'.repeat(10000) };

      await queue.enqueue('test.queue', item);
      await queue.dequeue('test.queue');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations', async () => {
      const startTime = Date.now();
      const numOperations = 100;

      const operations = Array(numOperations).fill(null).map((_, i) => 
        Promise.all([
          queue.enqueue('test.queue', { value: i }),
          queue.dequeue('test.queue')
        ])
      );

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results.length).toBe(numOperations);
      expect(results.every(([enqueue, dequeue]) => enqueue && dequeue)).toBe(true);
    });
  });
}); 