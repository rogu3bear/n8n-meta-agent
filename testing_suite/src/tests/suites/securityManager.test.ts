import { SecurityManager } from '../../services/securityManager';
import { TestUtils } from '../utils/testUtils';

describe('SecurityManager', () => {
  let manager: SecurityManager;

  beforeEach(() => {
    manager = new SecurityManager();
  });

  describe('Authentication', () => {
    it('should authenticate a user with valid credentials', async () => {
      const credentials = TestUtils.createMockUserCredentials();
      const result = await manager.authenticate(credentials);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const invalidCredentials = {
        username: 'invalid',
        password: 'invalid'
      };

      const result = await manager.authenticate(invalidCredentials);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle authentication rate limiting', async () => {
      const credentials = TestUtils.createMockUserCredentials();
      const attempts = 5;

      for (let i = 0; i < attempts; i++) {
        await manager.authenticate({
          username: credentials.username,
          password: 'wrong-password'
        });
      }

      const result = await manager.authenticate(credentials);
      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });
  });

  describe('Authorization', () => {
    it('should check user permissions', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password',
        roles: ['admin']
      });

      const hasPermission = await manager.checkPermission(user.id, 'admin');
      expect(hasPermission).toBe(true);
    });

    it('should handle role-based access control', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password',
        roles: ['user']
      });

      const hasAdminPermission = await manager.checkPermission(user.id, 'admin');
      const hasUserPermission = await manager.checkPermission(user.id, 'user');

      expect(hasAdminPermission).toBe(false);
      expect(hasUserPermission).toBe(true);
    });

    it('should validate resource access', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password',
        roles: ['user']
      });

      const resource = await manager.createResource({
        type: 'agent',
        ownerId: user.id
      });

      const hasAccess = await manager.checkResourceAccess(user.id, resource.id);
      expect(hasAccess).toBe(true);
    });
  });

  describe('Token Management', () => {
    it('should create and validate tokens', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const token = await manager.createToken(user.id);
      const isValid = await manager.validateToken(token);

      expect(isValid).toBe(true);
    });

    it('should handle token expiration', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const token = await manager.createToken(user.id, 1); // 1 second expiration
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isValid = await manager.validateToken(token);

      expect(isValid).toBe(false);
    });

    it('should revoke tokens', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const token = await manager.createToken(user.id);
      await manager.revokeToken(token);
      const isValid = await manager.validateToken(token);

      expect(isValid).toBe(false);
    });
  });

  describe('Password Management', () => {
    it('should hash passwords securely', async () => {
      const password = 'test-password';
      const hashedPassword = await manager.hashPassword(password);

      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/);
    });

    it('should validate password strength', async () => {
      const weakPassword = 'weak';
      const strongPassword = 'StrongP@ssw0rd123';

      await expect(manager.validatePasswordStrength(weakPassword)).rejects.toThrow();
      await expect(manager.validatePasswordStrength(strongPassword)).resolves.not.toThrow();
    });

    it('should handle password reset', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const resetToken = await manager.generatePasswordResetToken(user.id);
      await manager.resetPassword(resetToken, 'new-password');

      const result = await manager.authenticate({
        username: user.username,
        password: 'new-password'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should create and manage sessions', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const session = await manager.createSession(user.id);
      const isValid = await manager.validateSession(session.id);

      expect(isValid).toBe(true);
    });

    it('should handle session timeout', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const session = await manager.createSession(user.id, 1); // 1 second timeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isValid = await manager.validateSession(session.id);

      expect(isValid).toBe(false);
    });

    it('should terminate sessions', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const session = await manager.createSession(user.id);
      await manager.terminateSession(session.id);
      const isValid = await manager.validateSession(session.id);

      expect(isValid).toBe(false);
    });
  });

  describe('Security Policies', () => {
    it('should enforce password policies', async () => {
      const policies = {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      };

      await manager.setPasswordPolicies(policies);
      const currentPolicies = await manager.getPasswordPolicies();

      expect(currentPolicies).toEqual(policies);
    });

    it('should enforce session policies', async () => {
      const policies = {
        maxSessionsPerUser: 3,
        sessionTimeout: 3600,
        requireReauth: true
      };

      await manager.setSessionPolicies(policies);
      const currentPolicies = await manager.getSessionPolicies();

      expect(currentPolicies).toEqual(policies);
    });

    it('should enforce access control policies', async () => {
      const policies = {
        maxLoginAttempts: 5,
        lockoutDuration: 300,
        requireMfa: true
      };

      await manager.setAccessControlPolicies(policies);
      const currentPolicies = await manager.getAccessControlPolicies();

      expect(currentPolicies).toEqual(policies);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const result = await manager.authenticate({
        username: '',
        password: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle authorization errors', async () => {
      const hasPermission = await manager.checkPermission('invalid-user', 'admin');
      expect(hasPermission).toBe(false);
    });

    it('should handle token validation errors', async () => {
      const isValid = await manager.validateToken('invalid-token');
      expect(isValid).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle many concurrent authentications', async () => {
      const credentials = TestUtils.createMockUserCredentials();
      const numAttempts = 10;

      const startTime = Date.now();
      const results = await Promise.all(
        Array(numAttempts).fill(null).map(() => 
          manager.authenticate(credentials)
        )
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should maintain performance with many sessions', async () => {
      const user = await manager.createUser({
        username: 'test-user',
        password: 'test-password'
      });

      const startTime = Date.now();
      const numSessions = 100;

      for (let i = 0; i < numSessions; i++) {
        await manager.createSession(user.id);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
}); 