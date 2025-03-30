import { AgentTemplate, TemplateParameter, ParameterType, ParameterValidation, TEMPLATE_VALIDATION_RULES, isVersionCompatible } from '../types/template';
import semver from 'semver';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ParameterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UpgradePath {
  from: string;
  to: string;
  steps: string[];
  isMajorUpgrade: boolean;
  isBreaking: boolean;
  requiredChanges: string[];
}

export class TemplateValidator {
  /**
   * Validates a template against its schema
   * @param template The template to validate
   * @returns Validation result with errors if any
   */
  public async validateTemplate(template: AgentTemplate): Promise<ValidationResult> {
    const errors: string[] = [];
    
    // Check required fields
    if (!template.id) {
      errors.push('Template ID is required');
    } else if (!TEMPLATE_VALIDATION_RULES.id.pattern.test(template.id)) {
      errors.push(`Template ID must match pattern: ${TEMPLATE_VALIDATION_RULES.id.pattern}`);
    } else if (template.id.length < TEMPLATE_VALIDATION_RULES.id.minLength || 
               template.id.length > TEMPLATE_VALIDATION_RULES.id.maxLength) {
      errors.push(`Template ID must be between ${TEMPLATE_VALIDATION_RULES.id.minLength} and ${TEMPLATE_VALIDATION_RULES.id.maxLength} characters`);
    }
    
    if (!template.name) {
      errors.push('Template name is required');
    } else if (template.name.length < TEMPLATE_VALIDATION_RULES.name.minLength || 
               template.name.length > TEMPLATE_VALIDATION_RULES.name.maxLength) {
      errors.push(`Template name must be between ${TEMPLATE_VALIDATION_RULES.name.minLength} and ${TEMPLATE_VALIDATION_RULES.name.maxLength} characters`);
    }
    
    if (!template.version) {
      errors.push('Template version is required');
    } else if (!TEMPLATE_VALIDATION_RULES.version.pattern.test(template.version)) {
      errors.push('Template version must follow semantic versioning (e.g., 1.0.0)');
    }
    
    if (!template.parameters || !Array.isArray(template.parameters)) {
      errors.push('Template parameters must be an array');
    } else if (template.parameters.length > TEMPLATE_VALIDATION_RULES.parameters.maxItems) {
      errors.push(`Template can have at most ${TEMPLATE_VALIDATION_RULES.parameters.maxItems} parameters`);
    } else {
      // Validate each parameter
      for (const param of template.parameters) {
        const paramResult = this.validateParameter(param);
        if (!paramResult.isValid) {
          errors.push(...paramResult.errors.map(err => `Parameter '${param.name}': ${err}`));
        }
      }
      
      // Check for duplicate parameter names
      const paramNames = template.parameters.map(p => p.name);
      const duplicates = paramNames.filter((name, index) => paramNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate parameter names: ${duplicates.join(', ')}`);
      }
    }
    
    if (!template.tags || !Array.isArray(template.tags)) {
      errors.push('Template tags must be an array');
    } else if (template.tags.length > TEMPLATE_VALIDATION_RULES.tags.maxItems) {
      errors.push(`Template can have at most ${TEMPLATE_VALIDATION_RULES.tags.maxItems} tags`);
    } else {
      // Check tag length
      const invalidTags = template.tags.filter(tag => tag.length > TEMPLATE_VALIDATION_RULES.tags.maxLength);
      if (invalidTags.length > 0) {
        errors.push(`Tags must be at most ${TEMPLATE_VALIDATION_RULES.tags.maxLength} characters long: ${invalidTags.join(', ')}`);
      }
    }
    
    // Validate workflows
    if (!template.workflows || typeof template.workflows !== 'object') {
      errors.push('Template workflows must be an object');
    } else if (!template.workflows.main) {
      errors.push('Template must include a main workflow');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validates a single template parameter
   * @param parameter The parameter to validate
   * @returns Validation result with errors and warnings
   */
  public validateParameter(parameter: TemplateParameter): ParameterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    if (!parameter.name) {
      errors.push('Parameter name is required');
    }
    
    if (!parameter.type) {
      errors.push('Parameter type is required');
    } else if (!Object.values(ParameterType).includes(parameter.type)) {
      errors.push(`Invalid parameter type: ${parameter.type}`);
    }
    
    if (!parameter.description) {
      warnings.push('Parameter should have a description');
    }
    
    // Validate specific types
    switch (parameter.type) {
      case ParameterType.SELECT:
        if (!parameter.options || !Array.isArray(parameter.options) || parameter.options.length === 0) {
          errors.push('SELECT parameter must have options array');
        }
        break;
        
      case ParameterType.ARRAY:
        if (parameter.validation && parameter.validation.minLength !== undefined && 
            parameter.validation.maxLength !== undefined && 
            parameter.validation.minLength > parameter.validation.maxLength) {
          errors.push('minLength cannot be greater than maxLength');
        }
        break;
        
      case ParameterType.NUMBER:
        if (parameter.validation && parameter.validation.min !== undefined && 
            parameter.validation.max !== undefined && 
            parameter.validation.min > parameter.validation.max) {
          errors.push('min cannot be greater than max');
        }
        break;
    }
    
    // Validate parameter validation rules
    if (parameter.validation) {
      const validationErrors = this.validateParameterRules(parameter.validation, parameter.type);
      errors.push(...validationErrors);
    }
    
    // Check dependsOn references
    if (parameter.dependsOn && parameter.dependsOn.parameter) {
      // This would normally check that the referenced parameter exists
      // But we don't have the full template here, this would be done at the template level
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validates the parameter validation rules
   * @param validation The validation rules to check
   * @param type The parameter type
   * @returns List of validation errors
   */
  private validateParameterRules(validation: ParameterValidation, type: ParameterType): string[] {
    const errors: string[] = [];
    
    // Validate min/max for numbers
    if (type === ParameterType.NUMBER) {
      if (validation.min !== undefined && typeof validation.min !== 'number') {
        errors.push('min must be a number');
      }
      
      if (validation.max !== undefined && typeof validation.max !== 'number') {
        errors.push('max must be a number');
      }
    }
    
    // Validate minLength/maxLength for strings and arrays
    if (type === ParameterType.STRING || type === ParameterType.ARRAY) {
      if (validation.minLength !== undefined && typeof validation.minLength !== 'number') {
        errors.push('minLength must be a number');
      }
      
      if (validation.maxLength !== undefined && typeof validation.maxLength !== 'number') {
        errors.push('maxLength must be a number');
      }
    }
    
    // Validate pattern for strings
    if (type === ParameterType.STRING && validation.pattern !== undefined) {
      try {
        new RegExp(validation.pattern);
      } catch (e) {
        errors.push(`Invalid regex pattern: ${validation.pattern}`);
      }
    }
    
    // Validate enum values
    if (validation.enum !== undefined) {
      if (!Array.isArray(validation.enum)) {
        errors.push('enum must be an array');
      } else if (validation.enum.length === 0) {
        errors.push('enum cannot be empty');
      }
    }
    
    return errors;
  }
  
  /**
   * Checks if a template is compatible with a given version
   * @param template The template to check
   * @param version The version to check compatibility with
   * @returns Whether the template is compatible
   */
  public isCompatible(template: AgentTemplate, version: string): boolean {
    if (!template.compatibility) {
      return true; // No compatibility constraints means compatible with all versions
    }
    
    return isVersionCompatible(version, template.compatibility);
  }
  
  /**
   * Generates an upgrade path between two template versions
   * @param fromVersion The source version
   * @param toVersion The target version
   * @returns The upgrade path or null if not possible
   */
  public generateUpgradePath(fromVersion: string, toVersion: string): UpgradePath | null {
    // Check if versions are valid
    if (!semver.valid(fromVersion) || !semver.valid(toVersion)) {
      return null;
    }
    
    // Check if upgrade is needed
    if (semver.eq(fromVersion, toVersion)) {
      return {
        from: fromVersion,
        to: toVersion,
        steps: [],
        isMajorUpgrade: false,
        isBreaking: false,
        requiredChanges: []
      };
    }
    
    // Check if it's a downgrade (not supported)
    if (semver.lt(toVersion, fromVersion)) {
      return null;
    }
    
    const fromParts = semver.parse(fromVersion);
    const toParts = semver.parse(toVersion);
    
    if (!fromParts || !toParts) {
      return null;
    }
    
    const isMajorUpgrade = toParts.major > fromParts.major;
    const isBreaking = isMajorUpgrade;
    
    // Generate intermediate steps
    const steps: string[] = [];
    
    // For major version upgrades, go through each minor version of each major version
    if (isMajorUpgrade) {
      // Add last minor version of each major version in between
      for (let major = fromParts.major + 1; major < toParts.major; major++) {
        steps.push(`${major}.0.0`);
      }
      
      // Add target version
      steps.push(toVersion);
    } 
    // For minor version upgrades, go through each minor version
    else if (toParts.minor > fromParts.minor) {
      for (let minor = fromParts.minor + 1; minor <= toParts.minor; minor++) {
        steps.push(`${fromParts.major}.${minor}.0`);
      }
    } 
    // For patch version upgrades, just go directly to target
    else {
      steps.push(toVersion);
    }
    
    // Determine required changes (in a real system, this would come from a database of breaking changes)
    const requiredChanges: string[] = [];
    if (isMajorUpgrade) {
      requiredChanges.push('Review parameter validation rules for changes');
      requiredChanges.push('Check for deprecated parameters');
      requiredChanges.push('Update workflow connections');
    }
    
    return {
      from: fromVersion,
      to: toVersion,
      steps,
      isMajorUpgrade,
      isBreaking,
      requiredChanges
    };
  }
  
  /**
   * Checks if a template can be applied to an existing template
   * @param source The source template
   * @param target The target template
   * @returns Whether the template can be applied
   */
  public canApplyTemplate(source: AgentTemplate, target: AgentTemplate): boolean {
    // Check if templates are compatible
    if (source.id !== target.id) {
      return false;
    }
    
    // Check if versions are compatible
    return this.generateUpgradePath(target.version, source.version) !== null;
  }
}

export default TemplateValidator; 