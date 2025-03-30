import { MetricsCollector } from '../../services/metricsCollector';
import { TestUtils } from '../utils/testUtils';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('Metric Collection', () => {
    it('should collect system metrics', async () => {
      const metrics = await collector.collectSystemMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.disk).toBeDefined();
    });

    it('should collect agent metrics', async () => {
      const agentId = 'test-agent';
      const metrics = await collector.collectAgentMetrics(agentId);

      expect(metrics).toBeDefined();
      expect(metrics.id).toBe(agentId);
      expect(metrics.status).toBeDefined();
      expect(metrics.executions).toBeDefined();
    });

    it('should collect workflow metrics', async () => {
      const workflowId = 'test-workflow';
      const metrics = await collector.collectWorkflowMetrics(workflowId);

      expect(metrics).toBeDefined();
      expect(metrics.id).toBe(workflowId);
      expect(metrics.executions).toBeDefined();
      expect(metrics.successRate).toBeDefined();
    });
  });

  describe('Metric Aggregation', () => {
    it('should aggregate metrics over time', async () => {
      const startTime = Date.now();
      const duration = 3600000; // 1 hour

      const aggregated = await collector.aggregateMetrics(startTime, duration);
      
      expect(aggregated).toBeDefined();
      expect(aggregated.period).toBeDefined();
      expect(aggregated.metrics).toBeDefined();
    });

    it('should calculate statistical measures', async () => {
      const metrics = await collector.calculateStatistics({
        values: [1, 2, 3, 4, 5]
      });

      expect(metrics).toBeDefined();
      expect(metrics.mean).toBe(3);
      expect(metrics.median).toBe(3);
      expect(metrics.stdDev).toBeDefined();
    });

    it('should handle metric grouping', async () => {
      const grouped = await collector.groupMetrics({
        by: 'type',
        metrics: [
          { type: 'http', value: 1 },
          { type: 'http', value: 2 },
          { type: 'function', value: 3 }
        ]
      });

      expect(grouped).toBeDefined();
      expect(grouped.http).toHaveLength(2);
      expect(grouped.function).toHaveLength(1);
    });
  });

  describe('Metric Storage', () => {
    it('should store metrics', async () => {
      const metrics = {
        type: 'system',
        timestamp: Date.now(),
        values: { cpu: 50, memory: 70 }
      };

      await collector.storeMetrics(metrics);
      const stored = await collector.getMetrics(metrics.type, metrics.timestamp);

      expect(stored).toEqual(metrics);
    });

    it('should handle metric retention', async () => {
      const oldMetrics = {
        type: 'system',
        timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        values: { cpu: 50, memory: 70 }
      };

      await collector.storeMetrics(oldMetrics);
      await collector.cleanupOldMetrics(7); // Keep last 7 days

      const stored = await collector.getMetrics(oldMetrics.type, oldMetrics.timestamp);
      expect(stored).toBeNull();
    });

    it('should handle metric compression', async () => {
      const metrics = {
        type: 'system',
        timestamp: Date.now(),
        values: { cpu: 50, memory: 70 }
      };

      const compressed = await collector.compressMetrics(metrics);
      const decompressed = await collector.decompressMetrics(compressed);

      expect(compressed).not.toEqual(metrics);
      expect(decompressed).toEqual(metrics);
    });
  });

  describe('Metric Analysis', () => {
    it('should detect anomalies', async () => {
      const metrics = [
        { timestamp: Date.now() - 1000, value: 50 },
        { timestamp: Date.now() - 500, value: 51 },
        { timestamp: Date.now(), value: 1000 } // Anomaly
      ];

      const anomalies = await collector.detectAnomalies(metrics);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].value).toBe(1000);
    });

    it('should generate trend analysis', async () => {
      const metrics = Array(10).fill(null).map((_, i) => ({
        timestamp: Date.now() - (9 - i) * 1000,
        value: i
      }));

      const trends = await collector.analyzeTrends(metrics);
      expect(trends).toBeDefined();
      expect(trends.direction).toBe('up');
      expect(trends.rate).toBeDefined();
    });

    it('should perform correlation analysis', async () => {
      const metrics1 = [1, 2, 3, 4, 5];
      const metrics2 = [2, 4, 6, 8, 10];

      const correlation = await collector.calculateCorrelation(metrics1, metrics2);
      expect(correlation).toBe(1); // Perfect positive correlation
    });
  });

  describe('Metric Reporting', () => {
    it('should generate metric reports', async () => {
      const report = await collector.generateReport({
        type: 'system',
        period: 'daily'
      });

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
    });

    it('should export metrics in different formats', async () => {
      const metrics = {
        type: 'system',
        timestamp: Date.now(),
        values: { cpu: 50, memory: 70 }
      };

      const json = await collector.exportMetrics(metrics, 'json');
      const csv = await collector.exportMetrics(metrics, 'csv');

      expect(typeof json).toBe('string');
      expect(typeof csv).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
      expect(csv).toContain('type,timestamp,values');
    });

    it('should handle report scheduling', async () => {
      const schedule = {
        type: 'system',
        period: 'daily',
        time: '00:00'
      };

      await collector.scheduleReport(schedule);
      const scheduled = await collector.getScheduledReports();

      expect(scheduled).toContainEqual(schedule);
    });
  });

  describe('Error Handling', () => {
    it('should handle collection errors', async () => {
      await expect(collector.collectAgentMetrics('invalid-agent')).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      const invalidMetrics = {
        type: null,
        timestamp: null,
        values: null
      };

      await expect(collector.storeMetrics(invalidMetrics)).rejects.toThrow();
    });

    it('should handle analysis errors', async () => {
      await expect(collector.detectAnomalies([])).rejects.toThrow();
      await expect(collector.analyzeTrends([])).rejects.toThrow();
      await expect(collector.calculateCorrelation([], [])).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency metric collection', async () => {
      const startTime = Date.now();
      const numMetrics = 1000;

      for (let i = 0; i < numMetrics; i++) {
        await collector.collectSystemMetrics();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain performance with large datasets', async () => {
      const metrics = Array(10000).fill(null).map((_, i) => ({
        timestamp: Date.now() - i * 1000,
        value: Math.random()
      }));

      const startTime = Date.now();
      const results = await Promise.all([
        collector.detectAnomalies(metrics),
        collector.analyzeTrends(metrics),
        collector.calculateStatistics({ values: metrics.map(m => m.value) })
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
}); 