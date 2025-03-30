import { app } from 'electron';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Agent } from '../types/agent';
import { StateManager } from './stateManager';

interface AccessControlEntry {
  id: string;
  resourceId: string;
  resourceType: 'agent' | 'template' | 'workflow';
  userId: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resourceId: string;
  resourceType: string;
  details: any;
  ipAddress?: string;
}

export interface UserCredentials {
  username: string;
  passwordHash: string;
  salt: string;
  roles: string[];
  apiKeys: ApiKey[];
  lastLogin?: Date;
  failedLoginAttempts: number;
  disabled: boolean;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  permissions: string[];
}

export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
  iterations?: number;
}

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export class SecurityManager {
  private users: Map<string, UserCredentials> = new Map();
  private roles: Map<string, Role> = new Map();
  private encryptionKey: Buffer;
  private algorithm: string;
  private ivLength: number;
  private stateManager: StateManager;
  private readonly TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
  private tokens: Map<string, { userId: string, expires: Date }> = new Map();
  private accessControl: Map<string, AccessControlEntry[]>;
  private auditLogs: AuditLogEntry[];
  private secureStoragePath: string;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly SALT_LENGTH = 64;
  private readonly TAG_LENGTH = 16;

  constructor(stateManager: StateManager, encryptionOptions?: EncryptionOptions, secureStoragePath?: string) {
    this.stateManager = stateManager;
    this.algorithm = encryptionOptions?.algorithm || 'aes-256-cbc';
    this.ivLength = encryptionOptions?.ivLength || 16;
    
    // Initialize with a random key for the session
    // In a real app, this would be loaded from a secure storage
    this.encryptionKey = crypto.randomBytes(encryptionOptions?.keyLength || 32);
    
    // Initialize built-in roles
    this.initializeRoles();

    this.accessControl = new Map();
    this.auditLogs = [];
    this.secureStoragePath = secureStoragePath || app.getPath('userData') + '/secure';
  }

  /**
   * Initializes default roles and permissions
   */
  private initializeRoles(): void {
    // Admin role
    this.roles.set('admin', {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: [
        { resource: '*', action: 'create' },
        { resource: '*', action: 'read' },
        { resource: '*', action: 'update' },
        { resource: '*', action: 'delete' },
        { resource: '*', action: 'execute' }
      ]
    });

    // Read-only role
    this.roles.set('viewer', {
      id: 'viewer',
      name: 'Viewer',
      description: 'Read-only access',
      permissions: [
        { resource: '*', action: 'read' }
      ]
    });

    // Agent operator role
    this.roles.set('operator', {
      id: 'operator',
      name: 'Agent Operator',
      description: 'Can manage and execute agents',
      permissions: [
        { resource: 'agent', action: 'read' },
        { resource: 'agent', action: 'update' },
        { resource: 'agent', action: 'execute' },
        { resource: 'workflow', action: 'read' },
        { resource: 'task', action: 'read' },
        { resource: 'task', action: 'create' }
      ]
    });
  }

  /**
   * Creates a new user
   * @param username Username
   * @param password Password in plain text
   * @param roles User roles
   * @returns Success indicator
   */
  public async createUser(username: string, password: string, roles: string[] = ['viewer']): Promise<boolean> {
    if (this.users.has(username)) {
      throw new Error(`User ${username} already exists`);
    }

    // Validate roles exist
    for (const role of roles) {
      if (!this.roles.has(role)) {
        throw new Error(`Role ${role} does not exist`);
      }
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await this.hashPassword(password, salt);

    const user: UserCredentials = {
      username,
      passwordHash,
      salt,
      roles,
      apiKeys: [],
      failedLoginAttempts: 0,
      disabled: false
    };

    this.users.set(username, user);
    return true;
  }

  /**
   * Authenticate a user
   * @param username Username
   * @param password Password
   * @returns Authentication token or null if failed
   */
  public async authenticateUser(username: string, password: string): Promise<string | null> {
    const user = this.users.get(username);
    
    if (!user || user.disabled) {
      return null;
    }

    const passwordHash = await this.hashPassword(password, user.salt);
    
    if (passwordHash !== user.passwordHash) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;
      
      // Disable account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.disabled = true;
      }
      
      return null;
    }

    // Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.lastLogin = new Date();

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + this.TOKEN_EXPIRY_MS);
    
    this.tokens.set(token, { userId: username, expires });
    
    return token;
  }

  /**
   * Verify if a token is valid
   * @param token Authentication token
   * @returns Username if valid, null otherwise
   */
  public verifyToken(token: string): string | null {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      return null;
    }
    
    if (tokenData.expires < new Date()) {
      this.tokens.delete(token);
      return null;
    }
    
    return tokenData.userId;
  }

  /**
   * Create an API key for a user
   * @param username Username
   * @param keyName Friendly name for the key
   * @param permissions Specific permissions for this key
   * @param expiresInDays Days until key expiration (0 = no expiration)
   * @returns API key
   */
  public createApiKey(
    username: string, 
    keyName: string, 
    permissions: string[] = [], 
    expiresInDays: number = 0
  ): ApiKey | null {
    const user = this.users.get(username);
    
    if (!user) {
      return null;
    }
    
    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      key: crypto.randomBytes(32).toString('hex'),
      name: keyName,
      createdAt: new Date(),
      permissions,
      lastUsed: undefined
    };
    
    if (expiresInDays > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiresInDays);
      apiKey.expiresAt = expiryDate;
    }
    
    user.apiKeys.push(apiKey);
    return apiKey;
  }

  /**
   * Authenticate using an API key
   * @param apiKey API key
   * @returns Username if valid, null otherwise
   */
  public authenticateApiKey(apiKey: string): string | null {
    for (const [username, user] of this.users.entries()) {
      const matchingKey = user.apiKeys.find(k => k.key === apiKey);
      
      if (matchingKey) {
        // Check if key is expired
        if (matchingKey.expiresAt && matchingKey.expiresAt < new Date()) {
          return null;
        }
        
        // Update last used timestamp
        matchingKey.lastUsed = new Date();
        return username;
      }
    }
    
    return null;
  }

  /**
   * Check if user has permission to perform an action
   * @param username Username
   * @param resource Resource type
   * @param action Action to perform
   * @param conditions Optional conditions
   * @returns Whether the user has permission
   */
  public hasPermission(
    username: string, 
    resource: string, 
    action: 'create' | 'read' | 'update' | 'delete' | 'execute',
    conditions?: Record<string, any>
  ): boolean {
    const user = this.users.get(username);
    
    if (!user || user.disabled) {
      return false;
    }
    
    // Check if user has any role with the required permission
    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      
      if (!role) continue;
      
      // Check if role has the specific permission
      for (const permission of role.permissions) {
        // Wildcard resource match
        if (permission.resource === '*' && permission.action === action) {
          return true;
        }
        
        // Specific resource match
        if (permission.resource === resource && permission.action === action) {
          // If no conditions, permission is granted
          if (!permission.conditions || !conditions) {
            return true;
          }
          
          // Check if all conditions match
          let conditionsMatch = true;
          for (const [key, value] of Object.entries(permission.conditions)) {
            if (conditions[key] !== value) {
              conditionsMatch = false;
              break;
            }
          }
          
          if (conditionsMatch) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Encrypt sensitive data
   * @param data Data to encrypt
   * @returns Encrypted data
   */
  public encrypt(data: string): { encrypted: string, iv: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt encrypted data
   * @param encrypted Encrypted data
   * @param iv Initialization vector
   * @returns Decrypted data
   */
  public decrypt(encrypted: string, iv: string): string {
    const ivBuffer = Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, ivBuffer);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hash a password with the given salt
   * @param password Password
   * @param salt Salt
   * @returns Hashed password
   */
  private async hashPassword(password: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Create a role
   * @param id Role ID
   * @param name Role name
   * @param description Role description
   * @param permissions Role permissions
   * @returns Success indicator
   */
  public createRole(
    id: string, 
    name: string, 
    description: string, 
    permissions: Permission[]
  ): boolean {
    if (this.roles.has(id)) {
      throw new Error(`Role ${id} already exists`);
    }
    
    this.roles.set(id, { id, name, description, permissions });
    return true;
  }

  /**
   * Encrypt sensitive fields in an agent's configuration
   * @param agent Agent to secure
   * @returns Agent with encrypted sensitive data
   */
  public secureAgent(agent: Agent): Agent {
    // Create a deep copy of the agent to avoid modifying the original
    const securedAgent = JSON.parse(JSON.stringify(agent)) as Agent;
    const sensitiveFields: string[] = [];
    
    // Get sensitive parameter names from configuration
    if (securedAgent.parameters) {
      for (const [key, value] of Object.entries(securedAgent.parameters)) {
        if (typeof value === 'string' && (
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('secret')
        )) {
          sensitiveFields.push(key);
        }
      }
    }
    
    // Encrypt sensitive fields
    for (const field of sensitiveFields) {
      if (securedAgent.parameters[field]) {
        const value = securedAgent.parameters[field] as string;
        const { encrypted, iv } = this.encrypt(value);
        securedAgent.parameters[field] = `encrypted:${encrypted}:${iv}`;
      }
    }
    
    return securedAgent;
  }

  /**
   * Decrypt sensitive fields in an agent's configuration
   * @param agent Agent with encrypted data
   * @returns Agent with decrypted sensitive data
   */
  public decryptAgent(agent: Agent): Agent {
    // Create a deep copy of the agent to avoid modifying the original
    const decryptedAgent = JSON.parse(JSON.stringify(agent)) as Agent;
    
    // Decrypt any encrypted fields
    if (decryptedAgent.parameters) {
      for (const [key, value] of Object.entries(decryptedAgent.parameters)) {
        if (typeof value === 'string' && value.startsWith('encrypted:')) {
          const parts = value.split(':');
          if (parts.length === 3) {
            const encrypted = parts[1];
            const iv = parts[2];
            
            try {
              decryptedAgent.parameters[key] = this.decrypt(encrypted, iv);
            } catch (error) {
              console.error(`Failed to decrypt parameter ${key}:`, error);
              // Leave as is if decryption fails
            }
          }
        }
      }
    }
    
    return decryptedAgent;
  }

  /**
   * Add user to a role
   * @param username Username
   * @param roleName Role name
   * @returns Success indicator
   */
  public addUserToRole(username: string, roleName: string): boolean {
    const user = this.users.get(username);
    
    if (!user) {
      throw new Error(`User ${username} not found`);
    }
    
    if (!this.roles.has(roleName)) {
      throw new Error(`Role ${roleName} not found`);
    }
    
    if (!user.roles.includes(roleName)) {
      user.roles.push(roleName);
    }
    
    return true;
  }

  /**
   * Remove user from a role
   * @param username Username
   * @param roleName Role name
   * @returns Success indicator
   */
  public removeUserFromRole(username: string, roleName: string): boolean {
    const user = this.users.get(username);
    
    if (!user) {
      throw new Error(`User ${username} not found`);
    }
    
    user.roles = user.roles.filter(r => r !== roleName);
    return true;
  }

  /**
   * Change user password
   * @param username Username
   * @param currentPassword Current password
   * @param newPassword New password
   * @returns Success indicator
   */
  public async changePassword(
    username: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<boolean> {
    const user = this.users.get(username);
    
    if (!user) {
      throw new Error(`User ${username} not found`);
    }
    
    const currentHash = await this.hashPassword(currentPassword, user.salt);
    
    if (currentHash !== user.passwordHash) {
      return false;
    }
    
    // Generate new salt and hash for better security
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = await this.hashPassword(newPassword, newSalt);
    
    user.salt = newSalt;
    user.passwordHash = newHash;
    
    return true;
  }

  /**
   * Reset a user's password
   * @param username Username
   * @param newPassword New password
   * @param adminToken Administrator token (required for authorization)
   * @returns Success indicator
   */
  public async resetPassword(
    username: string, 
    newPassword: string, 
    adminToken: string
  ): Promise<boolean> {
    // Verify admin token
    const adminUsername = this.verifyToken(adminToken);
    
    if (!adminUsername) {
      throw new Error('Invalid admin token');
    }
    
    // Check if the user has admin privileges
    if (!this.hasPermission(adminUsername, 'user', 'update')) {
      throw new Error('Not authorized to reset passwords');
    }
    
    const user = this.users.get(username);
    
    if (!user) {
      throw new Error(`User ${username} not found`);
    }
    
    // Generate new salt and hash
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = await this.hashPassword(newPassword, newSalt);
    
    user.salt = newSalt;
    user.passwordHash = newHash;
    user.failedLoginAttempts = 0;
    user.disabled = false;
    
    return true;
  }

  /**
   * Revoke an API key
   * @param username Username
   * @param keyId API key ID
   * @returns Success indicator
   */
  public revokeApiKey(username: string, keyId: string): boolean {
    const user = this.users.get(username);
    
    if (!user) {
      throw new Error(`User ${username} not found`);
    }
    
    const keyIndex = user.apiKeys.findIndex(k => k.id === keyId);
    
    if (keyIndex === -1) {
      throw new Error(`API key ${keyId} not found`);
    }
    
    user.apiKeys.splice(keyIndex, 1);
    return true;
  }

  /**
   * Logout a user (invalidate token)
   * @param token Authentication token
   * @returns Success indicator
   */
  public logout(token: string): boolean {
    return this.tokens.delete(token);
  }

  // Access Control

  public async checkAccess(
    userId: string,
    resourceId: string,
    resourceType: 'agent' | 'template' | 'workflow',
    requiredPermission: string
  ): Promise<boolean> {
    const entries = this.accessControl.get(resourceId) || [];
    const userEntry = entries.find(entry => entry.userId === userId);

    if (!userEntry) {
      return false;
    }

    return userEntry.permissions.includes(requiredPermission);
  }

  public async grantAccess(
    resourceId: string,
    resourceType: 'agent' | 'template' | 'workflow',
    userId: string,
    permissions: string[]
  ): Promise<void> {
    const entries = this.accessControl.get(resourceId) || [];
    const existingEntry = entries.find(entry => entry.userId === userId);

    if (existingEntry) {
      existingEntry.permissions = [...new Set([...existingEntry.permissions, ...permissions])];
      existingEntry.updatedAt = new Date();
    } else {
      entries.push({
        id: uuidv4(),
        resourceId,
        resourceType,
        userId,
        permissions,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    this.accessControl.set(resourceId, entries);
    await this.saveAccessControl();
  }

  public async revokeAccess(
    resourceId: string,
    userId: string,
    permissions: string[]
  ): Promise<void> {
    const entries = this.accessControl.get(resourceId) || [];
    const entry = entries.find(e => e.userId === userId);

    if (entry) {
      entry.permissions = entry.permissions.filter(p => !permissions.includes(p));
      entry.updatedAt = new Date();
      await this.saveAccessControl();
    }
  }

  // Audit Logging

  public async logAudit(
    userId: string,
    action: string,
    resourceId: string,
    resourceType: string,
    details: any,
    ipAddress?: string
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      userId,
      action,
      resourceId,
      resourceType,
      details,
      ipAddress
    };

    this.auditLogs.push(logEntry);
    await this.saveAuditLogs();
  }

  public async getAuditLogs(
    filters?: {
      userId?: string;
      resourceId?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<AuditLogEntry[]> {
    return this.auditLogs.filter(log => {
      if (filters?.userId && log.userId !== filters.userId) return false;
      if (filters?.resourceId && log.resourceId !== filters.resourceId) return false;
      if (filters?.resourceType && log.resourceType !== filters.resourceType) return false;
      if (filters?.startDate && log.timestamp < filters.startDate) return false;
      if (filters?.endDate && log.timestamp > filters.endDate) return false;
      return true;
    });
  }

  // Secure Storage

  public async storeSecureData(key: string, data: any): Promise<void> {
    const encryptedData = await this.encrypt(JSON.stringify(data));
    // Store encrypted data in secure storage
    // Implementation would depend on the specific storage mechanism
  }

  public async retrieveSecureData(key: string): Promise<any> {
    // Retrieve encrypted data from secure storage
    // Implementation would depend on the specific storage mechanism
    return null;
  }

  // Persistence

  private async saveAccessControl(): Promise<void> {
    // Save access control entries to secure storage
    // Implementation would depend on the specific storage mechanism
  }

  private async saveAuditLogs(): Promise<void> {
    // Save audit logs to secure storage
    // Implementation would depend on the specific storage mechanism
  }

  // Cleanup

  public async cleanup(): Promise<void> {
    // Clean up any temporary data or resources
    // Implementation would depend on the specific requirements
  }
}

export default SecurityManager; 