import { RetryManager } from '../../services/retryManager';
import { TestUtils } from '../utils/testUtils';

describe('RetryManager', () => {
  let retry: RetryManager;

  beforeEach(() => {
    retry = new RetryManager();
  });

  describe('Retry Operations', () => {
    it('should execute with retry on failure', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      };

      const result = await retry.execute(operation, {
        maxAttempts: 3,
        delay: 100
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should handle different error types', async () => {
      const errors = [
        new Error('Test error'),
        new TypeError('Type error'),
        new RangeError('Range error')
      ];

      for (const error of errors) {
        let attempts = 0;
        const operation = async () => {
          attempts++;
          if (attempts < 2) {
            throw error;
          }
          return 'success';
        };

        const result = await retry.execute(operation, {
          maxAttempts: 2,
          delay: 100
        });

        expect(result).toBe('success');
        expect(attempts).toBe(2);
      }
    });

    it('should handle successful first attempt', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return 'success';
      };

      const result = await retry.execute(operation, {
        maxAttempts: 3,
        delay: 100
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });
  });

  describe('Retry Configuration', () => {
    it('should handle different max attempts', async () => {
      const maxAttempts = [1, 2, 3, 5, 10];

      for (const attempts of maxAttempts) {
        let count = 0;
        const operation = async () => {
          count++;
          if (count < attempts) {
            throw new Error('Test error');
          }
          return 'success';
        };

        const result = await retry.execute(operation, {
          maxAttempts: attempts,
          delay: 100
        });

        expect(result).toBe('success');
        expect(count).toBe(attempts);
      }
    });

    it('should handle different delays', async () => {
      const delays = [0, 100, 500, 1000];

      for (const delay of delays) {
        const startTime = Date.now();
        let attempts = 0;
        const operation = async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Test error');
          }
          return 'success';
        };

        const result = await retry.execute(operation, {
          maxAttempts: 2,
          delay
        });

        const duration = Date.now() - startTime;
        expect(result).toBe('success');
        expect(attempts).toBe(2);
        expect(duration).toBeGreaterThanOrEqual(delay);
      }
    });

    it('should handle zero max attempts', async () => {
      const operation = async () => {
        throw new Error('Test error');
      };

      await expect(retry.execute(operation, {
        maxAttempts: 0,
        delay: 100
      })).rejects.toThrow();
    });
  });

  describe('Retry Backoff', () => {
    it('should apply exponential backoff', async () => {
      const startTime = Date.now();
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      };

      const result = await retry.execute(operation, {
        maxAttempts: 3,
        delay: 100,
        backoff: 'exponential'
      });

      const duration = Date.now() - startTime;
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(duration).toBeGreaterThan(300); // 100 + 200 + 400
    });

    it('should apply linear backoff', async () => {
      const startTime = Date.now();
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      };

      const result = await retry.execute(operation, {
        maxAttempts: 3,
        delay: 100,
        backoff: 'linear'
      });

      const duration = Date.now() - startTime;
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(duration).toBeGreaterThan(300); // 100 + 200 + 300
    });

    it('should handle custom backoff function', async () => {
      const startTime = Date.now();
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      };

      const result = await retry.execute(operation, {
        maxAttempts: 3,
        delay: 100,
        backoff: (attempt) => attempt * 50
      });

      const duration = Date.now() - startTime;
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(duration).toBeGreaterThan(150); // 100 + 150 + 200
    });
  });

  describe('Retry Conditions', () => {
    it('should retry on specific errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new TypeError('Type error');
        }
        return 'success';
      };

      const result = await retry.execute(operation, {
        maxAttempts: 2,
        delay: 100,
        retryOn: [TypeError]
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should not retry on non-matching errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new TypeError('Type error');
      };

      await expect(retry.execute(operation, {
        maxAttempts: 2,
        delay: 100,
        retryOn: [RangeError]
      })).rejects.toThrow(TypeError);

      expect(attempts).toBe(1);
    });

    it('should handle custom retry conditions', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Retry me');
        }
        return 'success';
      };

      const result = await retry.execute(operation, {
        maxAttempts: 2,
        delay: 100,
        shouldRetry: (error) => error.message === 'Retry me'
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('Retry Statistics', () => {
    it('should track retry attempts', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Test error');
        }
        return 'success';
      };

      await retry.execute(operation, {
        maxAttempts: 3,
        delay: 100
      });

      const stats = await retry.getStats();
      expect(stats.totalAttempts).toBe(3);
    });

    it('should track successful retries', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Test error');
        }
        return 'success';
      };

      await retry.execute(operation, {
        maxAttempts: 2,
        delay: 100
      });

      const stats = await retry.getStats();
      expect(stats.successfulRetries).toBe(1);
    });

    it('should track failed retries', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Test error');
      };

      await expect(retry.execute(operation, {
        maxAttempts: 3,
        delay: 100
      })).rejects.toThrow();

      const stats = await retry.getStats();
      expect(stats.failedRetries).toBe(1);
    });
  });

  describe('Retry Reset', () => {
    it('should reset retry statistics', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Test error');
        }
        return 'success';
      };

      await retry.execute(operation, {
        maxAttempts: 2,
        delay: 100
      });

      await retry.reset();
      const stats = await retry.getStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulRetries).toBe(0);
      expect(stats.failedRetries).toBe(0);
    });

    it('should handle reset after errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Test error');
      };

      await expect(retry.execute(operation, {
        maxAttempts: 3,
        delay: 100
      })).rejects.toThrow();

      await retry.reset();
      const stats = await retry.getStats();
      expect(stats.totalAttempts).toBe(0);
    });
  });

  describe('Retry Persistence', () => {
    it('should persist retry statistics', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Test error');
        }
        return 'success';
      };

      await retry.execute(operation, {
        maxAttempts: 2,
        delay: 100
      });

      await retry.persist();

      const newRetry = new RetryManager();
      await newRetry.restore();
      const stats = await newRetry.getStats();
      expect(stats.totalAttempts).toBe(2);
      expect(stats.successfulRetries).toBe(1);
    });

    it('should handle persistence errors', async () => {
      await expect(retry.persist()).resolves.not.toThrow();
    });

    it('should handle restoration errors', async () => {
      await expect(retry.restore()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configurations', async () => {
      const operation = async () => 'success';

      await expect(retry.execute(operation, {
        maxAttempts: -1,
        delay: 100
      })).rejects.toThrow();

      await expect(retry.execute(operation, {
        maxAttempts: 1,
        delay: -1
      })).rejects.toThrow();
    });

    it('should handle operation errors', async () => {
      const operation = async () => {
        throw new Error('Operation error');
      };

      await expect(retry.execute(operation, {
        maxAttempts: 3,
        delay: 100
      })).rejects.toThrow('Operation error');
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(3).fill(null).map(() => {
        let attempts = 0;
        return async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Test error');
          }
          return 'success';
        };
      });

      const results = await Promise.all(operations.map(operation =>
        retry.execute(operation, {
          maxAttempts: 2,
          delay: 100
        })
      ));

      expect(results).toEqual(['success', 'success', 'success']);
    });
  });

  describe('Performance', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();
      const numOperations = 100;
      const maxAttempts = 2;
      const delay = 100;

      for (let i = 0; i < numOperations; i++) {
        let attempts = 0;
        const operation = async () => {
          attempts++;
          if (attempts < maxAttempts) {
            throw new Error('Test error');
          }
          return 'success';
        };

        await retry.execute(operation, { maxAttempts, delay });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with many retries', async () => {
      const startTime = Date.now();
      const numOperations = 1000;
      const maxAttempts = 3;
      const delay = 100;

      const operations = Array(numOperations).fill(null).map(() => {
        let attempts = 0;
        return async () => {
          attempts++;
          if (attempts < maxAttempts) {
            throw new Error('Test error');
          }
          return 'success';
        };
      });

      const results = await Promise.all(operations.map(operation =>
        retry.execute(operation, { maxAttempts, delay })
      ));

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results.every(r => r === 'success')).toBe(true);
    });

    it('should handle concurrent retry operations', async () => {
      const startTime = Date.now();
      const numOperations = 100;
      const maxAttempts = 2;
      const delay = 100;

      const operations = Array(numOperations).fill(null).map(() => {
        let attempts = 0;
        return async () => {
          attempts++;
          if (attempts < maxAttempts) {
            throw new Error('Test error');
          }
          return 'success';
        };
      });

      const results = await Promise.all(operations.map(operation =>
        retry.execute(operation, { maxAttempts, delay })
      ));

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.every(r => r === 'success')).toBe(true);
    });
  });
}); 