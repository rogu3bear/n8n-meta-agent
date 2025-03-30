import { TemplateStorage } from './TemplateStorage';
import { TemplateValidationService } from './TemplateValidationService';
import { Template, CreateTemplate, UpdateTemplate, TemplateVersion } from '../../types/template';
import { RegistryError } from '../../types/errors';
import { Request, Response } from 'express';
import { z } from 'zod';

export class TemplateAPI {
  private static instance: TemplateAPI | null = null;
  private storage: TemplateStorage;
  private validator: TemplateValidationService;

  private constructor() {
    this.storage = TemplateStorage.getInstance();
    this.validator = TemplateValidationService.getInstance();
  }

  public static getInstance(): TemplateAPI {
    if (!TemplateAPI.instance) {
      TemplateAPI.instance = new TemplateAPI();
    }
    return TemplateAPI.instance;
  }

  // Schema validation
  private readonly createTemplateSchema = z.object({
    name: z.string().min(1),
    description: z.string(),
    type: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string(),
      required: z.boolean().optional(),
      default: z.any().optional(),
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      enum: z.array(z.any()).optional()
    })),
    dependencies: z.array(z.object({
      name: z.string(),
      version: z.string(),
      type: z.string(),
      description: z.string()
    })).optional(),
    capabilities: z.array(z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.array(z.string()),
      requiredPermissions: z.array(z.string())
    })).optional(),
    metadata: z.object({
      author: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
      license: z.string(),
      repository: z.string().url(),
      documentation: z.string().url(),
      examples: z.array(z.string())
    }).optional()
  });

  private readonly updateTemplateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    metadata: z.object({
      author: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      license: z.string().optional(),
      repository: z.string().url().optional(),
      documentation: z.string().url().optional(),
      examples: z.array(z.string()).optional()
    }).optional()
  });

  private readonly templateVersionSchema = z.object({
    changelog: z.string(),
    compatibility: z.record(z.any()),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string(),
      required: z.boolean().optional(),
      default: z.any().optional(),
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      enum: z.array(z.any()).optional()
    })),
    dependencies: z.array(z.object({
      name: z.string(),
      version: z.string(),
      type: z.string(),
      description: z.string()
    })),
    capabilities: z.array(z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.array(z.string()),
      requiredPermissions: z.array(z.string())
    })),
    deprecated: z.boolean()
  });

  // Error handling middleware
  private handleError(error: unknown, res: Response): void {
    if (error instanceof RegistryError) {
      res.status(400).json({
        error: error.code,
        message: error.message,
        timestamp: error.timestamp
      });
    } else if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors,
        timestamp: new Date()
      });
    } else {
      console.error('Unexpected error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date()
      });
    }
  }

  // Template CRUD endpoints
  public async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const data = this.createTemplateSchema.parse(req.body);
      const template = await this.storage.createTemplate(data);
      res.status(201).json(template);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await this.storage.getTemplate(id);
      
      if (!template) {
        res.status(404).json({
          error: 'TEMPLATE_NOT_FOUND',
          message: `Template with ID ${id} not found`,
          timestamp: new Date()
        });
        return;
      }

      res.json(template);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = this.updateTemplateSchema.parse(req.body);
      const template = await this.storage.updateTemplate(id, data);
      res.json(template);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.storage.deleteTemplate(id);
      res.status(204).send();
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // Template version endpoints
  public async addTemplateVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = this.templateVersionSchema.parse(req.body);
      const template = await this.storage.addTemplateVersion(id, data);
      res.json(template);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async deprecateTemplateVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id, version } = req.params;
      const template = await this.storage.deprecateTemplateVersion(id, version);
      res.json(template);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // Template listing and search endpoints
  public async listTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { type, category, tag, capability, search, page, limit } = req.query;
      const templates = await this.storage.listTemplates({
        type: type as string,
        category: category as string,
        tag: tag as string,
        capability: capability as string,
        search: search as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10
      });
      res.json(templates);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // Backup and restore endpoints
  public async createBackup(req: Request, res: Response): Promise<void> {
    try {
      await this.storage.createBackup();
      res.status(201).json({
        message: 'Backup created successfully',
        timestamp: new Date()
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async restoreBackup(req: Request, res: Response): Promise<void> {
    try {
      const { timestamp } = req.params;
      await this.storage.restoreBackup(timestamp);
      res.json({
        message: 'Backup restored successfully',
        timestamp: new Date()
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async listBackups(req: Request, res: Response): Promise<void> {
    try {
      const backups = await this.storage.listBackups();
      res.json(backups);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // Statistics endpoint
  public async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.storage.getStats();
      res.json(stats);
    } catch (error) {
      this.handleError(error, res);
    }
  }
} 