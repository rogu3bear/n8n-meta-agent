import { ConfigManager } from '../../services/configManager';
import { TestUtils } from '../utils/testUtils';

describe('ConfigManager', () => {
  let manager: ConfigManager;

  beforeEach(() => {
    manager = new ConfigManager();
  });

  describe('Configuration Management', () => {
    it('should load configuration', async () => {
      const config = await manager.loadConfig();
      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.environment).toBeDefined();
    });

    it('should update configuration', async () => {
      const updates = {
        apiUrl: 'https://api.example.com',
        timeout: 5000
      };

      await manager.updateConfig(updates);
      const config = await manager.loadConfig();

      expect(config.apiUrl).toBe(updates.apiUrl);
      expect(config.timeout).toBe(updates.timeout);
    });

    it('should validate configuration', async () => {
      const invalidConfig = {
        apiUrl: 'invalid-url',
        timeout: -1
      };

      await expect(manager.validateConfig(invalidConfig)).rejects.toThrow();
    });
  });

  describe('Environment Management', () => {
    it('should get environment variables', async () => {
      const env = await manager.getEnvironment();
      expect(env).toBeDefined();
      expect(env.NODE_ENV).toBeDefined();
    });

    it('should set environment variables', async () => {
      const vars = {
        TEST_VAR: 'test-value',
        API_KEY: 'test-key'
      };

      await manager.setEnvironment(vars);
      const env = await manager.getEnvironment();

      expect(env.TEST_VAR).toBe(vars.TEST_VAR);
      expect(env.API_KEY).toBe(vars.API_KEY);
    });

    it('should handle environment validation', async () => {
      const invalidVars = {
        API_KEY: '' // Empty API key
      };

      await expect(manager.validateEnvironment(invalidVars)).rejects.toThrow();
    });
  });

  describe('Feature Flags', () => {
    it('should get feature flags', async () => {
      const flags = await manager.getFeatureFlags();
      expect(flags).toBeDefined();
      expect(typeof flags).toBe('object');
    });

    it('should update feature flags', async () => {
      const updates = {
        enableNewUI: true,
        betaFeatures: false
      };

      await manager.updateFeatureFlags(updates);
      const flags = await manager.getFeatureFlags();

      expect(flags.enableNewUI).toBe(true);
      expect(flags.betaFeatures).toBe(false);
    });

    it('should check feature availability', async () => {
      await manager.updateFeatureFlags({
        enableNewUI: true
      });

      const isEnabled = await manager.isFeatureEnabled('enableNewUI');
      expect(isEnabled).toBe(true);
    });
  });

  describe('Secret Management', () => {
    it('should store secrets', async () => {
      const secrets = {
        apiKey: 'test-api-key',
        dbPassword: 'test-db-password'
      };

      await manager.storeSecrets(secrets);
      const stored = await manager.getSecrets();

      expect(stored.apiKey).toBeDefined();
      expect(stored.dbPassword).toBeDefined();
      expect(stored.apiKey).not.toBe(secrets.apiKey); // Should be encrypted
    });

    it('should retrieve specific secrets', async () => {
      const secrets = {
        apiKey: 'test-api-key',
        dbPassword: 'test-db-password'
      };

      await manager.storeSecrets(secrets);
      const apiKey = await manager.getSecret('apiKey');

      expect(apiKey).toBeDefined();
      expect(apiKey).not.toBe(secrets.apiKey); // Should be decrypted
    });

    it('should handle secret rotation', async () => {
      const secrets = {
        apiKey: 'old-api-key'
      };

      await manager.storeSecrets(secrets);
      await manager.rotateSecret('apiKey');
      const newSecret = await manager.getSecret('apiKey');

      expect(newSecret).not.toBe(secrets.apiKey);
    });
  });

  describe('Configuration Profiles', () => {
    it('should create configuration profiles', async () => {
      const profile = await manager.createProfile({
        name: 'test-profile',
        config: {
          apiUrl: 'https://test.example.com',
          timeout: 3000
        }
      });

      expect(profile).toBeDefined();
      expect(profile.name).toBe('test-profile');
      expect(profile.config).toBeDefined();
    });

    it('should switch between profiles', async () => {
      const profile1 = await manager.createProfile({
        name: 'profile1',
        config: { apiUrl: 'https://1.example.com' }
      });

      const profile2 = await manager.createProfile({
        name: 'profile2',
        config: { apiUrl: 'https://2.example.com' }
      });

      await manager.switchProfile(profile1.id);
      let config = await manager.loadConfig();
      expect(config.apiUrl).toBe(profile1.config.apiUrl);

      await manager.switchProfile(profile2.id);
      config = await manager.loadConfig();
      expect(config.apiUrl).toBe(profile2.config.apiUrl);
    });

    it('should handle profile inheritance', async () => {
      const baseProfile = await manager.createProfile({
        name: 'base',
        config: { timeout: 5000 }
      });

      const childProfile = await manager.createProfile({
        name: 'child',
        parentId: baseProfile.id,
        config: { apiUrl: 'https://child.example.com' }
      });

      await manager.switchProfile(childProfile.id);
      const config = await manager.loadConfig();

      expect(config.timeout).toBe(baseProfile.config.timeout);
      expect(config.apiUrl).toBe(childProfile.config.apiUrl);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required fields', async () => {
      const invalidConfig = {
        apiUrl: undefined,
        timeout: 5000
      };

      await expect(manager.validateConfig(invalidConfig)).rejects.toThrow();
    });

    it('should validate field types', async () => {
      const invalidConfig = {
        apiUrl: 'https://example.com',
        timeout: 'invalid' // Should be number
      };

      await expect(manager.validateConfig(invalidConfig)).rejects.toThrow();
    });

    it('should validate field constraints', async () => {
      const invalidConfig = {
        apiUrl: 'https://example.com',
        timeout: -1 // Should be positive
      };

      await expect(manager.validateConfig(invalidConfig)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration updates', async () => {
      const invalidUpdates = {
        timeout: -1
      };

      await expect(manager.updateConfig(invalidUpdates)).rejects.toThrow();
    });

    it('should handle invalid secret operations', async () => {
      await expect(manager.getSecret('non-existent')).rejects.toThrow();
      await expect(manager.rotateSecret('non-existent')).rejects.toThrow();
    });

    it('should handle profile errors', async () => {
      await expect(manager.switchProfile('non-existent')).rejects.toThrow();
      await expect(manager.createProfile({
        name: '',
        config: {}
      })).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large configurations', async () => {
      const startTime = Date.now();
      const largeConfig = {
        ...Array(1000).fill(null).reduce((acc, _, i) => ({
          ...acc,
          [`key${i}`]: `value${i}`
        }), {})
      };

      await manager.updateConfig(largeConfig);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with many profiles', async () => {
      const startTime = Date.now();
      const numProfiles = 100;

      for (let i = 0; i < numProfiles; i++) {
        await manager.createProfile({
          name: `profile-${i}`,
          config: { test: `value-${i}` }
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent configuration updates', async () => {
      const startTime = Date.now();
      const numUpdates = 10;

      const updates = Array(numUpdates).fill(null).map((_, i) => 
        manager.updateConfig({
          test: `value-${i}`
        })
      );

      const results = await Promise.all(updates);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.length).toBe(numUpdates);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
}); 