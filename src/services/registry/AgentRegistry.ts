import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentQuery, AgentStatus, CreateAgent, UpdateAgent } from '../../types/agent';
import { Registry, RegistryConfig, RegistryData, RegistryError, RegistryStats } from '../../types/registry';
import { EventEmitter, OrchestrationEvent } from '../../types/orchestration';
import { AgentEventType } from '../../types/orchestration';

export class AgentRegistry implements Registry {
  private data: RegistryData;
  private config: RegistryConfig;
  private eventEmitter: EventEmitter;
  private indices: Map<string, RegistryIndex<Agent>>;

  constructor(config: RegistryConfig, eventEmitter: EventEmitter) {
    this.config = config;
    this.eventEmitter = eventEmitter;
    this.indices = new Map();
    this.data = {
      agents: [],
      templates: [],
      lastUpdate: new Date(),
      version: '1.0.0'
    };
  }

  // Agent operations
  async createAgent(agent: CreateAgent): Promise<Agent> {
    try {
      const newAgent: Agent = {
        id: uuidv4(),
        config: agent.config,
        metadata: agent.metadata || {
          createdAt: new Date(),
          updatedAt: new Date(),
          runCount: 0,
          successCount: 0,
          failureCount: 0,
          tags: []
        },
        status: AgentStatus.CREATED,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.data.agents.push(newAgent);
      this.updateIndices(newAgent);
      this.data.lastUpdate = new Date();

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: AgentEventType.CREATED,
        timestamp: new Date(),
        source: 'registry',
        data: {
          agentId: newAgent.id,
          currentStatus: newAgent.status
        }
      });

      return newAgent;
    } catch (error) {
      throw this.handleError('CREATE_AGENT', error);
    }
  }

  async getAgent(id: string): Promise<Agent> {
    try {
      const agent = this.data.agents.find(a => a.id === id);
      if (!agent) {
        throw new Error(`Agent not found: ${id}`);
      }
      return agent;
    } catch (error) {
      throw this.handleError('GET_AGENT', error);
    }
  }

  async updateAgent(id: string, update: UpdateAgent): Promise<Agent> {
    try {
      const index = this.data.agents.findIndex(a => a.id === id);
      if (index === -1) {
        throw new Error(`Agent not found: ${id}`);
      }

      const agent = this.data.agents[index];
      const previousStatus = agent.status;

      // Update agent properties
      if (update.config) {
        agent.config = { ...agent.config, ...update.config };
      }
      if (update.metadata) {
        agent.metadata = { ...agent.metadata, ...update.metadata };
      }
      if (update.status) {
        agent.status = update.status;
      }
      agent.updatedAt = new Date();

      this.data.agents[index] = agent;
      this.updateIndices(agent);
      this.data.lastUpdate = new Date();

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: AgentEventType.UPDATED,
        timestamp: new Date(),
        source: 'registry',
        data: {
          agentId: agent.id,
          previousStatus,
          currentStatus: agent.status
        }
      });

      return agent;
    } catch (error) {
      throw this.handleError('UPDATE_AGENT', error);
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      const index = this.data.agents.findIndex(a => a.id === id);
      if (index === -1) {
        throw new Error(`Agent not found: ${id}`);
      }

      const agent = this.data.agents[index];
      this.data.agents.splice(index, 1);
      this.removeFromIndices(agent);
      this.data.lastUpdate = new Date();

      await this.eventEmitter.emit({
        id: uuidv4(),
        type: AgentEventType.DELETED,
        timestamp: new Date(),
        source: 'registry',
        data: {
          agentId: id,
          currentStatus: agent.status
        }
      });
    } catch (error) {
      throw this.handleError('DELETE_AGENT', error);
    }
  }

  async queryAgents(query: AgentQuery): Promise<{ agents: Agent[]; total: number }> {
    try {
      let filteredAgents = [...this.data.agents];

      // Apply filters
      if (query.type) {
        filteredAgents = filteredAgents.filter(a => a.config.type === query.type);
      }
      if (query.status) {
        filteredAgents = filteredAgents.filter(a => a.status === query.status);
      }
      if (query.tags?.length) {
        filteredAgents = filteredAgents.filter(a => 
          query.tags!.every(tag => a.metadata.tags.includes(tag))
        );
      }
      if (query.capabilities?.length) {
        filteredAgents = filteredAgents.filter(a =>
          query.capabilities!.every(cap => a.config.capabilities.includes(cap))
        );
      }
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        filteredAgents = filteredAgents.filter(a =>
          a.config.name.toLowerCase().includes(searchLower) ||
          a.config.description?.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination
      const start = (query.page - 1) * query.limit;
      const end = start + query.limit;
      const paginatedAgents = filteredAgents.slice(start, end);

      return {
        agents: paginatedAgents,
        total: filteredAgents.length
      };
    } catch (error) {
      throw this.handleError('QUERY_AGENTS', error);
    }
  }

  // Registry operations
  async getStats(): Promise<RegistryStats> {
    try {
      const stats: RegistryStats = {
        totalAgents: this.data.agents.length,
        runningAgents: this.data.agents.filter(a => a.status === AgentStatus.RUNNING).length,
        stoppedAgents: this.data.agents.filter(a => a.status === AgentStatus.STOPPED).length,
        pausedAgents: this.data.agents.filter(a => a.status === AgentStatus.PAUSED).length,
        failedAgents: this.data.agents.filter(a => a.status === AgentStatus.ERROR).length,
        totalTemplates: this.data.templates.length,
        templateCategories: {},
        lastUpdateTime: this.data.lastUpdate,
        mostUsedTemplates: [],
        agentsByTag: {}
      };

      // Calculate template categories
      this.data.templates.forEach(template => {
        const category = template.metadata.category;
        stats.templateCategories[category] = (stats.templateCategories[category] || 0) + 1;
      });

      // Calculate most used templates
      const templateUsage = new Map<string, number>();
      this.data.agents.forEach(agent => {
        const count = templateUsage.get(agent.config.templateId) || 0;
        templateUsage.set(agent.config.templateId, count + 1);
      });

      stats.mostUsedTemplates = Array.from(templateUsage.entries())
        .map(([templateId, count]) => ({ templateId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate agents by tag
      this.data.agents.forEach(agent => {
        agent.metadata.tags.forEach(tag => {
          stats.agentsByTag[tag] = (stats.agentsByTag[tag] || 0) + 1;
        });
      });

      return stats;
    } catch (error) {
      throw this.handleError('GET_STATS', error);
    }
  }

  // Private helper methods
  private updateIndices(agent: Agent): void {
    // Update type index
    const typeIndex = this.getOrCreateIndex('type');
    const typeKey = agent.config.type;
    if (!typeIndex[typeKey]) {
      typeIndex[typeKey] = [];
    }
    typeIndex[typeKey].push(agent);

    // Update status index
    const statusIndex = this.getOrCreateIndex('status');
    const statusKey = agent.status;
    if (!statusIndex[statusKey]) {
      statusIndex[statusKey] = [];
    }
    statusIndex[statusKey].push(agent);

    // Update tag index
    const tagIndex = this.getOrCreateIndex('tags');
    agent.metadata.tags.forEach(tag => {
      if (!tagIndex[tag]) {
        tagIndex[tag] = [];
      }
      tagIndex[tag].push(agent);
    });
  }

  private removeFromIndices(agent: Agent): void {
    // Remove from type index
    const typeIndex = this.getOrCreateIndex('type');
    if (typeIndex[agent.config.type]) {
      typeIndex[agent.config.type] = typeIndex[agent.config.type].filter(a => a.id !== agent.id);
    }

    // Remove from status index
    const statusIndex = this.getOrCreateIndex('status');
    if (statusIndex[agent.status]) {
      statusIndex[agent.status] = statusIndex[agent.status].filter(a => a.id !== agent.id);
    }

    // Remove from tag index
    const tagIndex = this.getOrCreateIndex('tags');
    agent.metadata.tags.forEach(tag => {
      if (tagIndex[tag]) {
        tagIndex[tag] = tagIndex[tag].filter(a => a.id !== agent.id);
      }
    });
  }

  private getOrCreateIndex(name: string): RegistryIndex<Agent> {
    if (!this.indices.has(name)) {
      this.indices.set(name, {});
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