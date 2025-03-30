import { CircuitBreaker } from '../../services/circuitBreaker';
import { TestUtils } from '../utils/testUtils';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker();
  });

  describe('Circuit State', () => {
    it('should start in closed state', async () => {
      const state = await breaker.getState('test.circuit');
      expect(state).toBe('closed');
    });

    it('should transition to open state on failures', async () => {
      const key = 'test.circuit';
      const threshold = 3;
      const window = 1000;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      const state = await breaker.getState(key);
      expect(state).toBe('open');
    });

    it('should transition to half-open state after timeout', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 100;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      const state = await breaker.getState(key);
      expect(state).toBe('half-open');
    });
  });

  describe('Circuit Configuration', () => {
    it('should handle different thresholds', async () => {
      const key = 'test.circuit';
      const thresholds = [1, 3, 5, 10];
      const window = 1000;

      for (const threshold of thresholds) {
        for (let i = 0; i < threshold; i++) {
          await breaker.recordFailure(key, { threshold, window });
        }

        const state = await breaker.getState(key);
        expect(state).toBe('open');
      }
    });

    it('should handle different windows', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const windows = [100, 500, 1000];

      for (const window of windows) {
        for (let i = 0; i < threshold; i++) {
          await breaker.recordFailure(key, { threshold, window });
        }

        await new Promise(resolve => setTimeout(resolve, window + 50));
        const state = await breaker.getState(key);
        expect(state).toBe('half-open');
      }
    });

    it('should handle zero thresholds', async () => {
      const key = 'test.circuit';
      await expect(breaker.recordFailure(key, { threshold: 0, window: 1000 }))
        .rejects.toThrow();
    });
  });

  describe('Circuit Execution', () => {
    it('should allow execution in closed state', async () => {
      const key = 'test.circuit';
      const result = await breaker.execute(key, async () => 'success');
      expect(result).toBe('success');
    });

    it('should block execution in open state', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 1000;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await expect(breaker.execute(key, async () => 'success'))
        .rejects.toThrow('Circuit breaker is open');
    });

    it('should allow single execution in half-open state', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 100;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      const result = await breaker.execute(key, async () => 'success');
      expect(result).toBe('success');

      await expect(breaker.execute(key, async () => 'success'))
        .rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Circuit Recovery', () => {
    it('should close circuit on successful execution', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 100;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      await breaker.execute(key, async () => 'success');
      const state = await breaker.getState(key);
      expect(state).toBe('closed');
    });

    it('should reopen circuit on failed execution', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 100;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      await expect(breaker.execute(key, async () => {
        throw new Error('Test error');
      })).rejects.toThrow();

      const state = await breaker.getState(key);
      expect(state).toBe('open');
    });

    it('should handle recovery timeouts', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 100;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      await new Promise(resolve => setTimeout(resolve, window + 50));
      const state = await breaker.getState(key);
      expect(state).toBe('open');
    });
  });

  describe('Circuit Statistics', () => {
    it('should track failures', async () => {
      const key = 'test.circuit';
      const threshold = 3;
      const window = 1000;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      const stats = await breaker.getStats(key);
      expect(stats.failures).toBe(threshold);
    });

    it('should track successes', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 100;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      await breaker.execute(key, async () => 'success');

      const stats = await breaker.getStats(key);
      expect(stats.successes).toBe(1);
    });

    it('should track state transitions', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 100;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      await breaker.execute(key, async () => 'success');

      const stats = await breaker.getStats(key);
      expect(stats.transitions).toBeGreaterThan(0);
    });
  });

  describe('Circuit Reset', () => {
    it('should reset circuit state', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 1000;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await breaker.reset(key);
      const state = await breaker.getState(key);
      expect(state).toBe('closed');
    });

    it('should handle reset of non-existent circuits', async () => {
      const key = 'non-existent';
      await expect(breaker.reset(key)).resolves.not.toThrow();
    });

    it('should handle reset of all circuits', async () => {
      const keys = ['circuit1', 'circuit2', 'circuit3'];
      const threshold = 2;
      const window = 1000;

      for (const key of keys) {
        for (let i = 0; i < threshold; i++) {
          await breaker.recordFailure(key, { threshold, window });
        }
      }

      await breaker.resetAll();
      for (const key of keys) {
        const state = await breaker.getState(key);
        expect(state).toBe('closed');
      }
    });
  });

  describe('Circuit Persistence', () => {
    it('should persist circuit state', async () => {
      const key = 'test.circuit';
      const threshold = 2;
      const window = 1000;

      for (let i = 0; i < threshold; i++) {
        await breaker.recordFailure(key, { threshold, window });
      }

      await breaker.persist();

      const newBreaker = new CircuitBreaker();
      await newBreaker.restore();
      const state = await newBreaker.getState(key);
      expect(state).toBe('open');
    });

    it('should handle persistence errors', async () => {
      await expect(breaker.persist()).resolves.not.toThrow();
    });

    it('should handle restoration errors', async () => {
      await expect(breaker.restore()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configurations', async () => {
      const key = 'test.circuit';
      await expect(breaker.recordFailure(key, { threshold: -1, window: 1000 }))
        .rejects.toThrow();
      await expect(breaker.recordFailure(key, { threshold: 1, window: -1 }))
        .rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      const key = 'test.circuit';
      await expect(breaker.recordFailure(key, { threshold: 1, window: 1000 }))
        .resolves.not.toThrow();
    });

    it('should handle concurrent access', async () => {
      const key = 'test.circuit';
      const threshold = 5;
      const window = 1000;

      const failures = Array(threshold).fill(null).map(() =>
        breaker.recordFailure(key, { threshold, window })
      );

      await Promise.all(failures);
      const state = await breaker.getState(key);
      expect(state).toBe('open');
    });
  });

  describe('Performance', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();
      const numCircuits = 100;
      const threshold = 5;
      const window = 1000;

      for (let i = 0; i < numCircuits; i++) {
        for (let j = 0; j < threshold; j++) {
          await breaker.recordFailure(`circuit${i}`, { threshold, window });
        }
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with many circuits', async () => {
      const startTime = Date.now();
      const numCircuits = 1000;
      const threshold = 1;
      const window = 1000;

      const failures = Array(numCircuits).fill(null).map((_, i) =>
        breaker.recordFailure(`circuit${i}`, { threshold, window })
      );

      await Promise.all(failures);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent circuit execution', async () => {
      const startTime = Date.now();
      const key = 'test.circuit';
      const threshold = 5;
      const window = 1000;

      const executions = Array(threshold * 2).fill(null).map(() =>
        breaker.execute(key, async () => 'success')
      );

      const results = await Promise.all(executions);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.filter(r => r === 'success').length).toBe(threshold);
    });
  });
}); 