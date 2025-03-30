import { TemplateRenderer } from '../TemplateRenderer';
import { Template, TemplateVersion, TemplateParameter, TemplateDependency } from '../../../types/template';

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer;

  beforeEach(() => {
    renderer = TemplateRenderer.getInstance();
  });

  describe('renderTemplate', () => {
    const mockTemplate: Template = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Template',
      description: 'Test Description',
      type: 'test',
      currentVersion: '1.0.0',
      versions: [{
        version: '1.0.0',
        changelog: 'Initial version',
        compatibility: {},
        parameters: [
          {
            name: 'name',
            type: 'string',
            description: 'Name parameter',
            required: true,
            validation: {
              pattern: '^[a-zA-Z]+$',
              min: 2,
              max: 50
            }
          },
          {
            name: 'age',
            type: 'number',
            description: 'Age parameter',
            required: true,
            validation: {
              min: 0,
              max: 150
            }
          }
        ],
        dependencies: [
          {
            name: 'database',
            version: '1.0.0',
            type: 'runtime',
            description: 'Database dependency'
          }
        ],
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

    it('should render a template with valid parameters', async () => {
      const parameters = {
        name: 'John',
        age: 30
      };

      const result = await renderer.renderTemplate(mockTemplate, '1.0.0', parameters);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.dependencies).toBeDefined();
      expect(result.metadata.templateName).toBe('Test Template');
      expect(result.metadata.templateVersion).toBe('1.0.0');
      expect(result.metadata.templateType).toBe('test');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.category).toBe('Test Category');
      expect(result.metadata.tags).toEqual(['test']);
      expect(result.metadata.license).toBe('MIT');
      expect(result.dependencies.database).toBeDefined();
      expect(result.dependencies.database.version).toBe('1.0.0');
      expect(result.dependencies.database.type).toBe('runtime');
    });

    it('should handle invalid parameters', async () => {
      const parameters = {
        name: '123', // Invalid: contains numbers
        age: 200 // Invalid: exceeds max value
      };

      const result = await renderer.renderTemplate(mockTemplate, '1.0.0', parameters);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('VALIDATE_PARAMETER_VALUE');
      expect(result.errors[1].code).toBe('VALIDATE_PARAMETER_VALUE');
      expect(result.content).toBe('');
      expect(result.metadata).toEqual({});
      expect(result.dependencies).toEqual({});
    });

    it('should handle missing required parameters', async () => {
      const parameters = {
        // Missing required parameters
      };

      const result = await renderer.renderTemplate(mockTemplate, '1.0.0', parameters);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('VALIDATE_PARAMETER_VALUE');
      expect(result.errors[1].code).toBe('VALIDATE_PARAMETER_VALUE');
      expect(result.content).toBe('');
      expect(result.metadata).toEqual({});
      expect(result.dependencies).toEqual({});
    });

    it('should handle non-existent version', async () => {
      const parameters = {
        name: 'John',
        age: 30
      };

      const result = await renderer.renderTemplate(mockTemplate, '2.0.0', parameters);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('RENDER_TEMPLATE_VERSION_NOT_FOUND');
      expect(result.content).toBe('');
      expect(result.metadata).toEqual({});
      expect(result.dependencies).toEqual({});
    });

    it('should handle template with no parameters', async () => {
      const templateWithoutParams: Template = {
        ...mockTemplate,
        versions: [{
          ...mockTemplate.versions[0],
          parameters: []
        }]
      };

      const parameters = {};

      const result = await renderer.renderTemplate(templateWithoutParams, '1.0.0', parameters);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.dependencies).toBeDefined();
    });

    it('should handle template with no dependencies', async () => {
      const templateWithoutDeps: Template = {
        ...mockTemplate,
        versions: [{
          ...mockTemplate.versions[0],
          dependencies: []
        }]
      };

      const parameters = {
        name: 'John',
        age: 30
      };

      const result = await renderer.renderTemplate(templateWithoutDeps, '1.0.0', parameters);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.dependencies).toEqual({});
    });

    it('should handle template with optional parameters', async () => {
      const templateWithOptionalParams: Template = {
        ...mockTemplate,
        versions: [{
          ...mockTemplate.versions[0],
          parameters: [
            {
              name: 'name',
              type: 'string',
              description: 'Name parameter',
              required: false,
              validation: {
                pattern: '^[a-zA-Z]+$',
                min: 2,
                max: 50
              }
            },
            {
              name: 'age',
              type: 'number',
              description: 'Age parameter',
              required: false,
              validation: {
                min: 0,
                max: 150
              }
            }
          ]
        }]
      };

      const parameters = {};

      const result = await renderer.renderTemplate(templateWithOptionalParams, '1.0.0', parameters);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.dependencies).toBeDefined();
    });
  });
}); 