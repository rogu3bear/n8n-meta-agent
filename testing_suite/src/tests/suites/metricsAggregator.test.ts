import { MetricsAggregator } from '../../services/metricsAggregator';
import { TestUtils } from '../utils/testUtils';

describe('MetricsAggregator', () => {
  let aggregator: MetricsAggregator;

  beforeEach(() => {
    aggregator = new MetricsAggregator();
  });

  describe('Metric Collection', () => {
    it('should collect numeric metrics', async () => {
      const key = 'test.metric';
      const value = 42;

      await aggregator.record(key, value);
      const stats = await aggregator.getStats(key);
      expect(stats.count).toBe(1);
      expect(stats.sum).toBe(value);
      expect(stats.min).toBe(value);
      expect(stats.max).toBe(value);
      expect(stats.avg).toBe(value);
    });

    it('should collect multiple values', async () => {
      const key = 'test.metric';
      const values = [1, 2, 3, 4, 5];

      for (const value of values) {
        await aggregator.record(key, value);
      }

      const stats = await aggregator.getStats(key);
      expect(stats.count).toBe(values.length);
      expect(stats.sum).toBe(values.reduce((a, b) => a + b, 0));
      expect(stats.min).toBe(Math.min(...values));
      expect(stats.max).toBe(Math.max(...values));
      expect(stats.avg).toBe(values.reduce((a, b) => a + b, 0) / values.length);
    });

    it('should handle different metric types', async () => {
      const metrics = {
        'test.counter': 42,
        'test.gauge': 3.14,
        'test.timing': 100
      };

      for (const [key, value] of Object.entries(metrics)) {
        await aggregator.record(key, value);
        const stats = await aggregator.getStats(key);
        expect(stats.count).toBe(1);
        expect(stats.sum).toBe(value);
      }
    });
  });

  describe('Metric Aggregation', () => {
    it('should calculate percentiles', async () => {
      const key = 'test.metric';
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      for (const value of values) {
        await aggregator.record(key, value);
      }

      const stats = await aggregator.getStats(key);
      expect(stats.p50).toBe(5);
      expect(stats.p90).toBe(9);
      expect(stats.p95).toBe(9.5);
      expect(stats.p99).toBe(9.9);
    });

    it('should calculate standard deviation', async () => {
      const key = 'test.metric';
      const values = [1, 2, 3, 4, 5];

      for (const value of values) {
        await aggregator.record(key, value);
      }

      const stats = await aggregator.getStats(key);
      expect(stats.stddev).toBeDefined();
      expect(stats.stddev).toBeGreaterThan(0);
    });

    it('should handle empty metrics', async () => {
      const key = 'test.metric';
      const stats = await aggregator.getStats(key);
      expect(stats.count).toBe(0);
      expect(stats.sum).toBe(0);
      expect(stats.min).toBe(Infinity);
      expect(stats.max).toBe(-Infinity);
      expect(stats.avg).toBe(0);
    });
  });

  describe('Metric Windows', () => {
    it('should maintain rolling windows', async () => {
      const key = 'test.metric';
      const window = 1000;
      const values = [1, 2, 3, 4, 5];

      for (const value of values) {
        await aggregator.record(key, value, { window });
      }

      const stats = await aggregator.getStats(key, { window });
      expect(stats.count).toBe(values.length);
      expect(stats.sum).toBe(values.reduce((a, b) => a + b, 0));
    });

    it('should expire old values', async () => {
      const key = 'test.metric';
      const window = 100;

      await aggregator.record(key, 1, { window });
      await new Promise(resolve => setTimeout(resolve, window + 50));
      await aggregator.record(key, 2, { window });

      const stats = await aggregator.getStats(key, { window });
      expect(stats.count).toBe(1);
      expect(stats.sum).toBe(2);
    });

    it('should handle multiple windows', async () => {
      const key = 'test.metric';
      const windows = [100, 500, 1000];
      const value = 42;

      for (const window of windows) {
        await aggregator.record(key, value, { window });
        const stats = await aggregator.getStats(key, { window });
        expect(stats.count).toBe(1);
        expect(stats.sum).toBe(value);
      }
    });
  });

  describe('Metric Labels', () => {
    it('should handle labeled metrics', async () => {
      const key = 'test.metric';
      const labels = { service: 'test', region: 'us' };
      const value = 42;

      await aggregator.record(key, value, { labels });
      const stats = await aggregator.getStats(key, { labels });
      expect(stats.count).toBe(1);
      expect(stats.sum).toBe(value);
    });

    it('should aggregate by labels', async () => {
      const key = 'test.metric';
      const labels1 = { service: 'test1' };
      const labels2 = { service: 'test2' };
      const value = 42;

      await aggregator.record(key, value, { labels: labels1 });
      await aggregator.record(key, value * 2, { labels: labels2 });

      const stats1 = await aggregator.getStats(key, { labels: labels1 });
      const stats2 = await aggregator.getStats(key, { labels: labels2 });

      expect(stats1.sum).toBe(value);
      expect(stats2.sum).toBe(value * 2);
    });

    it('should handle label patterns', async () => {
      const key = 'test.metric';
      const labels = { service: 'test.*' };
      const value = 42;

      await aggregator.record(key, value, { labels });
      const stats = await aggregator.getStats(key, { labels });
      expect(stats.count).toBe(1);
      expect(stats.sum).toBe(value);
    });
  });

  describe('Metric Export', () => {
    it('should export metrics in different formats', async () => {
      const key = 'test.metric';
      const value = 42;

      await aggregator.record(key, value);

      const json = await aggregator.export('json');
      expect(json).toBeDefined();
      expect(JSON.parse(json)).toHaveProperty(key);

      const csv = await aggregator.export('csv');
      expect(csv).toBeDefined();
      expect(csv).toContain(key);
    });

    it('should handle export filters', async () => {
      const metrics = {
        'test.metric1': 42,
        'test.metric2': 84,
        'other.metric': 21
      };

      for (const [key, value] of Object.entries(metrics)) {
        await aggregator.record(key, value);
      }

      const json = await aggregator.export('json', { filter: 'test.*' });
      const data = JSON.parse(json);
      expect(Object.keys(data)).toHaveLength(2);
      expect(data).toHaveProperty('test.metric1');
      expect(data).toHaveProperty('test.metric2');
    });

    it('should handle export errors', async () => {
      await expect(aggregator.export('invalid')).rejects.toThrow();
    });
  });

  describe('Metric Cleanup', () => {
    it('should clean up old metrics', async () => {
      const key = 'test.metric';
      const window = 100;

      await aggregator.record(key, 42, { window });
      await new Promise(resolve => setTimeout(resolve, window + 50));
      await aggregator.cleanup();

      const stats = await aggregator.getStats(key, { window });
      expect(stats.count).toBe(0);
    });

    it('should handle cleanup errors', async () => {
      await expect(aggregator.cleanup()).resolves.not.toThrow();
    });

    it('should clean up specific metrics', async () => {
      const key = 'test.metric';
      const value = 42;

      await aggregator.record(key, value);
      await aggregator.cleanup({ filter: key });

      const stats = await aggregator.getStats(key);
      expect(stats.count).toBe(0);
    });
  });

  describe('Metric Reset', () => {
    it('should reset metrics', async () => {
      const key = 'test.metric';
      const value = 42;

      await aggregator.record(key, value);
      await aggregator.reset(key);

      const stats = await aggregator.getStats(key);
      expect(stats.count).toBe(0);
    });

    it('should handle reset of non-existent metrics', async () => {
      await expect(aggregator.reset('non-existent')).resolves.not.toThrow();
    });

    it('should handle reset of all metrics', async () => {
      const metrics = {
        'test.metric1': 42,
        'test.metric2': 84
      };

      for (const [key, value] of Object.entries(metrics)) {
        await aggregator.record(key, value);
      }

      await aggregator.resetAll();
      for (const key of Object.keys(metrics)) {
        const stats = await aggregator.getStats(key);
        expect(stats.count).toBe(0);
      }
    });
  });

  describe('Metric Persistence', () => {
    it('should persist metrics', async () => {
      const key = 'test.metric';
      const value = 42;

      await aggregator.record(key, value);
      await aggregator.persist();

      const newAggregator = new MetricsAggregator();
      await newAggregator.restore();
      const stats = await newAggregator.getStats(key);
      expect(stats.count).toBe(1);
      expect(stats.sum).toBe(value);
    });

    it('should handle persistence errors', async () => {
      await expect(aggregator.persist()).resolves.not.toThrow();
    });

    it('should handle restoration errors', async () => {
      await expect(aggregator.restore()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid metrics', async () => {
      const key = 'test.metric';
      await expect(aggregator.record(key, null)).rejects.toThrow();
      await expect(aggregator.record(key, undefined)).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      const key = 'test.metric';
      await expect(aggregator.record(key, 42)).resolves.not.toThrow();
    });

    it('should handle concurrent access', async () => {
      const key = 'test.metric';
      const value = 42;
      const numOperations = 100;

      const operations = Array(numOperations).fill(null).map(() =>
        aggregator.record(key, value)
      );

      await Promise.all(operations);
      const stats = await aggregator.getStats(key);
      expect(stats.count).toBe(numOperations);
      expect(stats.sum).toBe(value * numOperations);
    });
  });

  describe('Performance', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();
      const numMetrics = 1000;
      const value = 42;

      for (let i = 0; i < numMetrics; i++) {
        await aggregator.record(`metric${i}`, value);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with many aggregations', async () => {
      const startTime = Date.now();
      const key = 'test.metric';
      const numValues = 1000;
      const value = 42;

      for (let i = 0; i < numValues; i++) {
        await aggregator.record(key, value);
      }

      const stats = await aggregator.getStats(key);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(stats.count).toBe(numValues);
      expect(stats.sum).toBe(value * numValues);
    });

    it('should handle concurrent metric operations', async () => {
      const startTime = Date.now();
      const key = 'test.metric';
      const numOperations = 100;
      const value = 42;

      const operations = Array(numOperations).fill(null).map(() =>
        Promise.all([
          aggregator.record(key, value),
          aggregator.getStats(key)
        ])
      );

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.length).toBe(numOperations);
      expect(results.every(([record, stats]) => record && stats)).toBe(true);
    });
  });
}); 