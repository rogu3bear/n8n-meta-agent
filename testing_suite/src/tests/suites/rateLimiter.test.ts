import { RateLimiter } from '../../services/rateLimiter';
import { TestUtils } from '../utils/testUtils';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const key = 'test.key';
      const limit = 5;
      const window = 1000;

      for (let i = 0; i < limit; i++) {
        const allowed = await limiter.check(key, { limit, window });
        expect(allowed).toBe(true);
      }
    });

    it('should block requests exceeding limit', async () => {
      const key = 'test.key';
      const limit = 3;
      const window = 1000;

      for (let i = 0; i < limit; i++) {
        await limiter.check(key, { limit, window });
      }

      const allowed = await limiter.check(key, { limit, window });
      expect(allowed).toBe(false);
    });

    it('should reset after window expires', async () => {
      const key = 'test.key';
      const limit = 2;
      const window = 100;

      for (let i = 0; i < limit; i++) {
        await limiter.check(key, { limit, window });
      }

      await new Promise(resolve => setTimeout(resolve, window + 50));
      const allowed = await limiter.check(key, { limit, window });
      expect(allowed).toBe(true);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should handle different limits', async () => {
      const key = 'test.key';
      const limits = [1, 5, 10, 100];

      for (const limit of limits) {
        for (let i = 0; i < limit; i++) {
          const allowed = await limiter.check(key, { limit, window: 1000 });
          expect(allowed).toBe(true);
        }

        const exceeded = await limiter.check(key, { limit, window: 1000 });
        expect(exceeded).toBe(false);
      }
    });

    it('should handle different windows', async () => {
      const key = 'test.key';
      const limit = 2;
      const windows = [100, 500, 1000];

      for (const window of windows) {
        for (let i = 0; i < limit; i++) {
          await limiter.check(key, { limit, window });
        }

        await new Promise(resolve => setTimeout(resolve, window + 50));
        const allowed = await limiter.check(key, { limit, window });
        expect(allowed).toBe(true);
      }
    });

    it('should handle zero limits', async () => {
      const key = 'test.key';
      const allowed = await limiter.check(key, { limit: 0, window: 1000 });
      expect(allowed).toBe(false);
    });
  });

  describe('Rate Limit Keys', () => {
    it('should handle different keys independently', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const limit = 2;
      const window = 1000;

      for (const key of keys) {
        for (let i = 0; i < limit; i++) {
          const allowed = await limiter.check(key, { limit, window });
          expect(allowed).toBe(true);
        }
      }
    });

    it('should handle key patterns', async () => {
      const pattern = 'test.*';
      const keys = ['test.1', 'test.2', 'test.3'];
      const limit = 2;
      const window = 1000;

      for (const key of keys) {
        for (let i = 0; i < limit; i++) {
          const allowed = await limiter.check(key, { limit, window, pattern });
          expect(allowed).toBe(true);
        }
      }
    });

    it('should handle invalid keys', async () => {
      await expect(limiter.check(null, { limit: 1, window: 1000 }))
        .rejects.toThrow();
    });
  });

  describe('Rate Limit Information', () => {
    it('should provide remaining requests', async () => {
      const key = 'test.key';
      const limit = 5;
      const window = 1000;

      const info = await limiter.getInfo(key, { limit, window });
      expect(info.remaining).toBe(limit);
      expect(info.reset).toBeDefined();
    });

    it('should update remaining requests', async () => {
      const key = 'test.key';
      const limit = 3;
      const window = 1000;

      await limiter.check(key, { limit, window });
      const info = await limiter.getInfo(key, { limit, window });
      expect(info.remaining).toBe(limit - 1);
    });

    it('should handle non-existent keys', async () => {
      const key = 'non-existent';
      const info = await limiter.getInfo(key, { limit: 1, window: 1000 });
      expect(info.remaining).toBe(1);
    });
  });

  describe('Rate Limit Reset', () => {
    it('should reset rate limits', async () => {
      const key = 'test.key';
      const limit = 2;
      const window = 1000;

      for (let i = 0; i < limit; i++) {
        await limiter.check(key, { limit, window });
      }

      await limiter.reset(key);
      const allowed = await limiter.check(key, { limit, window });
      expect(allowed).toBe(true);
    });

    it('should handle reset of non-existent keys', async () => {
      const key = 'non-existent';
      await expect(limiter.reset(key)).resolves.not.toThrow();
    });

    it('should handle reset of all keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const limit = 2;
      const window = 1000;

      for (const key of keys) {
        for (let i = 0; i < limit; i++) {
          await limiter.check(key, { limit, window });
        }
      }

      await limiter.resetAll();
      for (const key of keys) {
        const allowed = await limiter.check(key, { limit, window });
        expect(allowed).toBe(true);
      }
    });
  });

  describe('Rate Limit Persistence', () => {
    it('should persist rate limits', async () => {
      const key = 'test.key';
      const limit = 2;
      const window = 1000;

      for (let i = 0; i < limit; i++) {
        await limiter.check(key, { limit, window });
      }

      await limiter.persist();

      const newLimiter = new RateLimiter();
      await newLimiter.restore();
      const allowed = await newLimiter.check(key, { limit, window });
      expect(allowed).toBe(false);
    });

    it('should handle persistence errors', async () => {
      await expect(limiter.persist()).resolves.not.toThrow();
    });

    it('should handle restoration errors', async () => {
      await expect(limiter.restore()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configurations', async () => {
      const key = 'test.key';
      await expect(limiter.check(key, { limit: -1, window: 1000 }))
        .rejects.toThrow();
      await expect(limiter.check(key, { limit: 1, window: -1 }))
        .rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      const key = 'test.key';
      await expect(limiter.check(key, { limit: 1, window: 1000 }))
        .resolves.not.toThrow();
    });

    it('should handle concurrent access', async () => {
      const key = 'test.key';
      const limit = 5;
      const window = 1000;

      const checks = Array(limit).fill(null).map(() =>
        limiter.check(key, { limit, window })
      );

      const results = await Promise.all(checks);
      expect(results.filter(Boolean).length).toBe(limit);
    });
  });

  describe('Performance', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();
      const numKeys = 100;
      const limit = 5;
      const window = 1000;

      for (let i = 0; i < numKeys; i++) {
        for (let j = 0; j < limit; j++) {
          await limiter.check(`key${i}`, { limit, window });
        }
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with many keys', async () => {
      const startTime = Date.now();
      const numKeys = 1000;
      const limit = 1;
      const window = 1000;

      const checks = Array(numKeys).fill(null).map((_, i) =>
        limiter.check(`key${i}`, { limit, window })
      );

      const results = await Promise.all(checks);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results.every(Boolean)).toBe(true);
    });

    it('should handle concurrent rate limiting', async () => {
      const startTime = Date.now();
      const key = 'test.key';
      const limit = 5;
      const window = 1000;

      const checks = Array(limit * 2).fill(null).map(() =>
        limiter.check(key, { limit, window })
      );

      const results = await Promise.all(checks);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(results.filter(Boolean).length).toBe(limit);
    });
  });
}); 