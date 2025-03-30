import { z } from 'zod';
import { AgentType } from './agent';

/**
 * Schema for template parameters
 */
export const TemplateParameterSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string(),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  validation: z.record(z.unknown()).optional(),
  options: z.array(z.unknown()).optional()
});

export type TemplateParameter = z.infer<typeof TemplateParameterSchema>;

/**
 * Schema for template dependencies
 */
export const TemplateDependencySchema = z.object({
  name: z.string(),
  version: z.string(),
  type: z.enum(['required', 'optional', 'peer']),
  description: z.string().optional()
});

export type TemplateDependency = z.infer<typeof TemplateDependencySchema>;

/**
 * Schema for template capabilities
 */
export const TemplateCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.array(TemplateParameterSchema).optional(),
  requiredPermissions: z.array(z.string()).optional()
});

export type TemplateCapability = z.infer<typeof TemplateCapabilitySchema>;

/**
 * Schema for template version
 */
export const TemplateVersionSchema = z.object({
  version: z.string(),
  changelog: z.string(),
  compatibility: z.object({
    minVersion: z.string(),
    maxVersion: z.string().optional()
  }),
  parameters: z.array(TemplateParameterSchema),
  dependencies: z.array(TemplateDependencySchema),
  capabilities: z.array(TemplateCapabilitySchema),
  deprecated: z.boolean().default(false)
});

export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

/**
 * Schema for template metadata
 */
export const TemplateMetadataSchema = z.object({
  author: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  license: z.string(),
  repository: z.string().optional(),
  documentation: z.string().optional(),
  examples: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  downloads: z.number().int().min(0).optional(),
  lastUpdated: z.date()
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

/**
 * Core Template interface
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  currentVersion: string;
  versions: TemplateVersion[];
  metadata: TemplateMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema for template creation
 */
export const CreateTemplateSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.nativeEnum(AgentType),
  version: TemplateVersionSchema,
  metadata: TemplateMetadataSchema
});

export type CreateTemplate = z.infer<typeof CreateTemplateSchema>;

/**
 * Schema for template update
 */
export const UpdateTemplateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.nativeEnum(AgentType).optional(),
  version: TemplateVersionSchema.optional(),
  metadata: TemplateMetadataSchema.partial().optional()
});

export type UpdateTemplate = z.infer<typeof UpdateTemplateSchema>;

/**
 * Schema for template query
 */
export const TemplateQuerySchema = z.object({
  type: z.nativeEnum(AgentType).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;

// Defines the type of input parameter for a template
export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
  DATE = 'date',
  FILE = 'file',
  URL = 'url',
  EMAIL = 'email',
  IP = 'ip',
  PORT = 'port',
  PATH = 'path',
  SELECT = 'select' // For dropdown/select inputs
}

// Validation rules for parameter values
export interface ParameterValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: any[];
  customValidation?: string; // JSON Schema string or function reference
}

// Describes a single input parameter required by an agent template
export interface TemplateParameter {
  name: string;
  type: ParameterType;
  description: string;
  defaultValue?: any;
  validation?: ParameterValidation;
  options?: any[]; // For SELECT type
  group?: string; // Grouping parameters in UI
  order?: number; // For ordering in UI
  sensitive?: boolean; // For passwords/API keys
  dependsOn?: { // Conditional display based on other params
    parameter: string;
    value: any;
  };
}

// Represents the schema for an agent template
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  version: string; // Semantic version: MAJOR.MINOR.PATCH
  category?: string;
  parameters: TemplateParameter[];
  tags: string[];
  author?: string;
  documentation?: string;
  examples?: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  }[];
  dependencies?: {
    templateId: string;
    version: string;
    required: boolean;
  }[];
  compatibility?: {
    minVersion?: string;
    maxVersion?: string;
    n8nVersions?: string[]; // Compatible n8n versions
  };
  workflows: {
    main: string; // n8n workflow JSON as string or reference to file
    [key: string]: string; // Additional workflows (e.g., 'error', 'cleanup')
  };
  resources?: {
    cpu: number;
    memory: number;
    executionTimeAvg: number;
  };
  schema: string; // Schema version for this template format
}

// Validation rules for Template creation/updates
export const TEMPLATE_VALIDATION_RULES = {
  id: {
    pattern: /^[a-zA-Z0-9-_]+$/,
    minLength: 3,
    maxLength: 64
  },
  name: {
    minLength: 3,
    maxLength: 100
  },
  version: {
    pattern: /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
  },
  parameters: {
    maxItems: 50
  },
  tags: {
    maxItems: 10,
    maxLength: 30
  }
};

export interface TemplateCreationRequest {
  name: string;
  description: string;
  version: string;
  parameters: TemplateParameter[];
  tags: string[];
  workflows: {
    main: string;
    [key: string]: string;
  };
  category?: string;
  author?: string;
  documentation?: string;
  examples?: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  }[];
  dependencies?: {
    templateId: string;
    version: string;
    required: boolean;
  }[];
  compatibility?: {
    minVersion?: string;
    maxVersion?: string;
    n8nVersions?: string[];
  };
  resources?: {
    cpu: number;
    memory: number;
    executionTimeAvg: number;
  };
}

export interface TemplateUpdateRequest {
  name?: string;
  description?: string;
  version?: string;
  parameters?: TemplateParameter[];
  tags?: string[];
  workflows?: {
    main?: string;
    [key: string]: string | undefined;
  };
  category?: string;
  author?: string;
  documentation?: string;
  examples?: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  }[];
  dependencies?: {
    templateId: string;
    version: string;
    required: boolean;
  }[];
  compatibility?: {
    minVersion?: string;
    maxVersion?: string;
    n8nVersions?: string[];
  };
  resources?: {
    cpu: number;
    memory: number;
    executionTimeAvg: number;
  };
}

export interface TemplateQueryOptions {
  category?: string;
  tags?: string[];
  author?: string;
  compatibleWith?: string; // Version to check compatibility with
}

export function isVersionCompatible(
  version: string,
  compatibility: { minVersion?: string; maxVersion?: string }
): boolean {
  // Simple version comparison
  if (!compatibility.minVersion && !compatibility.maxVersion) {
    return true;
  }

  const versionParts = version.split('.').map(Number);
  
  if (compatibility.minVersion) {
    const minParts = compatibility.minVersion.split('.').map(Number);
    // Check if version is greater than or equal to minVersion
    for (let i = 0; i < Math.min(versionParts.length, minParts.length); i++) {
      if (versionParts[i] < minParts[i]) {
        return false;
      }
      if (versionParts[i] > minParts[i]) {
        break;
      }
    }
  }
  
  if (compatibility.maxVersion) {
    const maxParts = compatibility.maxVersion.split('.').map(Number);
    // Check if version is less than or equal to maxVersion
    for (let i = 0; i < Math.min(versionParts.length, maxParts.length); i++) {
      if (versionParts[i] > maxParts[i]) {
        return false;
      }
      if (versionParts[i] < maxParts[i]) {
        break;
      }
    }
  }
  
  return true;
} 