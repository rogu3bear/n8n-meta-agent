import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentCreationRequest, AgentStatus, AgentUpdateRequest, AgentQueryOptions } from '../types/agent';
import { AgentTemplate } from '../types/template';
import { RegistryData, RegistryIndex, RegistryBackup, RegistryBackupOptions, RegistryOperationResult, serializeRegistry, deserializeRegistry } from '../types/registry';

export class AgentRegistry {
  private registryFilePath: string;
  private backupDir: string;
  private agents: Agent[];
  private templates: AgentTemplate[];
  private lastUpdate: Date;
  private version: string;
  private maxBackups: number;
  
  // Indexes for efficient lookups
  private indexes: {
    agentsByStatus: RegistryIndex<Agent>;
    agentsByTemplate: RegistryIndex<Agent>;
    agentsByTag: RegistryIndex<Agent>;
    agentsByOwner: RegistryIndex<Agent>;
    templatesByCategory: RegistryIndex<AgentTemplate>;
    templatesByTag: RegistryIndex<AgentTemplate>;
  };
  
  constructor() {
    this.registryFilePath = path.join(app.getPath('userData'), 'registry.json');
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.agents = [];
    this.templates = [];
    this.lastUpdate = new Date();
    this.version = '1.0.0';
    this.maxBackups = 10;
    
    this.indexes = {
      agentsByStatus: {},
      agentsByTemplate: {},
      agentsByTag: {},
      agentsByOwner: {},
      templatesByCategory: {},
      templatesByTag: {}
    };
  }
  
  // Initialization
  
  public async init(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Try to load from file
      await this.loadFromFile();
      
      // Rebuild indexes
      this.rebuildIndexes();
      
      console.log(`Registry initialized with ${this.agents.length} agents and ${this.templates.length} templates`);
    } catch (error) {
      console.warn('Could not initialize registry from file, starting fresh', error);
      this.agents = [];
      this.templates = [];
      this.lastUpdate = new Date();
      this.rebuildIndexes();
    }
  }
  
  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.registryFilePath, 'utf-8');
      const registryData = deserializeRegistry(data);
      
      this.agents = registryData.agents;
      this.templates = registryData.templates;
      this.lastUpdate = registryData.lastUpdate;
      this.version = registryData.version;
    } catch (error) {
      throw new Error(`Failed to load registry: ${error}`);
    }
  }
  
  private async saveToFile(): Promise<void> {
    try {
      const registryData: RegistryData = {
        agents: this.agents,
        templates: this.templates,
        lastUpdate: new Date(),
        version: this.version
      };
      
      const serialized = serializeRegistry(registryData);
      await fs.writeFile(this.registryFilePath, serialized, 'utf-8');
      this.lastUpdate = new Date();
    } catch (error) {
      throw new Error(`Failed to save registry: ${error}`);
    }
  }
  
  // Indexing
  
  private rebuildIndexes(): void {
    // Clear existing indexes
    this.indexes = {
      agentsByStatus: {},
      agentsByTemplate: {},
      agentsByTag: {},
      agentsByOwner: {},
      templatesByCategory: {},
      templatesByTag: {}
    };
    
    // Rebuild agent indexes
    for (const agent of this.agents) {
      // Index by status
      if (!this.indexes.agentsByStatus[agent.status]) {
        this.indexes.agentsByStatus[agent.status] = [];
      }
      this.indexes.agentsByStatus[agent.status].push(agent);
      
      // Index by template
      if (!this.indexes.agentsByTemplate[agent.templateId]) {
        this.indexes.agentsByTemplate[agent.templateId] = [];
      }
      this.indexes.agentsByTemplate[agent.templateId].push(agent);
      
      // Index by owner
      if (!this.indexes.agentsByOwner[agent.owner]) {
        this.indexes.agentsByOwner[agent.owner] = [];
      }
      this.indexes.agentsByOwner[agent.owner].push(agent);
      
      // Index by tag
      for (const tag of agent.tags) {
        if (!this.indexes.agentsByTag[tag]) {
          this.indexes.agentsByTag[tag] = [];
        }
        this.indexes.agentsByTag[tag].push(agent);
      }
    }
    
    // Rebuild template indexes
    for (const template of this.templates) {
      // Index by category
      if (template.category) {
        if (!this.indexes.templatesByCategory[template.category]) {
          this.indexes.templatesByCategory[template.category] = [];
        }
        this.indexes.templatesByCategory[template.category].push(template);
      }
      
      // Index by tag
      for (const tag of template.tags) {
        if (!this.indexes.templatesByTag[tag]) {
          this.indexes.templatesByTag[tag] = [];
        }
        this.indexes.templatesByTag[tag].push(template);
      }
    }
  }
  
  private updateIndexes(agent: Agent, isNew: boolean = false): void {
    if (isNew) {
      // Add to indexes
      
      // Status index
      if (!this.indexes.agentsByStatus[agent.status]) {
        this.indexes.agentsByStatus[agent.status] = [];
      }
      this.indexes.agentsByStatus[agent.status].push(agent);
      
      // Template index
      if (!this.indexes.agentsByTemplate[agent.templateId]) {
        this.indexes.agentsByTemplate[agent.templateId] = [];
      }
      this.indexes.agentsByTemplate[agent.templateId].push(agent);
      
      // Owner index
      if (!this.indexes.agentsByOwner[agent.owner]) {
        this.indexes.agentsByOwner[agent.owner] = [];
      }
      this.indexes.agentsByOwner[agent.owner].push(agent);
      
      // Tag indexes
      for (const tag of agent.tags) {
        if (!this.indexes.agentsByTag[tag]) {
          this.indexes.agentsByTag[tag] = [];
        }
        this.indexes.agentsByTag[tag].push(agent);
      }
    } else {
      // Update requires removing from all indexes and re-adding
      this.removeFromIndexes(agent);
      
      // Re-add to indexes
      if (!this.indexes.agentsByStatus[agent.status]) {
        this.indexes.agentsByStatus[agent.status] = [];
      }
      this.indexes.agentsByStatus[agent.status].push(agent);
      
      if (!this.indexes.agentsByTemplate[agent.templateId]) {
        this.indexes.agentsByTemplate[agent.templateId] = [];
      }
      this.indexes.agentsByTemplate[agent.templateId].push(agent);
      
      if (!this.indexes.agentsByOwner[agent.owner]) {
        this.indexes.agentsByOwner[agent.owner] = [];
      }
      this.indexes.agentsByOwner[agent.owner].push(agent);
      
      for (const tag of agent.tags) {
        if (!this.indexes.agentsByTag[tag]) {
          this.indexes.agentsByTag[tag] = [];
        }
        this.indexes.agentsByTag[tag].push(agent);
      }
    }
  }
  
  private removeFromIndexes(agent: Agent): void {
    // Remove from status index
    if (this.indexes.agentsByStatus[agent.status]) {
      this.indexes.agentsByStatus[agent.status] = this.indexes.agentsByStatus[agent.status].filter(a => a.id !== agent.id);
    }
    
    // Remove from template index
    if (this.indexes.agentsByTemplate[agent.templateId]) {
      this.indexes.agentsByTemplate[agent.templateId] = this.indexes.agentsByTemplate[agent.templateId].filter(a => a.id !== agent.id);
    }
    
    // Remove from owner index
    if (this.indexes.agentsByOwner[agent.owner]) {
      this.indexes.agentsByOwner[agent.owner] = this.indexes.agentsByOwner[agent.owner].filter(a => a.id !== agent.id);
    }
    
    // Remove from tag indexes
    for (const tag of agent.tags) {
      if (this.indexes.agentsByTag[tag]) {
        this.indexes.agentsByTag[tag] = this.indexes.agentsByTag[tag].filter(a => a.id !== agent.id);
      }
    }
  }
  
  // Backup Management
  
  public async createBackup(options: RegistryBackupOptions = { reason: 'manual' }): Promise<RegistryBackup> {
    try {
      const backupId = uuidv4();
      const backupTimestamp = new Date();
      const backupFileName = `registry_backup_${backupTimestamp.toISOString().replace(/:/g, '-')}_${backupId}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      const dataToBackup: RegistryData = {
        agents: options.includeAgents !== false ? this.agents : [],
        templates: options.includeTemplates !== false ? this.templates : [],
        lastUpdate: this.lastUpdate,
        version: this.version
      };
      
      const backup: RegistryBackup = {
        id: backupId,
        timestamp: backupTimestamp,
        data: dataToBackup,
        reason: options.reason
      };
      
      await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
      
      // Cleanup old backups if maxBackups is defined
      if (options.maxBackups || this.maxBackups) {
        await this.cleanupOldBackups(options.maxBackups || this.maxBackups);
      }
      
      return backup;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }
  
  private async cleanupOldBackups(maxBackups: number): Promise<void> {
    try {
      const backupFiles = await fs.readdir(this.backupDir);
      // Filter to only include registry backup files
      const filteredBackups = backupFiles.filter(file => file.startsWith('registry_backup_'));
      
      if (filteredBackups.length <= maxBackups) {
        return;
      }
      
      // Sort by creation time (oldest first)
      const sortedBackups = filteredBackups.sort((a, b) => {
        const timeA = new Date(a.split('_')[2].replace(/-/g, ':')).getTime();
        const timeB = new Date(b.split('_')[2].replace(/-/g, ':')).getTime();
        return timeA - timeB;
      });
      
      // Delete oldest backups
      const backupsToDelete = sortedBackups.slice(0, sortedBackups.length - maxBackups);
      for (const backup of backupsToDelete) {
        await fs.unlink(path.join(this.backupDir, backup));
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }
  
  public async restoreFromBackup(backupId: string): Promise<RegistryOperationResult<RegistryData>> {
    try {
      const backupFiles = await fs.readdir(this.backupDir);
      const backupFile = backupFiles.find(file => file.includes(backupId));
      
      if (!backupFile) {
        return {
          success: false,
          error: `Backup with ID ${backupId} not found`,
          timestamp: new Date()
        };
      }
      
      // Create a backup of current state before restore
      await this.createBackup({ reason: 'pre-update' });
      
      // Read and parse backup
      const backupData = await fs.readFile(path.join(this.backupDir, backupFile), 'utf-8');
      const backup = JSON.parse(backupData) as RegistryBackup;
      
      // Restore data
      this.agents = backup.data.agents;
      this.templates = backup.data.templates;
      this.lastUpdate = new Date(); // Set current time as last update
      
      // Rebuild indexes
      this.rebuildIndexes();
      
      // Save to file
      await this.saveToFile();
      
      return {
        success: true,
        data: backup.data,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore from backup: ${error}`,
        timestamp: new Date()
      };
    }
  }
  
  // Agent CRUD Operations
  
  public async createAgent(template: AgentTemplate, parameters: Record<string, any>): Promise<Agent> {
    try {
      // Create backup before making changes
      await this.createBackup({ reason: 'pre-update' });
      
      const now = new Date();
      const newAgent: Agent = {
        id: uuidv4(),
        name: `Agent-${now.getTime()}`,
        status: 'created' as AgentStatus,
        templateId: template.id,
        version: template.version,
        parameters,
        tags: [],
        owner: 'system', // Default owner, should be updated with actual user
        createdAt: now,
        updatedAt: now,
        executionCount: 0,
        metadata: {}
      };
      
      this.agents.push(newAgent);
      this.updateIndexes(newAgent, true);
      await this.saveToFile();
      
      return newAgent;
    } catch (error) {
      throw new Error(`Failed to create agent: ${error}`);
    }
  }
  
  public async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.find(agent => agent.id === id);
  }
  
  public async updateAgent(agent: Agent): Promise<Agent> {
    try {
      const index = this.agents.findIndex(a => a.id === agent.id);
      if (index === -1) {
        throw new Error(`Agent with ID ${agent.id} not found`);
      }
      
      // Create backup before making changes
      await this.createBackup({ reason: 'pre-update' });
      
      // Update agent
      agent.updatedAt = new Date();
      this.agents[index] = agent;
      
      // Update indexes
      this.updateIndexes(agent);
      
      // Save to file
      await this.saveToFile();
      
      return agent;
    } catch (error) {
      throw new Error(`Failed to update agent: ${error}`);
    }
  }
  
  public async updateAgentStatus(agentId: string, status: AgentStatus): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    const oldStatus = agent.status;
    agent.status = status;
    agent.updatedAt = new Date();
    
    if (status === 'running') {
      agent.lastRunAt = new Date();
    }
    
    await this.updateAgent(agent);
    return agent;
  }
  
  public async deleteAgent(id: string): Promise<boolean> {
    try {
      const agent = await this.getAgent(id);
      if (!agent) {
        return false;
      }
      
      // Create backup before making changes
      await this.createBackup({ reason: 'pre-update' });
      
      // Remove from indexes
      this.removeFromIndexes(agent);
      
      // Remove from list
      this.agents = this.agents.filter(a => a.id !== id);
      
      // Save to file
      await this.saveToFile();
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete agent: ${error}`);
    }
  }
  
  // Query Operations
  
  public async getAgents(options?: AgentQueryOptions): Promise<Agent[]> {
    if (!options) {
      return this.agents;
    }
    
    let results = this.agents;
    
    // Filter by status
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      results = results.filter(agent => statuses.includes(agent.status));
    }
    
    // Filter by template
    if (options.templateId) {
      results = results.filter(agent => agent.templateId === options.templateId);
    }
    
    // Filter by owner
    if (options.owner) {
      results = results.filter(agent => agent.owner === options.owner);
    }
    
    // Filter by tags (agent must have ALL specified tags)
    if (options.tags && options.tags.length > 0) {
      results = results.filter(agent => 
        options.tags!.every(tag => agent.tags.includes(tag))
      );
    }
    
    // Filter by creation date
    if (options.createdAfter) {
      results = results.filter(agent => agent.createdAt >= options.createdAfter!);
    }
    
    if (options.createdBefore) {
      results = results.filter(agent => agent.createdAt <= options.createdBefore!);
    }
    
    // Filter by last run date
    if (options.lastRunAfter) {
      results = results.filter(agent => agent.lastRunAt && agent.lastRunAt >= options.lastRunAfter!);
    }
    
    if (options.lastRunBefore) {
      results = results.filter(agent => agent.lastRunAt && agent.lastRunAt <= options.lastRunBefore!);
    }
    
    // Filter by dependencies
    if (options.dependencies && options.dependencies.length > 0) {
      results = results.filter(agent => 
        agent.dependencies && options.dependencies!.every(dep => agent.dependencies!.includes(dep))
      );
    }
    
    return results;
  }
  
  public async getAgentsByStatus(status: AgentStatus): Promise<Agent[]> {
    return this.indexes.agentsByStatus[status] || [];
  }
  
  public async getAgentsByTemplate(templateId: string): Promise<Agent[]> {
    return this.indexes.agentsByTemplate[templateId] || [];
  }
  
  public async getAgentsByTag(tag: string): Promise<Agent[]> {
    return this.indexes.agentsByTag[tag] || [];
  }
  
  public async getAgentsByOwner(owner: string): Promise<Agent[]> {
    return this.indexes.agentsByOwner[owner] || [];
  }
  
  // Template Operations
  
  public async addTemplate(template: AgentTemplate): Promise<AgentTemplate> {
    try {
      // Create backup before making changes
      await this.createBackup({ reason: 'pre-update' });
      
      // Check if template with this ID already exists
      const existingIndex = this.templates.findIndex(t => t.id === template.id);
      
      if (existingIndex >= 0) {
        // Update existing template
        this.templates[existingIndex] = template;
      } else {
        // Add new template
        this.templates.push(template);
      }
      
      // Update indexes
      this.rebuildIndexes();
      
      // Save to file
      await this.saveToFile();
      
      return template;
    } catch (error) {
      throw new Error(`Failed to add template: ${error}`);
    }
  }
  
  public async getTemplate(id: string): Promise<AgentTemplate | undefined> {
    return this.templates.find(template => template.id === id);
  }
  
  public async deleteTemplate(id: string): Promise<boolean> {
    try {
      // Check if template exists
      const template = await this.getTemplate(id);
      if (!template) {
        return false;
      }
      
      // Check if template is in use by any agents
      const usingAgents = await this.getAgentsByTemplate(id);
      if (usingAgents.length > 0) {
        throw new Error(`Cannot delete template ${id} as it is used by ${usingAgents.length} agents`);
      }
      
      // Create backup before making changes
      await this.createBackup({ reason: 'pre-update' });
      
      // Remove template
      this.templates = this.templates.filter(t => t.id !== id);
      
      // Update indexes
      this.rebuildIndexes();
      
      // Save to file
      await this.saveToFile();
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete template: ${error}`);
    }
  }
  
  // Cleanup
  
  public async cleanup(): Promise<void> {
    try {
      // Create final backup
      await this.createBackup({ 
        reason: 'manual',
        includeAgents: true,
        includeTemplates: true
      });
      
      // Other cleanup tasks can be performed here if needed
    } catch (error) {
      console.error('Failed to cleanup registry:', error);
    }
  }
}

export default AgentRegistry; 
export default AgentRegistry; 