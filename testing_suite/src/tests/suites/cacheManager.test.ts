import { CacheManager } from '../../services/cacheManager';
import { TestUtils } from '../utils/testUtils';

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager();
  });

  describe('Cache Operations', () => {
    it('should set and get values', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle different value types', async () => {
      const values = {
        string: 'test string',
        number: 42,
        boolean: true,
        object: { test: 'data' },
        array: [1, 2, 3],
        null: null
      };

      for (const [key, value] of Object.entries(values)) {
        await cache.set(key, value);
        const retrieved = await cache.get(key);
        expect(retrieved).toEqual(value);
      }
    });

    it('should handle non-existent keys', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });
  });

  describe('Cache Expiration', () => {
    it('should expire values after TTL', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value, { ttl: 100 });
      const beforeExpiry = await cache.get(key);
      expect(beforeExpiry).toEqual(value);

      await new Promise(resolve => setTimeout(resolve, 150));
      const afterExpiry = await cache.get(key);
      expect(afterExpiry).toBeNull();
    });

    it('should handle different TTL values', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value, { ttl: 1000 });
      const retrieved = await cache.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should handle infinite TTL', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value, { ttl: 0 });
      await new Promise(resolve => setTimeout(resolve, 100));
      const retrieved = await cache.get(key);
      expect(retrieved).toEqual(value);
    });
  });

  describe('Cache Invalidation', () => {
    it('should delete values', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value);
      await cache.delete(key);
      const retrieved = await cache.get(key);
      expect(retrieved).toBeNull();
    });

    it('should clear all values', async () => {
      const values = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      };

      for (const [key, value] of Object.entries(values)) {
        await cache.set(key, value);
      }

      await cache.clear();
      for (const key of Object.keys(values)) {
        const retrieved = await cache.get(key);
        expect(retrieved).toBeNull();
      }
    });

    it('should handle pattern-based deletion', async () => {
      const values = {
        'test.key1': 'value1',
        'test.key2': 'value2',
        'other.key': 'value3'
      };

      for (const [key, value] of Object.entries(values)) {
        await cache.set(key, value);
      }

      await cache.deletePattern('test.*');
      expect(await cache.get('test.key1')).toBeNull();
      expect(await cache.get('test.key2')).toBeNull();
      expect(await cache.get('other.key')).toEqual('value3');
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value);
      await cache.get(key); // Hit
      await cache.get('non-existent'); // Miss
      await cache.get(key); // Hit

      const stats = await cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should track memory usage', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value);
      const stats = await cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track key count', async () => {
      const values = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      };

      for (const [key, value] of Object.entries(values)) {
        await cache.set(key, value);
      }

      const stats = await cache.getStats();
      expect(stats.keyCount).toBe(3);
    });
  });

  describe('Cache Compression', () => {
    it('should compress large values', async () => {
      const key = 'test.key';
      const value = { data: 'x'.repeat(1000) };

      await cache.set(key, value, { compress: true });
      const stats = await cache.getStats();
      expect(stats.compressedSize).toBeLessThan(stats.uncompressedSize);
    });

    it('should handle compression thresholds', async () => {
      const key = 'test.key';
      const smallValue = { data: 'small' };
      const largeValue = { data: 'x'.repeat(1000) };

      await cache.set(key, smallValue, { compress: true });
      const smallStats = await cache.getStats();
      expect(smallStats.compressedSize).toBe(0);

      await cache.set(key, largeValue, { compress: true });
      const largeStats = await cache.getStats();
      expect(largeStats.compressedSize).toBeGreaterThan(0);
    });
  });

  describe('Cache Persistence', () => {
    it('should persist cache to disk', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value);
      await cache.persist();

      const newCache = new CacheManager();
      await newCache.restore();
      const retrieved = await newCache.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should handle persistence errors', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await cache.set(key, value);
      await expect(cache.persist()).resolves.not.toThrow();
    });

    it('should handle restoration errors', async () => {
      await expect(cache.restore()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid keys', async () => {
      await expect(cache.set(null, 'value')).rejects.toThrow();
      await expect(cache.get(null)).rejects.toThrow();
      await expect(cache.delete(null)).rejects.toThrow();
    });

    it('should handle invalid values', async () => {
      const key = 'test.key';
      const circular = { a: 1 };
      circular.b = circular;

      await expect(cache.set(key, circular)).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      const key = 'test.key';
      const value = { test: 'data' };

      await expect(cache.set(key, value)).resolves.not.toThrow();
      await expect(cache.get(key)).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();
      const numOperations = 1000;

      for (let i = 0; i < numOperations; i++) {
        await cache.set(`key${i}`, { value: i });
        await cache.get(`key${i}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with large values', async () => {
      const startTime = Date.now();
      const key = 'test.key';
      const value = { data: 'x'.repeat(10000) };

      await cache.set(key, value);
      await cache.get(key);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations', async () => {
      const startTime = Date.now();
      const numOperations = 100;

      const operations = Array(numOperations).fill(null).map((_, i) => 
        Promise.all([
          cache.set(`key${i}`, { value: i }),
          cache.get(`key${i}`)
        ])
      );

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results.length).toBe(numOperations);
      expect(results.every(([set, get]) => set && get)).toBe(true);
    });
  });
}); 