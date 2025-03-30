import { Template, CreateTemplate, UpdateTemplate, TemplateVersion, TemplateParameter, TemplateDependency } from '../../types/template';
import { RegistryError } from '../../types/registry';
import { TemplateValidator } from './TemplateValidator';

export class TemplateValidationService {
  private static instance: TemplateValidationService | null = null;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  static getInstance(): TemplateValidationService {
    if (!this.instance) {
      this.instance = new TemplateValidationService();
    }
    return this.instance;
  }

  async validateTemplate(template: Template): Promise<RegistryError | null> {
    // Basic template validation
    const basicValidation = TemplateValidator.validateTemplate(template);
    if (basicValidation) {
      return basicValidation;
    }

    // Validate all versions
    for (const version of template.versions) {
      const versionValidation = await this.validateTemplateVersion(version);
      if (versionValidation) {
        return versionValidation;
      }
    }

    // Validate version consistency
    const versionConsistencyValidation = this.validateVersionConsistency(template);
    if (versionConsistencyValidation) {
      return versionConsistencyValidation;
    }

    return null;
  }

  async validateCreateTemplate(template: CreateTemplate): Promise<RegistryError | null> {
    // Basic template validation
    const basicValidation = TemplateValidator.validateCreateTemplate(template);
    if (basicValidation) {
      return basicValidation;
    }

    // Validate parameter uniqueness
    const parameterValidation = this.validateParameterUniqueness(template.parameters || []);
    if (parameterValidation) {
      return parameterValidation;
    }

    // Validate dependency compatibility
    const dependencyValidation = await this.validateDependencies(template.dependencies || []);
    if (dependencyValidation) {
      return dependencyValidation;
    }

    // Validate capability consistency
    const capabilityValidation = this.validateCapabilityConsistency(template.capabilities || []);
    if (capabilityValidation) {
      return capabilityValidation;
    }

    return null;
  }

  async validateUpdateTemplate(update: UpdateTemplate): Promise<RegistryError | null> {
    // Basic update validation
    const basicValidation = TemplateValidator.validateUpdateTemplate(update);
    if (basicValidation) {
      return basicValidation;
    }

    // Validate metadata consistency if provided
    if (update.metadata) {
      const metadataValidation = this.validateMetadataConsistency(update.metadata);
      if (metadataValidation) {
        return metadataValidation;
      }
    }

    return null;
  }

  async validateTemplateVersion(version: TemplateVersion): Promise<RegistryError | null> {
    // Basic version validation
    const basicValidation = TemplateValidator.validateTemplateVersion(version);
    if (basicValidation) {
      return basicValidation;
    }

    // Validate parameter dependencies
    const parameterDependencyValidation = this.validateParameterDependencies(version.parameters);
    if (parameterDependencyValidation) {
      return parameterDependencyValidation;
    }

    // Validate capability dependencies
    const capabilityDependencyValidation = this.validateCapabilityDependencies(version.capabilities, version.dependencies);
    if (capabilityDependencyValidation) {
      return capabilityDependencyValidation;
    }

    return null;
  }

  async validateParameterValue(parameter: TemplateParameter, value: any): Promise<RegistryError | null> {
    // Basic parameter validation
    const basicValidation = TemplateValidator.validateParameterValue(parameter, value);
    if (basicValidation) {
      return basicValidation;
    }

    // Validate array/object structure if applicable
    if (parameter.type === 'array' || parameter.type === 'object') {
      const structureValidation = this.validateParameterStructure(parameter, value);
      if (structureValidation) {
        return structureValidation;
      }
    }

    return null;
  }

  private validateVersionConsistency(template: Template): RegistryError | null {
    try {
      // Check if current version exists
      const currentVersionExists = template.versions.some(v => v.version === template.currentVersion);
      if (!currentVersionExists) {
        throw new Error(`Current version ${template.currentVersion} does not exist in versions array`);
      }

      // Check for duplicate versions
      const versionSet = new Set(template.versions.map(v => v.version));
      if (versionSet.size !== template.versions.length) {
        throw new Error('Duplicate versions found');
      }

      // Check version ordering
      const sortedVersions = [...template.versions].sort((a, b) => {
        const [aMajor, aMinor, aPatch] = a.version.split('.').map(Number);
        const [bMajor, bMinor, bPatch] = b.version.split('.').map(Number);
        return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
      });

      if (JSON.stringify(sortedVersions) !== JSON.stringify(template.versions)) {
        throw new Error('Versions are not in descending order');
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_VERSION_CONSISTENCY', error);
    }
  }

  private validateParameterUniqueness(parameters: TemplateParameter[]): RegistryError | null {
    try {
      const nameSet = new Set(parameters.map(p => p.name));
      if (nameSet.size !== parameters.length) {
        throw new Error('Duplicate parameter names found');
      }
      return null;
    } catch (error) {
      return this.handleError('VALIDATE_PARAMETER_UNIQUENESS', error);
    }
  }

  private async validateDependencies(dependencies: TemplateDependency[]): Promise<RegistryError | null> {
    try {
      // Check for duplicate dependencies
      const nameSet = new Set(dependencies.map(d => d.name));
      if (nameSet.size !== dependencies.length) {
        throw new Error('Duplicate dependencies found');
      }

      // Check dependency compatibility
      for (const dependency of dependencies) {
        // In a real implementation, you would check against installed versions
        // For now, we'll just validate the version format
        if (!/^\d+\.\d+\.\d+$/.test(dependency.version)) {
          throw new Error(`Invalid version format for dependency ${dependency.name}`);
        }
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_DEPENDENCIES', error);
    }
  }

  private validateCapabilityConsistency(capabilities: any[]): RegistryError | null {
    try {
      // Check for duplicate capabilities
      const nameSet = new Set(capabilities.map(c => c.name));
      if (nameSet.size !== capabilities.length) {
        throw new Error('Duplicate capabilities found');
      }

      // Validate capability structure
      for (const capability of capabilities) {
        if (!capability.name || !capability.description) {
          throw new Error('Capability must have name and description');
        }
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_CAPABILITY_CONSISTENCY', error);
    }
  }

  private validateMetadataConsistency(metadata: any): RegistryError | null {
    try {
      // Validate required fields
      if (metadata.author && !metadata.author.trim()) {
        throw new Error('Author cannot be empty');
      }
      if (metadata.category && !metadata.category.trim()) {
        throw new Error('Category cannot be empty');
      }

      // Validate tags
      if (metadata.tags && !Array.isArray(metadata.tags)) {
        throw new Error('Tags must be an array');
      }

      // Validate URLs if provided
      if (metadata.repository && !this.isValidUrl(metadata.repository)) {
        throw new Error('Invalid repository URL');
      }
      if (metadata.documentation && !this.isValidUrl(metadata.documentation)) {
        throw new Error('Invalid documentation URL');
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_METADATA_CONSISTENCY', error);
    }
  }

  private validateParameterDependencies(parameters: TemplateParameter[]): RegistryError | null {
    try {
      // Check for circular dependencies
      const dependencyGraph = new Map<string, Set<string>>();
      for (const param of parameters) {
        if (param.options) {
          dependencyGraph.set(param.name, new Set(param.options));
        }
      }

      // Detect cycles using DFS
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      for (const param of parameters) {
        if (this.hasCycle(param.name, dependencyGraph, visited, recursionStack)) {
          throw new Error(`Circular dependency detected in parameters`);
        }
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_PARAMETER_DEPENDENCIES', error);
    }
  }

  private validateCapabilityDependencies(capabilities: any[], dependencies: TemplateDependency[]): RegistryError | null {
    try {
      // Check if all required capabilities have corresponding dependencies
      for (const capability of capabilities) {
        if (capability.requiredPermissions) {
          for (const permission of capability.requiredPermissions) {
            const hasDependency = dependencies.some(d => d.name === permission);
            if (!hasDependency) {
              throw new Error(`Missing dependency for required permission: ${permission}`);
            }
          }
        }
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_CAPABILITY_DEPENDENCIES', error);
    }
  }

  private validateParameterStructure(parameter: TemplateParameter, value: any): RegistryError | null {
    try {
      if (parameter.type === 'array') {
        if (!Array.isArray(value)) {
          throw new Error(`Value must be an array for parameter ${parameter.name}`);
        }

        // Validate array items if validation rules are provided
        if (parameter.validation?.enum) {
          for (const item of value) {
            if (!parameter.validation.enum.includes(item)) {
              throw new Error(`Invalid array item for parameter ${parameter.name}`);
            }
          }
        }
      } else if (parameter.type === 'object') {
        if (typeof value !== 'object' || value === null) {
          throw new Error(`Value must be an object for parameter ${parameter.name}`);
        }

        // Validate object structure if validation rules are provided
        if (parameter.validation?.pattern) {
          for (const key of Object.keys(value)) {
            const regex = new RegExp(parameter.validation.pattern);
            if (!regex.test(key)) {
              throw new Error(`Invalid object key for parameter ${parameter.name}`);
            }
          }
        }
      }

      return null;
    } catch (error) {
      return this.handleError('VALIDATE_PARAMETER_STRUCTURE', error);
    }
  }

  private hasCycle(
    node: string,
    graph: Map<string, Set<string>>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (!visited.has(node)) {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && this.hasCycle(neighbor, graph, visited, recursionStack)) {
            return true;
          } else if (recursionStack.has(neighbor)) {
            return true;
          }
        }
      }
    }

    recursionStack.delete(node);
    return false;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private handleError(code: string, error: unknown): RegistryError {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      code,
      message,
      timestamp: new Date()
    };
  }
} 