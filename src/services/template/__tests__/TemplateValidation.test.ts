import { TemplateValidationService } from '../TemplateValidationService';
import { Template, CreateTemplate, UpdateTemplate, TemplateVersion, TemplateParameter, TemplateDependency } from '../../../types/template';

describe('TemplateValidationService', () => {
  let validationService: TemplateValidationService;

  beforeEach(() => {
    validationService = TemplateValidationService.getInstance();
  });

  describe('validateTemplate', () => {
    it('should validate a valid template', async () => {
      const template: Template = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Template',
        description: 'Test Description',
        type: 'test',
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          changelog: 'Initial version',
          compatibility: {},
          parameters: [],
          dependencies: [],
          capabilities: [],
          deprecated: false
        }],
        metadata: {
          author: 'Test Author',
          category: 'Test Category',
          tags: ['test'],
          license: 'MIT',
          repository: 'https://github.com/test/test',
          documentation: 'https://docs.test.com',
          examples: ['example1'],
          rating: 0,
          downloads: 0,
          lastUpdated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await validationService.validateTemplate(template);
      expect(result).toBeNull();
    });

    it('should reject a template with invalid version format', async () => {
      const template: Template = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Template',
        description: 'Test Description',
        type: 'test',
        currentVersion: 'invalid',
        versions: [{
          version: 'invalid',
          changelog: 'Initial version',
          compatibility: {},
          parameters: [],
          dependencies: [],
          capabilities: [],
          deprecated: false
        }],
        metadata: {
          author: 'Test Author',
          category: 'Test Category',
          tags: ['test'],
          license: 'MIT',
          repository: 'https://github.com/test/test',
          documentation: 'https://docs.test.com',
          examples: ['example1'],
          rating: 0,
          downloads: 0,
          lastUpdated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await validationService.validateTemplate(template);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALIDATE_TEMPLATE');
    });
  });

  describe('validateCreateTemplate', () => {
    it('should validate a valid create template', async () => {
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test',
        parameters: [{
          name: 'param1',
          type: 'string',
          description: 'Test parameter',
          required: true
        }],
        dependencies: [{
          name: 'dep1',
          version: '1.0.0',
          type: 'runtime',
          description: 'Test dependency'
        }],
        capabilities: [{
          name: 'cap1',
          description: 'Test capability',
          parameters: ['param1'],
          requiredPermissions: ['dep1']
        }],
        metadata: {
          author: 'Test Author',
          category: 'Test Category',
          tags: ['test'],
          license: 'MIT',
          repository: 'https://github.com/test/test',
          documentation: 'https://docs.test.com',
          examples: ['example1']
        }
      };

      const result = await validationService.validateCreateTemplate(template);
      expect(result).toBeNull();
    });

    it('should reject a template with duplicate parameters', async () => {
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'Test parameter 1',
            required: true
          },
          {
            name: 'param1',
            type: 'string',
            description: 'Test parameter 2',
            required: true
          }
        ],
        dependencies: [],
        capabilities: [],
        metadata: {
          author: 'Test Author',
          category: 'Test Category',
          tags: ['test'],
          license: 'MIT',
          repository: 'https://github.com/test/test',
          documentation: 'https://docs.test.com',
          examples: ['example1']
        }
      };

      const result = await validationService.validateCreateTemplate(template);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALIDATE_PARAMETER_UNIQUENESS');
    });
  });

  describe('validateUpdateTemplate', () => {
    it('should validate a valid update template', async () => {
      const update: UpdateTemplate = {
        name: 'Updated Template',
        description: 'Updated Description',
        type: 'updated',
        metadata: {
          author: 'Updated Author',
          category: 'Updated Category',
          tags: ['updated'],
          license: 'MIT',
          repository: 'https://github.com/test/updated',
          documentation: 'https://docs.test.com/updated',
          examples: ['updated1']
        }
      };

      const result = await validationService.validateUpdateTemplate(update);
      expect(result).toBeNull();
    });

    it('should reject an update with invalid URL', async () => {
      const update: UpdateTemplate = {
        name: 'Updated Template',
        description: 'Updated Description',
        type: 'updated',
        metadata: {
          author: 'Updated Author',
          category: 'Updated Category',
          tags: ['updated'],
          license: 'MIT',
          repository: 'invalid-url',
          documentation: 'https://docs.test.com/updated',
          examples: ['updated1']
        }
      };

      const result = await validationService.validateUpdateTemplate(update);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALIDATE_METADATA_CONSISTENCY');
    });
  });

  describe('validateTemplateVersion', () => {
    it('should validate a valid template version', async () => {
      const version: TemplateVersion = {
        version: '1.0.0',
        changelog: 'Initial version',
        compatibility: {},
        parameters: [{
          name: 'param1',
          type: 'string',
          description: 'Test parameter',
          required: true
        }],
        dependencies: [{
          name: 'dep1',
          version: '1.0.0',
          type: 'runtime',
          description: 'Test dependency'
        }],
        capabilities: [{
          name: 'cap1',
          description: 'Test capability',
          parameters: ['param1'],
          requiredPermissions: ['dep1']
        }],
        deprecated: false
      };

      const result = await validationService.validateTemplateVersion(version);
      expect(result).toBeNull();
    });

    it('should reject a version with circular parameter dependencies', async () => {
      const version: TemplateVersion = {
        version: '1.0.0',
        changelog: 'Initial version',
        compatibility: {},
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'Test parameter 1',
            required: true,
            options: ['param2']
          },
          {
            name: 'param2',
            type: 'string',
            description: 'Test parameter 2',
            required: true,
            options: ['param1']
          }
        ],
        dependencies: [],
        capabilities: [],
        deprecated: false
      };

      const result = await validationService.validateTemplateVersion(version);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALIDATE_PARAMETER_DEPENDENCIES');
    });
  });

  describe('validateParameterValue', () => {
    it('should validate a valid parameter value', async () => {
      const parameter: TemplateParameter = {
        name: 'testParam',
        type: 'string',
        description: 'Test parameter',
        required: true,
        validation: {
          pattern: '^[a-z]+$',
          min: 3,
          max: 10
        }
      };

      const result = await validationService.validateParameterValue(parameter, 'test');
      expect(result).toBeNull();
    });

    it('should reject a value that does not match pattern', async () => {
      const parameter: TemplateParameter = {
        name: 'testParam',
        type: 'string',
        description: 'Test parameter',
        required: true,
        validation: {
          pattern: '^[a-z]+$'
        }
      };

      const result = await validationService.validateParameterValue(parameter, '123');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALIDATE_PARAMETER_VALUE');
    });

    it('should validate array values', async () => {
      const parameter: TemplateParameter = {
        name: 'testParam',
        type: 'array',
        description: 'Test parameter',
        required: true,
        validation: {
          enum: ['option1', 'option2']
        }
      };

      const result = await validationService.validateParameterValue(parameter, ['option1', 'option2']);
      expect(result).toBeNull();
    });

    it('should reject invalid array values', async () => {
      const parameter: TemplateParameter = {
        name: 'testParam',
        type: 'array',
        description: 'Test parameter',
        required: true,
        validation: {
          enum: ['option1', 'option2']
        }
      };

      const result = await validationService.validateParameterValue(parameter, ['option3']);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('VALIDATE_PARAMETER_STRUCTURE');
    });
  });
}); 