import { Router } from 'express';
import { TemplateAPI } from './TemplateAPI';

export class TemplateRouter {
  private static instance: TemplateRouter | null = null;
  private router: Router;
  private api: TemplateAPI;

  private constructor() {
    this.router = Router();
    this.api = TemplateAPI.getInstance();
    this.setupRoutes();
  }

  public static getInstance(): TemplateRouter {
    if (!TemplateRouter.instance) {
      TemplateRouter.instance = new TemplateRouter();
    }
    return TemplateRouter.instance;
  }

  private setupRoutes(): void {
    // Template CRUD routes
    this.router.post('/templates', this.api.createTemplate.bind(this.api));
    this.router.get('/templates/:id', this.api.getTemplate.bind(this.api));
    this.router.put('/templates/:id', this.api.updateTemplate.bind(this.api));
    this.router.delete('/templates/:id', this.api.deleteTemplate.bind(this.api));

    // Template version routes
    this.router.post('/templates/:id/versions', this.api.addTemplateVersion.bind(this.api));
    this.router.put('/templates/:id/versions/:version/deprecate', this.api.deprecateTemplateVersion.bind(this.api));

    // Template listing and search routes
    this.router.get('/templates', this.api.listTemplates.bind(this.api));

    // Backup and restore routes
    this.router.post('/backups', this.api.createBackup.bind(this.api));
    this.router.post('/backups/:timestamp/restore', this.api.restoreBackup.bind(this.api));
    this.router.get('/backups', this.api.listBackups.bind(this.api));

    // Statistics route
    this.router.get('/stats', this.api.getStats.bind(this.api));
  }

  public getRouter(): Router {
    return this.router;
  }
} 