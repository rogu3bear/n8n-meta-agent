import { promises as fs } from 'fs';
import path from 'path';
import { AgentTemplate } from '../types/template';

export class TemplateManager {
  private templatesFilePath: string;
  private templates: { [id: string]: AgentTemplate };

  constructor(templatesFilePath?: string) {
    this.templatesFilePath = templatesFilePath || path.join(process.cwd(), 'data', 'templates.json');
    this.templates = {};
  }

  private async ensureDataDirectory() {
    const dir = path.dirname(this.templatesFilePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error('Error creating templates data directory:', error);
    }
  }

  public async init() {
    await this.ensureDataDirectory();
    try {
      const content = await fs.readFile(this.templatesFilePath, 'utf8');
      const data = JSON.parse(content) as { [id: string]: AgentTemplate };
      this.templates = data;
    } catch (error) {
      console.warn('Templates file not found or invalid, initializing new templates store.');
      this.templates = {};
      await this.save();
    }
  }

  private async save() {
    try {
      await fs.writeFile(this.templatesFilePath, JSON.stringify(this.templates, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving templates:', error);
      throw error;
    }
  }

  public async addTemplate(template: AgentTemplate): Promise<void> {
    if (this.templates[template.id]) {
      throw new Error(`Template with id ${template.id} already exists.`);
    }
    this.templates[template.id] = template;
    await this.save();
  }

  public getTemplate(id: string): AgentTemplate | null {
    return this.templates[id] || null;
  }

  public async updateTemplate(template: AgentTemplate): Promise<void> {
    if (!this.templates[template.id]) {
      throw new Error(`Template with id ${template.id} does not exist.`);
    }
    this.templates[template.id] = template;
    await this.save();
  }

  public async deleteTemplate(id: string): Promise<void> {
    if (!this.templates[id]) {
      throw new Error(`Template with id ${id} does not exist.`);
    }
    delete this.templates[id];
    await this.save();
  }

  public queryTemplates(filter: { tags?: string[]; version?: string }): AgentTemplate[] {
    let result = Object.values(this.templates);
    if (filter.version) {
      result = result.filter(template => template.version === filter.version);
    }
    if (filter.tags && filter.tags.length > 0) {
      result = result.filter(template => {
        if (!template.tags) return false;
        return filter.tags!.every(tag => template.tags!.includes(tag));
      });
    }
    return result;
  }

  public async exportTemplate(id: string): Promise<string> {
    const template = this.getTemplate(id);
    if (!template) {
      throw new Error(`Template with id ${id} does not exist.`);
    }
    return JSON.stringify(template, null, 2);
  }

  public async importTemplate(templateJson: string): Promise<void> {
    const template = JSON.parse(templateJson) as AgentTemplate;
    await this.addTemplate(template);
  }

  public recommendTemplates(criteria: any): AgentTemplate[] {
    // For a simple recommendation, if criteria has tags, return those templates that match any of the tags
    if (!criteria || !criteria.tags) {
      return Object.values(this.templates);
    }
    return Object.values(this.templates).filter(template => {
      if (!template.tags) return false;
      return criteria.tags.some((tag: string) => template.tags!.includes(tag));
    });
  }
}

export default TemplateManager; 