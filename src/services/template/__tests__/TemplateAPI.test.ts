import { TemplateAPI } from '../TemplateAPI';
import { TemplateStorage } from '../TemplateStorage';
import { TemplateValidationService } from '../TemplateValidationService';
import { Request, Response } from 'express';
import { Template, CreateTemplate, UpdateTemplate } from '../../../types/template';

jest.mock('../TemplateStorage');
jest.mock('../TemplateValidationService');

describe('TemplateAPI', () => {
  let api: TemplateAPI;
  let mockStorage: jest.Mocked<TemplateStorage>;
  let mockValidator: jest.Mocked<TemplateValidationService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Initialize API
    api = TemplateAPI.getInstance();

    // Setup mock storage
    mockStorage = {
      createTemplate: jest.fn(),
      getTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      addTemplateVersion: jest.fn(),
      deprecateTemplateVersion: jest.fn(),
      listTemplates: jest.fn(),
      createBackup: jest.fn(),
      restoreBackup: jest.fn(),
      listBackups: jest.fn(),
      getStats: jest.fn()
    } as any;

    // Setup mock validator
    mockValidator = {
      validateTemplate: jest.fn(),
      validateCreateTemplate: jest.fn(),
      validateUpdateTemplate: jest.fn(),
      validateTemplateVersion: jest.fn(),
      validateParameterValue: jest.fn()
    } as any;

    // Setup mock request and response
    mockReq = {
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('createTemplate', () => {
    it('should create a new template successfully', async () => {
      const template: CreateTemplate = {
        name: 'Test Template',
        description: 'Test Description',
        type: 'test'
      };

      const createdTemplate: Template = {
        id: 'test-id',
        ...template,
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

      mockReq.body = template;
      mockStorage.createTemplate.mockResolvedValue(createdTemplate);

      await api.createTemplate(mockReq as Request, mockRes as Response);

      expect(mockStorage.createTemplate).toHaveBeenCalledWith(template);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(createdTemplate);
    });

    it('should handle validation errors', async () => {
      mockReq.body = {
        name: '', // Invalid: empty name
        description: 'Test Description',
        type: 'test'
      };

      await api.createTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data'
        })
      );
    });
  });

  describe('getTemplate', () => {
    it('should retrieve an existing template', async () => {
      const template: Template = {
        id: 'test-id',
        name: 'Test Template',
        description: 'Test Description',
        type: 'test',
        currentVersion: '1.0.0',
        versions: [],
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

      mockReq.params = { id: 'test-id' };
      mockStorage.getTemplate.mockResolvedValue(template);

      await api.getTemplate(mockReq as Request, mockRes as Response);

      expect(mockStorage.getTemplate).toHaveBeenCalledWith('test-id');
      expect(mockRes.json).toHaveBeenCalledWith(template);
    });

    it('should handle non-existent template', async () => {
      mockReq.params = { id: 'non-existent-id' };
      mockStorage.getTemplate.mockResolvedValue(null);

      await api.getTemplate(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template with ID non-existent-id not found'
        })
      );
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      const update: UpdateTemplate = {
        name: 'Updated Template',
        description: 'Updated Description',
        type: 'updated'
      };

      const updatedTemplate: Template = {
        id: 'test-id',
        ...update,
        currentVersion: '1.0.0',
        versions: [],
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

      mockReq.params = { id: 'test-id' };
      mockReq.body = update;
      mockStorage.updateTemplate.mockResolvedValue(updatedTemplate);

      await api.updateTemplate(mockReq as Request, mockRes as Response);

      expect(mockStorage.updateTemplate).toHaveBeenCalledWith('test-id', update);
      expect(mockRes.json).toHaveBeenCalledWith(updatedTemplate);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete an existing template', async () => {
      mockReq.params = { id: 'test-id' };
      mockStorage.deleteTemplate.mockResolvedValue(undefined);

      await api.deleteTemplate(mockReq as Request, mockRes as Response);

      expect(mockStorage.deleteTemplate).toHaveBeenCalledWith('test-id');
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
  });

  describe('listTemplates', () => {
    it('should list templates with filters', async () => {
      const templates: Template[] = [
        {
          id: 'test-id-1',
          name: 'Template 1',
          description: 'Description 1',
          type: 'test',
          currentVersion: '1.0.0',
          versions: [],
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
        }
      ];

      mockReq.query = {
        type: 'test',
        category: 'Test Category',
        tag: 'test',
        page: '1',
        limit: '10'
      };

      mockStorage.listTemplates.mockResolvedValue(templates);

      await api.listTemplates(mockReq as Request, mockRes as Response);

      expect(mockStorage.listTemplates).toHaveBeenCalledWith({
        type: 'test',
        category: 'Test Category',
        tag: 'test',
        page: 1,
        limit: 10
      });
      expect(mockRes.json).toHaveBeenCalledWith(templates);
    });
  });

  describe('backup and restore', () => {
    it('should create a backup', async () => {
      mockStorage.createBackup.mockResolvedValue(undefined);

      await api.createBackup(mockReq as Request, mockRes as Response);

      expect(mockStorage.createBackup).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Backup created successfully'
        })
      );
    });

    it('should restore a backup', async () => {
      const timestamp = '2024-03-20T12:00:00Z';
      mockReq.params = { timestamp };
      mockStorage.restoreBackup.mockResolvedValue(undefined);

      await api.restoreBackup(mockReq as Request, mockRes as Response);

      expect(mockStorage.restoreBackup).toHaveBeenCalledWith(timestamp);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Backup restored successfully'
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      const stats = {
        totalTemplates: 10,
        totalVersions: 15,
        totalSize: 1024,
        cacheSize: 5,
        lastBackup: new Date()
      };

      mockStorage.getStats.mockResolvedValue(stats);

      await api.getStats(mockReq as Request, mockRes as Response);

      expect(mockStorage.getStats).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(stats);
    });
  });
}); 