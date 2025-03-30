import { z } from 'zod';
import { Agent, AgentStatus } from './agent';
import { Template } from './template';

/**
 * Event types for agent lifecycle
 */
export enum AgentEventType {
  CREATED = 'agent.created',
  INITIALIZED = 'agent.initialized',
  STARTED = 'agent.started',
  PAUSED = 'agent.paused',
  RESUMED = 'agent.resumed',
  STOPPED = 'agent.stopped',
  ERROR = 'agent.error',
  TERMINATED = 'agent.terminated',
  UPDATED = 'agent.updated',
  DELETED = 'agent.deleted'
}

/**
 * Event types for template lifecycle
 */
export enum TemplateEventType {
  CREATED = 'template.created',
  UPDATED = 'template.updated',
  VERSION_ADDED = 'template.version_added',
  DEPRECATED = 'template.deprecated',
  DELETED = 'template.deleted'
}

/**
 * Event types for registry lifecycle
 */
export enum RegistryEventType {
  BACKUP_CREATED = 'registry.backup_created',
  BACKUP_RESTORED = 'registry.backup_restored',
  BACKUP_DELETED = 'registry.backup_deleted',
  CLEANUP_STARTED = 'registry.cleanup_started',
  CLEANUP_COMPLETED = 'registry.cleanup_completed',
  OPTIMIZATION_STARTED = 'registry.optimization_started',
  OPTIMIZATION_COMPLETED = 'registry.optimization_completed'
}

/**
 * Base event schema
 */
export const BaseEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.date(),
  source: z.string(),
  correlationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

/**
 * Agent event schema
 */
export const AgentEventSchema = BaseEventSchema.extend({
  type: z.nativeEnum(AgentEventType),
  data: z.object({
    agentId: z.string(),
    previousStatus: z.nativeEnum(AgentStatus).optional(),
    currentStatus: z.nativeEnum(AgentStatus),
    error: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  })
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;

/**
 * Template event schema
 */
export const TemplateEventSchema = BaseEventSchema.extend({
  type: z.nativeEnum(TemplateEventType),
  data: z.object({
    templateId: z.string(),
    version: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  })
});

export type TemplateEvent = z.infer<typeof TemplateEventSchema>;

/**
 * Registry event schema
 */
export const RegistryEventSchema = BaseEventSchema.extend({
  type: z.nativeEnum(RegistryEventType),
  data: z.object({
    backupId: z.string().optional(),
    stats: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional()
  })
});

export type RegistryEvent = z.infer<typeof RegistryEventSchema>;

/**
 * Combined event type
 */
export type OrchestrationEvent = AgentEvent | TemplateEvent | RegistryEvent;

/**
 * Event handler interface
 */
export interface EventHandler {
  handleAgentEvent(event: AgentEvent): Promise<void>;
  handleTemplateEvent(event: TemplateEvent): Promise<void>;
  handleRegistryEvent(event: RegistryEvent): Promise<void>;
}

/**
 * Event emitter interface
 */
export interface EventEmitter {
  emit(event: OrchestrationEvent): Promise<void>;
  subscribe(handler: EventHandler): void;
  unsubscribe(handler: EventHandler): void;
}

/**
 * Event store interface
 */
export interface EventStore {
  save(event: OrchestrationEvent): Promise<void>;
  getEvents(query: EventQuery): Promise<OrchestrationEvent[]>;
  getEventsByType(type: string): Promise<OrchestrationEvent[]>;
  getEventsByCorrelationId(correlationId: string): Promise<OrchestrationEvent[]>;
}

/**
 * Event query schema
 */
export const EventQuerySchema = z.object({
  type: z.string().optional(),
  source: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  correlationId: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(100)
});

export type EventQuery = z.infer<typeof EventQuerySchema>; 