import { z } from 'zod';
import { Agent, AgentQuery } from './agent';
import { Template, TemplateQuery } from './template';

/**
 * Schema for registry backup
 */
export const RegistryBackupSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  version: z.string(),
  agents: z.array(z.any()),
  templates: z.array(z.any()),
  metadata: z.record(z.unknown()).optional()
});

export type RegistryBackup = z.infer<typeof RegistryBackupSchema>;

/**
 * Schema for registry index
 */
export const RegistryIndexSchema = z.object({
  id: z.string(),
  type: z.enum(['agent', 'template']),
  name: z.string(),
  tags: z.array(z.string()),
  capabilities: z.array(z.string()),
  status: z.string().optional(),
  lastUpdated: z.date()
});

export type RegistryIndex = z.infer<typeof RegistryIndexSchema>;

/**
 * Schema for registry statistics
 */
export const RegistryStatsSchema = z.object({
  totalAgents: z.number().int().min(0),
  totalTemplates: z.number().int().min(0),
  activeAgents: z.number().int().min(0),
  lastBackup: z.date().optional(),
  storageSize: z.number().int().min(0),
  lastCleanup: z.date().optional()
});

export type RegistryStats = z.infer<typeof RegistryStatsSchema>;

/**
 * Interface for registry operations
 */
export interface Registry {
  // Agent operations
  createAgent(agent: Agent): Promise<Agent>;
  getAgent(id: string): Promise<Agent>;
  updateAgent(id: string, agent: Agent): Promise<Agent>;
  deleteAgent(id: string): Promise<void>;
  queryAgents(query: AgentQuery): Promise<{ agents: Agent[]; total: number }>;
  
  // Template operations
  createTemplate(template: Template): Promise<Template>;
  getTemplate(id: string): Promise<Template>;
  updateTemplate(id: string, template: Template): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
  queryTemplates(query: TemplateQuery): Promise<{ templates: Template[]; total: number }>;
  
  // Index operations
  createIndex(index: RegistryIndex): Promise<RegistryIndex>;
  updateIndex(id: string, index: RegistryIndex): Promise<RegistryIndex>;
  deleteIndex(id: string): Promise<void>;
  searchIndices(query: string): Promise<RegistryIndex[]>;
  
  // Backup operations
  createBackup(): Promise<RegistryBackup>;
  restoreBackup(backup: RegistryBackup): Promise<void>;
  listBackups(): Promise<RegistryBackup[]>;
  deleteBackup(id: string): Promise<void>;
  
  // Maintenance operations
  getStats(): Promise<RegistryStats>;
  cleanup(): Promise<void>;
  optimize(): Promise<void>;
}

/**
 * Schema for registry configuration
 */
export const RegistryConfigSchema = z.object({
  storagePath: z.string(),
  backupPath: z.string(),
  maxBackups: z.number().int().min(1).default(10),
  backupInterval: z.number().int().min(0).default(86400000), // 24 hours
  cleanupInterval: z.number().int().min(0).default(604800000), // 7 days
  optimizeInterval: z.number().int().min(0).default(2592000000), // 30 days
  maxStorageSize: z.number().int().min(0).optional(),
  compressionEnabled: z.boolean().default(true)
});

export type RegistryConfig = z.infer<typeof RegistryConfigSchema>;

/**
 * Schema for registry error
 */
export const RegistryErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.date()
});

export type RegistryError = z.infer<typeof RegistryErrorSchema>;

// Defines the structure of the data persisted for the Agent Registry
export interface RegistryData {
  agents: Agent[];
  templates: Template[];
  lastUpdate: Date;
  version: string;
}

export interface RegistryBackup {
  id: string;
  timestamp: Date;
  data: RegistryData;
  reason: 'scheduled' | 'manual' | 'pre-update' | 'auto-recovery';
}

export interface RegistryIndex<T> {
  [key: string]: T[];
}

export interface RegistryStats {
  totalAgents: number;
  runningAgents: number;
  stoppedAgents: number;
  pausedAgents: number;
  failedAgents: number;
  totalTemplates: number;
  templateCategories: { [category: string]: number };
  lastUpdateTime: Date;
  mostUsedTemplates: {
    templateId: string;
    count: number;
  }[];
  agentsByTag: { [tag: string]: number };
}

export interface RegistryQueryOptions {
  includeAgents?: boolean;
  includeTemplates?: boolean;
  includeBackups?: boolean;
  includeStats?: boolean;
}

export interface RegistryOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface RegistryBackupOptions {
  reason: 'scheduled' | 'manual' | 'pre-update' | 'auto-recovery';
  includeAgents?: boolean;
  includeTemplates?: boolean;
  maxBackups?: number;
}

export function serializeRegistry(data: RegistryData): string {
  return JSON.stringify(data, null, 2);
}

export function deserializeRegistry(data: string): RegistryData {
  const parsed = JSON.parse(data);
  
  // Convert date strings back to Date objects
  parsed.lastUpdate = new Date(parsed.lastUpdate);
  
  parsed.agents.forEach((agent: Agent) => {
    agent.createdAt = new Date(agent.createdAt);
    agent.updatedAt = new Date(agent.updatedAt);
    if (agent.lastRunAt) {
      agent.lastRunAt = new Date(agent.lastRunAt);
    }
    if (agent.schedule?.startDate) {
      agent.schedule.startDate = new Date(agent.schedule.startDate);
    }
    if (agent.schedule?.endDate) {
      agent.schedule.endDate = new Date(agent.schedule.endDate);
    }
  });
  
  return parsed;
}

// Optional: Define types related to registry queries if needed early
// Example:
// export interface AgentFilter {
//   status?: AgentStatus;
//   templateId?: string;
//   tags?: string[];
// } 