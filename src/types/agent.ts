import { z } from 'zod';

/**
 * Represents the current status of an agent
 */
export enum AgentStatus {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
  TERMINATED = 'terminated'
}

/**
 * Represents the type of agent
 */
export enum AgentType {
  WORKFLOW = 'workflow',
  TASK = 'task',
  ORCHESTRATOR = 'orchestrator',
  MONITOR = 'monitor',
  CUSTOM = 'custom'
}

/**
 * Schema for agent configuration
 */
export const AgentConfigSchema = z.object({
  name: z.string(),
  type: z.nativeEnum(AgentType),
  description: z.string().optional(),
  version: z.string(),
  enabled: z.boolean().default(true),
  maxRetries: z.number().int().min(0).default(3),
  timeout: z.number().int().min(0).default(30000),
  dependencies: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  settings: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Schema for agent metadata
 */
export const AgentMetadataSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  lastRunAt: z.date().optional(),
  lastError: z.string().optional(),
  runCount: z.number().int().min(0).default(0),
  successCount: z.number().int().min(0).default(0),
  failureCount: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
  customData: z.record(z.unknown()).optional()
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

/**
 * Core Agent interface
 */
export interface Agent {
  id: string;
  config: AgentConfig;
  metadata: AgentMetadata;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema for agent creation
 */
export const CreateAgentSchema = z.object({
  config: AgentConfigSchema,
  metadata: AgentMetadataSchema.optional()
});

export type CreateAgent = z.infer<typeof CreateAgentSchema>;

/**
 * Schema for agent update
 */
export const UpdateAgentSchema = z.object({
  config: AgentConfigSchema.partial(),
  metadata: AgentMetadataSchema.partial().optional(),
  status: z.nativeEnum(AgentStatus).optional()
});

export type UpdateAgent = z.infer<typeof UpdateAgentSchema>;

/**
 * Schema for agent query
 */
export const AgentQuerySchema = z.object({
  type: z.nativeEnum(AgentType).optional(),
  status: z.nativeEnum(AgentStatus).optional(),
  tags: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export type AgentQuery = z.infer<typeof AgentQuerySchema>;

export interface ResourceLimits {
  cpu: number;
  memory: number;
  timeoutSeconds?: number;
}

export interface AgentConstraints {
  resourceLimits: ResourceLimits;
  executionTimeWindow?: {
    start: string; // Format: HH:MM
    end: string;   // Format: HH:MM
  };
  maxExecutionsPerDay?: number;
  requiredConnections?: string[];
}

export interface AgentSchedule {
  enabled: boolean;
  cronExpression?: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

// Validation rules for Agent creation/updates
export const AGENT_VALIDATION_RULES = {
  id: {
    pattern: /^[a-zA-Z0-9-_]+$/,
    minLength: 3,
    maxLength: 64
  },
  name: {
    minLength: 3,
    maxLength: 100
  },
  tags: {
    maxItems: 10,
    maxLength: 30
  }
};

export interface AgentCreationRequest {
  name: string;
  description?: string;
  templateId: string;
  parameters: Record<string, any>;
  tags?: string[];
  dependencies?: string[];
  schedule?: AgentSchedule;
  constraints?: AgentConstraints;
  metadata?: Record<string, any>;
}

export interface AgentUpdateRequest {
  name?: string;
  description?: string;
  parameters?: Record<string, any>;
  tags?: string[];
  schedule?: AgentSchedule;
  constraints?: AgentConstraints;
  metadata?: Record<string, any>;
}

export interface AgentQueryOptions {
  status?: AgentStatus | AgentStatus[];
  templateId?: string;
  tags?: string[];
  owner?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastRunAfter?: Date;
  lastRunBefore?: Date;
  dependencies?: string[];
} 