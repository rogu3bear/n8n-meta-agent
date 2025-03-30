import { AuditLogger } from '../../services/auditLogger';
import { TestUtils } from '../utils/testUtils';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe('Log Entry Creation', () => {
    it('should create a log entry', async () => {
      const entry = await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'test-user'
      });

      expect(entry).toBeDefined();
      expect(entry.type).toBe('agent.created');
      expect(entry.details).toEqual({ agentId: 'test-agent' });
      expect(entry.userId).toBe('test-user');
      expect(entry.timestamp).toBeDefined();
    });

    it('should create a log entry with severity', async () => {
      const entry = await logger.createLogEntry({
        type: 'system.error',
        details: { error: 'Test error' },
        userId: 'test-user',
        severity: 'error'
      });

      expect(entry.severity).toBe('error');
    });

    it('should create a log entry with metadata', async () => {
      const metadata = {
        ip: '127.0.0.1',
        userAgent: 'Test Browser',
        sessionId: 'test-session'
      };

      const entry = await logger.createLogEntry({
        type: 'user.login',
        details: { userId: 'test-user' },
        userId: 'test-user',
        metadata
      });

      expect(entry.metadata).toEqual(metadata);
    });
  });

  describe('Log Entry Retrieval', () => {
    it('should get log entries by type', async () => {
      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent-1' },
        userId: 'test-user'
      });

      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent-2' },
        userId: 'test-user'
      });

      await logger.createLogEntry({
        type: 'user.login',
        details: { userId: 'test-user' },
        userId: 'test-user'
      });

      const entries = await logger.getLogEntriesByType('agent.created');
      expect(entries.length).toBe(2);
      expect(entries.every(e => e.type === 'agent.created')).toBe(true);
    });

    it('should get log entries by user', async () => {
      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'user-1'
      });

      await logger.createLogEntry({
        type: 'template.created',
        details: { templateId: 'test-template' },
        userId: 'user-2'
      });

      const entries = await logger.getLogEntriesByUser('user-1');
      expect(entries.length).toBe(1);
      expect(entries[0].userId).toBe('user-1');
    });

    it('should get log entries by date range', async () => {
      const now = Date.now();
      const yesterday = now - 24 * 60 * 60 * 1000;

      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'test-user',
        timestamp: yesterday
      });

      await logger.createLogEntry({
        type: 'template.created',
        details: { templateId: 'test-template' },
        userId: 'test-user',
        timestamp: now
      });

      const entries = await logger.getLogEntriesByDateRange(yesterday, now);
      expect(entries.length).toBe(2);
    });
  });

  describe('Log Entry Filtering', () => {
    it('should filter log entries by severity', async () => {
      await logger.createLogEntry({
        type: 'system.error',
        details: { error: 'Test error' },
        userId: 'test-user',
        severity: 'error'
      });

      await logger.createLogEntry({
        type: 'system.warning',
        details: { warning: 'Test warning' },
        userId: 'test-user',
        severity: 'warning'
      });

      await logger.createLogEntry({
        type: 'system.info',
        details: { info: 'Test info' },
        userId: 'test-user',
        severity: 'info'
      });

      const errorEntries = await logger.getLogEntriesBySeverity('error');
      const warningEntries = await logger.getLogEntriesBySeverity('warning');
      const infoEntries = await logger.getLogEntriesBySeverity('info');

      expect(errorEntries.length).toBe(1);
      expect(warningEntries.length).toBe(1);
      expect(infoEntries.length).toBe(1);
    });

    it('should filter log entries by multiple criteria', async () => {
      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'user-1',
        severity: 'info'
      });

      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'user-2',
        severity: 'error'
      });

      const entries = await logger.getLogEntries({
        type: 'agent.created',
        severity: 'error',
        userId: 'user-2'
      });

      expect(entries.length).toBe(1);
      expect(entries[0].userId).toBe('user-2');
      expect(entries[0].severity).toBe('error');
    });
  });

  describe('Log Entry Export', () => {
    it('should export log entries to JSON', async () => {
      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'test-user'
      });

      const json = await logger.exportLogEntries('json');
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should export log entries to CSV', async () => {
      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'test-user'
      });

      const csv = await logger.exportLogEntries('csv');
      expect(typeof csv).toBe('string');
      expect(csv).toContain('type,details,userId,timestamp');
    });

    it('should handle export format errors', async () => {
      await expect(logger.exportLogEntries('invalid')).rejects.toThrow();
    });
  });

  describe('Log Entry Cleanup', () => {
    it('should delete old log entries', async () => {
      const oldDate = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago

      await logger.createLogEntry({
        type: 'agent.created',
        details: { agentId: 'test-agent' },
        userId: 'test-user',
        timestamp: oldDate
      });

      await logger.createLogEntry({
        type: 'template.created',
        details: { templateId: 'test-template' },
        userId: 'test-user',
        timestamp: Date.now()
      });

      await logger.cleanupOldLogEntries(7); // Delete entries older than 7 days
      const entries = await logger.getLogEntriesByDateRange(0, Date.now());
      expect(entries.length).toBe(1);
    });

    it('should handle cleanup errors gracefully', async () => {
      await expect(logger.cleanupOldLogEntries(-1)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid log entry creation', async () => {
      await expect(logger.createLogEntry({
        type: '',
        details: {},
        userId: ''
      })).rejects.toThrow();
    });

    it('should handle invalid query parameters', async () => {
      await expect(logger.getLogEntriesByDateRange(-1, 0)).rejects.toThrow();
      await expect(logger.getLogEntriesBySeverity('invalid')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      // Simulate database error by passing invalid parameters
      await expect(logger.getLogEntries({
        type: null,
        severity: null,
        userId: null
      })).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle many log entries', async () => {
      const startTime = Date.now();
      const numEntries = 1000;

      for (let i = 0; i < numEntries; i++) {
        await logger.createLogEntry({
          type: 'test.entry',
          details: { index: i },
          userId: 'test-user'
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain performance with complex queries', async () => {
      // Create entries with various properties
      for (let i = 0; i < 100; i++) {
        await logger.createLogEntry({
          type: `type.${i % 5}`,
          details: { index: i },
          userId: `user-${i % 10}`,
          severity: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warning' : 'info'
        });
      }

      const startTime = Date.now();
      const results = await Promise.all([
        logger.getLogEntriesByType('type.0'),
        logger.getLogEntriesByUser('user-0'),
        logger.getLogEntriesBySeverity('error')
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results.every(r => Array.isArray(r))).toBe(true);
    });
  });
}); 