import { TemplateParser } from '../TemplateParser';
import { Template, TemplateVersion } from '../../../types/template';

describe('TemplateParser', () => {
  const mockTemplate: Template = {
    id: 'test-template',
    name: 'Test Template',
    description: 'Test template description',
    type: 'workflow',
    currentVersion: '1.0.0',
    versions: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockVersion: TemplateVersion = {
    version: '1.0.0',
    content: '',
    parameters: []
  };

  describe('parseTemplateContent', () => {
    it('should parse valid template content', () => {
      const validContent = {
        nodes: [
          {
            type: 'n8n-nodes-base.start',
            name: 'Start',
            parameters: {},
            position: [0, 0]
          },
          {
            type: 'n8n-nodes-base.httpRequest',
            name: 'HTTP Request',
            parameters: {
              url: '{{apiUrl}}',
              method: 'GET'
            },
            position: [100, 0]
          }
        ],
        connections: [
          {
            from: {
              node: 'Start',
              index: 0
            },
            to: {
              node: 'HTTP Request',
              index: 0
            }
          }
        ]
      };

      mockVersion.content = JSON.stringify(validContent);
      const parameters = { apiUrl: 'https://api.example.com' };

      const result = TemplateParser.parseTemplateContent(mockTemplate, mockVersion, parameters);

      expect(result.nodes).toHaveLength(2);
      expect(result.connections).toHaveLength(1);
      expect(result.nodes[0].id).toBe('test-template-start');
      expect(result.nodes[1].id).toBe('test-template-http-request');
      expect(result.nodes[1].parameters.url).toBe('https://api.example.com');
    });

    it('should handle missing parameters gracefully', () => {
      const content = {
        nodes: [
          {
            type: 'n8n-nodes-base.httpRequest',
            name: 'HTTP Request',
            parameters: {
              url: '{{missingParam}}',
              method: 'GET'
            },
            position: [0, 0]
          }
        ],
        connections: []
      };

      mockVersion.content = JSON.stringify(content);
      const parameters = {};

      const result = TemplateParser.parseTemplateContent(mockTemplate, mockVersion, parameters);

      expect(result.nodes[0].parameters.url).toBe('{{missingParam}}');
    });

    it('should throw error for invalid template content', () => {
      const invalidContent = {
        nodes: [
          {
            // Missing required fields
            type: 'n8n-nodes-base.start'
          }
        ],
        connections: []
      };

      mockVersion.content = JSON.stringify(invalidContent);
      const parameters = {};

      expect(() => {
        TemplateParser.parseTemplateContent(mockTemplate, mockVersion, parameters);
      }).toThrow('Invalid template content');
    });

    it('should throw error for invalid JSON', () => {
      mockVersion.content = 'invalid json';
      const parameters = {};

      expect(() => {
        TemplateParser.parseTemplateContent(mockTemplate, mockVersion, parameters);
      }).toThrow('Failed to parse template content');
    });
  });

  describe('validateTemplateContent', () => {
    it('should validate correct template content', () => {
      const validContent = {
        nodes: [
          {
            type: 'n8n-nodes-base.start',
            name: 'Start',
            parameters: {},
            position: [0, 0]
          }
        ],
        connections: []
      };

      expect(TemplateParser.validateTemplateContent(JSON.stringify(validContent))).toBe(true);
    });

    it('should reject invalid template content', () => {
      const invalidContent = {
        nodes: [
          {
            // Missing required fields
            type: 'n8n-nodes-base.start'
          }
        ],
        connections: []
      };

      expect(TemplateParser.validateTemplateContent(JSON.stringify(invalidContent))).toBe(false);
    });

    it('should reject invalid JSON', () => {
      expect(TemplateParser.validateTemplateContent('invalid json')).toBe(false);
    });
  });
}); 