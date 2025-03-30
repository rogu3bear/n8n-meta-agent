import { z } from 'zod';
import { Template, CreateTemplate, UpdateTemplate, TemplateVersion, TemplateParameter, TemplateDependency, TemplateCapability } from '../../types/template';
import { RegistryError } from '../../types/registry';

export class TemplateValidator {
  private static readonly parameterSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    description: z.string().optional(),
    required: z.boolean().default(false),
    defaultValue: z.any().optional(),
    validation: z.object({
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      enum: z.array(z.any()).optional()
    }).optional(),
    options: z.array(z.string()).optional()
  });

  private static readonly dependencySchema = z.object({
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    type: z.enum(['runtime', 'build', 'dev']),
    description: z.string().optional()
  });

  private static readonly capabilitySchema = z.object({
    name: z.string().min(1),
    description: z.string(),
    parameters: z.array(z.string()).optional(),
    requiredPermissions: z.array(z.string()).optional()
  });

  private static readonly versionSchema = z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    changelog: z.string(),
    compatibility: z.record(z.string()),
    parameters: z.array(this.parameterSchema),
    dependencies: z.array(this.dependencySchema),
    capabilities: z.array(this.capabilitySchema),
    deprecated: z.boolean()
  });

  private static readonly metadataSchema = z.object({
    author: z.string().min(1),
    category: z.string().min(1),
    tags: z.array(z.string()),
    license: z.string().min(1),
    repository: z.string().url().optional(),
    documentation: z.string().url().optional(),
    examples: z.array(z.string()),
    rating: z.number().min(0).max(5),
    downloads: z.number().min(0),
    lastUpdated: z.date()
  });

  private static readonly templateSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string(),
    type: z.string().min(1),
    currentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    versions: z.array(this.versionSchema),
    metadata: this.metadataSchema,
    createdAt: z.date(),
    updatedAt: z.date()
  });

  static validateTemplate(template: Template): RegistryError | null {
    try {
      this.templateSchema.parse(template);
      return null;
    } catch (error) {
      return this.handleError('VALIDATE_TEMPLATE', error);
    }
  }

  static validateCreateTemplate(template: CreateTemplate): RegistryError | null {
    try {
      // Validate basic properties
      if (!template.name || template.name.length < 1) {
        throw new Error('Template name is required and must not be empty');
      }
      if (!template.description) {
        throw new Error('Template description is required');
      }
      if (!template.type || template.type.length < 1) {
        throw new Error('Template type is required and must not be empty');
      }

      // Validate parameters if provided
      if (template.parameters) {
        template.parameters.forEach(param => this.parameterSchema.parse(param));
      }

      // Validate dependencies if provided
      if (template.dependencies) {
        template.dependencies.forEach(dep => this.dependencySchema.parse(dep));
      }

      // Validate capabilities if provided
      if (template.capabilities) {
        template.capabilities.forEach(cap => this.capabilitySchema.parse(cap));
      }

      // Validate metadata if provided
      if (template.metadata) {
        this.metadataSchema.partial().parse(template.metadata);
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_CREATE_TEMPLATE', error);
    }
  }

  static validateUpdateTemplate(update: UpdateTemplate): RegistryError | null {
    try {
      // Validate name if provided
      if (update.name && update.name.length < 1) {
        throw new Error('Template name must not be empty');
      }

      // Validate description if provided
      if (update.description && update.description.length < 1) {
        throw new Error('Template description must not be empty');
      }

      // Validate type if provided
      if (update.type && update.type.length < 1) {
        throw new Error('Template type must not be empty');
      }

      // Validate metadata if provided
      if (update.metadata) {
        this.metadataSchema.partial().parse(update.metadata);
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_UPDATE_TEMPLATE', error);
    }
  }

  static validateTemplateVersion(version: Omit<TemplateVersion, 'version'>): RegistryError | null {
    try {
      // Validate changelog
      if (!version.changelog || version.changelog.length < 1) {
        throw new Error('Changelog is required and must not be empty');
      }

      // Validate compatibility
      if (typeof version.compatibility !== 'object') {
        throw new Error('Compatibility must be an object');
      }

      // Validate parameters
      version.parameters.forEach(param => this.parameterSchema.parse(param));

      // Validate dependencies
      version.dependencies.forEach(dep => this.dependencySchema.parse(dep));

      // Validate capabilities
      version.capabilities.forEach(cap => this.capabilitySchema.parse(cap));

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_TEMPLATE_VERSION', error);
    }
  }

  static validateParameterValue(parameter: TemplateParameter, value: any): RegistryError | null {
    try {
      // Check required
      if (parameter.required && value === undefined) {
        throw new Error(`Parameter ${parameter.name} is required`);
      }

      // Check type
      switch (parameter.type) {
        case 'string':
          if (value !== undefined && typeof value !== 'string') {
            throw new Error(`Parameter ${parameter.name} must be a string`);
          }
          break;
        case 'number':
          if (value !== undefined && typeof value !== 'number') {
            throw new Error(`Parameter ${parameter.name} must be a number`);
          }
          break;
        case 'boolean':
          if (value !== undefined && typeof value !== 'boolean') {
            throw new Error(`Parameter ${parameter.name} must be a boolean`);
          }
          break;
        case 'array':
          if (value !== undefined && !Array.isArray(value)) {
            throw new Error(`Parameter ${parameter.name} must be an array`);
          }
          break;
        case 'object':
          if (value !== undefined && typeof value !== 'object') {
            throw new Error(`Parameter ${parameter.name} must be an object`);
          }
          break;
      }

      // Check validation rules if provided
      if (parameter.validation) {
        if (parameter.validation.pattern && typeof value === 'string') {
          const regex = new RegExp(parameter.validation.pattern);
          if (!regex.test(value)) {
            throw new Error(`Parameter ${parameter.name} does not match pattern`);
          }
        }
        if (parameter.validation.min !== undefined && typeof value === 'number') {
          if (value < parameter.validation.min) {
            throw new Error(`Parameter ${parameter.name} must be greater than or equal to ${parameter.validation.min}`);
          }
        }
        if (parameter.validation.max !== undefined && typeof value === 'number') {
          if (value > parameter.validation.max) {
            throw new Error(`Parameter ${parameter.name} must be less than or equal to ${parameter.validation.max}`);
          }
        }
        if (parameter.validation.enum && Array.isArray(parameter.validation.enum)) {
          if (!parameter.validation.enum.includes(value)) {
            throw new Error(`Parameter ${parameter.name} must be one of: ${parameter.validation.enum.join(', ')}`);
          }
        }
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_PARAMETER_VALUE', error);
    }
  }

  static validateDependencyCompatibility(dependency: TemplateDependency, installedVersion: string): RegistryError | null {
    try {
      const [major, minor, patch] = dependency.version.split('.').map(Number);
      const [installedMajor, installedMinor, installedPatch] = installedVersion.split('.').map(Number);

      // Check major version compatibility
      if (installedMajor !== major) {
        throw new Error(`Major version mismatch for dependency ${dependency.name}`);
      }

      // Check minor version compatibility
      if (installedMinor < minor) {
        throw new Error(`Minor version too old for dependency ${dependency.name}`);
      }

      // Check patch version compatibility
      if (installedMinor === minor && installedPatch < patch) {
        throw new Error(`Patch version too old for dependency ${dependency.name}`);
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_DEPENDENCY_COMPATIBILITY', error);
    }
  }

  private static handleError(code: string, error: unknown): RegistryError {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      code,
      message,
      timestamp: new Date()
    };
  }
} 