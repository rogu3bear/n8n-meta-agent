import { v4 as uuidv4 } from 'uuid';
import { Template, CreateTemplate, UpdateTemplate, TemplateQuery, TemplateVersion } from '../../types/template';
import { EventEmitter, OrchestrationEvent } from '../../types/orchestration';
import { TemplateEventType } from '../../types/orchestration';
import { RegistryError } from '../../types/registry';

export class TemplateManager {
  private templates: Map<string, Template>;
  private eventEmitter: EventEmitter;
  private indices: Map<string, Map<string, Template[]>>;

  constructor(eventEmitter: EventEmitter) {
    this.templates = new Map();
    this.eventEmitter = eventEmitter;
    this.indices = new Map();
  }

  async createTemplate(template: CreateTemplate): Promise<Template> {
    try {
      const newTemplate: Template = {
        id: uuidv4(),
        name: template.name,
        description: template.description,
        type: template.type,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          changelog: 'Initial version',
          compatibility: template.compatibility || {},
          parameters: template.parameters || [],
          dependencies: template.dependencies || [],
          capabilities: template.capabilities || [],
          deprecated: false
        }],
        metadata: {
          author: template.metadata?.author || 'Unknown',
          category: template.metadata?.category || 'Uncategorized',
          tags: template.metadata?.tags || [],
          license: template.metadata?.license || 'MIT',
          repository: template.metadata?.repository || '',
          documentation: template.metadata?.documentation || '',
          examples: template.metadata?.examples || [],
          rating: 0,
          downloads: 0,
          lastUpdated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.templates.set(newTemplate.id, newTemplate);
      this.updateIndices(newTemplate);

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: TemplateEventType.CREATED,
        timestamp: new Date(),
        source: 'template-manager',
        data: {
          templateId: newTemplate.id,
          version: newTemplate.currentVersion
        }
      });

      return newTemplate;
    } catch (error) {
      throw this.handleError('CREATE_TEMPLATE', error);
    }
  }

  async getTemplate(id: string): Promise<Template> {
    try {
      const template = this.templates.get(id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }
      return template;
    } catch (error) {
      throw this.handleError('GET_TEMPLATE', error);
    }
  }

  async updateTemplate(id: string, update: UpdateTemplate): Promise<Template> {
    try {
      const template = this.templates.get(id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      // Update basic properties
      if (update.name) template.name = update.name;
      if (update.description) template.description = update.description;
      if (update.type) template.type = update.type;
      if (update.metadata) {
        template.metadata = { ...template.metadata, ...update.metadata };
      }
      template.updatedAt = new Date();

      this.templates.set(id, template);
      this.updateIndices(template);

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: TemplateEventType.UPDATED,
        timestamp: new Date(),
        source: 'template-manager',
        data: {
          templateId: id,
          version: template.currentVersion
        }
      });

      return template;
    } catch (error) {
      throw this.handleError('UPDATE_TEMPLATE', error);
    }
  }

  async addTemplateVersion(id: string, version: Omit<TemplateVersion, 'version'>): Promise<Template> {
    try {
      const template = this.templates.get(id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      // Generate new version number
      const currentVersion = template.currentVersion;
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      const newVersion = `${major}.${minor}.${patch + 1}`;

      const newVersionData: TemplateVersion = {
        ...version,
        version: newVersion,
        deprecated: false
      };

      // Add new version
      template.versions.push(newVersionData);
      template.currentVersion = newVersion;
      template.updatedAt = new Date();

      this.templates.set(id, template);
      this.updateIndices(template);

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: TemplateEventType.VERSION_ADDED,
        timestamp: new Date(),
        source: 'template-manager',
        data: {
          templateId: id,
          version: newVersion
        }
      });

      return template;
    } catch (error) {
      throw this.handleError('ADD_TEMPLATE_VERSION', error);
    }
  }

  async deprecateTemplateVersion(id: string, version: string): Promise<Template> {
    try {
      const template = this.templates.get(id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      const versionIndex = template.versions.findIndex(v => v.version === version);
      if (versionIndex === -1) {
        throw new Error(`Version not found: ${version}`);
      }

      template.versions[versionIndex].deprecated = true;
      template.updatedAt = new Date();

      this.templates.set(id, template);
      this.updateIndices(template);

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: TemplateEventType.DEPRECATED,
        timestamp: new Date(),
        source: 'template-manager',
        data: {
          templateId: id,
          version
        }
      });

      return template;
    } catch (error) {
      throw this.handleError('DEPRECATE_TEMPLATE_VERSION', error);
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      const template = this.templates.get(id);
      if (!template) {
        throw new Error(`Template not found: ${id}`);
      }

      this.templates.delete(id);
      this.removeFromIndices(template);

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: TemplateEventType.DELETED,
        timestamp: new Date(),
        source: 'template-manager',
        data: {
          templateId: id,
          version: template.currentVersion
        }
      });
    } catch (error) {
      throw this.handleError('DELETE_TEMPLATE', error);
    }
  }

  async queryTemplates(query: TemplateQuery): Promise<{ templates: Template[]; total: number }> {
    try {
      let filteredTemplates = Array.from(this.templates.values());

      // Apply filters
      if (query.type) {
        filteredTemplates = filteredTemplates.filter(t => t.type === query.type);
      }
      if (query.category) {
        filteredTemplates = filteredTemplates.filter(t => t.metadata.category === query.category);
      }
      if (query.tags?.length) {
        filteredTemplates = filteredTemplates.filter(t =>
          query.tags!.every(tag => t.metadata.tags.includes(tag))
        );
      }
      if (query.capabilities?.length) {
        filteredTemplates = filteredTemplates.filter(t =>
          query.capabilities!.every(cap => t.versions[0].capabilities.includes(cap))
        );
      }
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        filteredTemplates = filteredTemplates.filter(t =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination
      const start = (query.page - 1) * query.limit;
      const end = start + query.limit;
      const paginatedTemplates = filteredTemplates.slice(start, end);

      return {
        templates: paginatedTemplates,
        total: filteredTemplates.length
      };
    } catch (error) {
      throw this.handleError('QUERY_TEMPLATES', error);
    }
  }

  // Private helper methods
  private updateIndices(template: Template): void {
    // Update type index
    const typeIndex = this.getOrCreateIndex('type');
    if (!typeIndex[template.type]) {
      typeIndex[template.type] = [];
    }
    typeIndex[template.type].push(template);

    // Update category index
    const categoryIndex = this.getOrCreateIndex('category');
    if (!categoryIndex[template.metadata.category]) {
      categoryIndex[template.metadata.category] = [];
    }
    categoryIndex[template.metadata.category].push(template);

    // Update tag index
    const tagIndex = this.getOrCreateIndex('tags');
    template.metadata.tags.forEach(tag => {
      if (!tagIndex[tag]) {
        tagIndex[tag] = [];
      }
      tagIndex[tag].push(template);
    });
  }

  private removeFromIndices(template: Template): void {
    // Remove from type index
    const typeIndex = this.getOrCreateIndex('type');
    if (typeIndex[template.type]) {
      typeIndex[template.type] = typeIndex[template.type].filter(t => t.id !== template.id);
    }

    // Remove from category index
    const categoryIndex = this.getOrCreateIndex('category');
    if (categoryIndex[template.metadata.category]) {
      categoryIndex[template.metadata.category] = categoryIndex[template.metadata.category]
        .filter(t => t.id !== template.id);
    }

    // Remove from tag index
    const tagIndex = this.getOrCreateIndex('tags');
    template.metadata.tags.forEach(tag => {
      if (tagIndex[tag]) {
        tagIndex[tag] = tagIndex[tag].filter(t => t.id !== template.id);
      }
    });
  }

  private getOrCreateIndex(name: string): Map<string, Template[]> {
    if (!this.indices.has(name)) {
      this.indices.set(name, new Map());
    }
    return this.indices.get(name)!;
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