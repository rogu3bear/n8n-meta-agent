import { EventEmitter } from 'events';
import { OrchestrationEvent } from '../types/orchestration';

interface ResourceMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
}

interface ResourceLimits {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
}

interface ResourceAllocation {
  id: string;
  agentId: string;
  resources: ResourceMetrics;
  startTime: Date;
  endTime?: Date;
}

export class ResourceManager extends EventEmitter {
  private allocations: Map<string, ResourceAllocation>;
  private metrics: ResourceMetrics;
  private limits: ResourceLimits;
  private monitoringInterval: NodeJS.Timeout | null;
  private readonly DEFAULT_MONITORING_INTERVAL = 5000; // 5 seconds

  constructor(limits: ResourceLimits) {
    super();
    this.allocations = new Map();
    this.metrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: {
        in: 0,
        out: 0
      }
    };
    this.limits = limits;
    this.monitoringInterval = null;
  }

  // Resource Allocation

  public async allocateResources(
    agentId: string,
    requestedResources: Partial<ResourceMetrics>
  ): Promise<ResourceAllocation> {
    // Check if resources are available
    if (!this.hasAvailableResources(requestedResources)) {
      throw new Error('Insufficient resources available');
    }

    // Create allocation
    const allocation: ResourceAllocation = {
      id: Math.random().toString(36).substring(7),
      agentId,
      resources: this.normalizeResourceRequest(requestedResources),
      startTime: new Date()
    };

    // Update metrics
    this.updateMetrics(allocation.resources, true);
    this.allocations.set(allocation.id, allocation);

    // Emit allocation event
    this.emit('resourceAllocated', {
      type: 'resource.allocated',
      timestamp: new Date(),
      payload: allocation
    });

    return allocation;
  }

  public async deallocateResources(allocationId: string): Promise<void> {
    const allocation = this.allocations.get(allocationId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Update metrics
    this.updateMetrics(allocation.resources, false);
    allocation.endTime = new Date();

    // Emit deallocation event
    this.emit('resourceDeallocated', {
      type: 'resource.deallocated',
      timestamp: new Date(),
      payload: allocation
    });
  }

  // Resource Monitoring

  public startMonitoring(interval: number = this.DEFAULT_MONITORING_INTERVAL): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect current resource usage
      const currentMetrics = await this.getCurrentResourceUsage();
      
      // Update metrics
      this.metrics = currentMetrics;

      // Emit metrics event
      this.emit('metricsCollected', {
        type: 'resource.metrics',
        timestamp: new Date(),
        payload: currentMetrics
      });

      // Check for resource constraints
      this.checkResourceConstraints(currentMetrics);
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  // Resource Optimization

  public async optimizeResources(): Promise<void> {
    const currentMetrics = await this.getCurrentResourceUsage();
    
    // Check for underutilized resources
    if (this.isUnderutilized(currentMetrics)) {
      await this.rebalanceResources();
    }

    // Check for overutilized resources
    if (this.isOverutilized(currentMetrics)) {
      await this.handleResourceContention();
    }
  }

  private async rebalanceResources(): Promise<void> {
    // Implement resource rebalancing logic
    // This could involve:
    // 1. Identifying underutilized allocations
    // 2. Consolidating resources
    // 3. Adjusting allocation limits
  }

  private async handleResourceContention(): Promise<void> {
    // Implement resource contention handling
    // This could involve:
    // 1. Identifying resource bottlenecks
    // 2. Prioritizing critical allocations
    // 3. Implementing resource quotas
  }

  // Resource Validation

  private hasAvailableResources(requested: Partial<ResourceMetrics>): boolean {
    const normalized = this.normalizeResourceRequest(requested);
    
    return (
      this.metrics.cpu + normalized.cpu <= this.limits.cpu &&
      this.metrics.memory + normalized.memory <= this.limits.memory &&
      this.metrics.disk + normalized.disk <= this.limits.disk &&
      this.metrics.network.in + normalized.network.in <= this.limits.network.in &&
      this.metrics.network.out + normalized.network.out <= this.limits.network.out
    );
  }

  private normalizeResourceRequest(
    requested: Partial<ResourceMetrics>
  ): ResourceMetrics {
    return {
      cpu: requested.cpu || 0,
      memory: requested.memory || 0,
      disk: requested.disk || 0,
      network: {
        in: requested.network?.in || 0,
        out: requested.network?.out || 0
      }
    };
  }

  // Resource Usage Analysis

  private isUnderutilized(metrics: ResourceMetrics): boolean {
    const utilizationThreshold = 0.3; // 30% utilization threshold

    return (
      metrics.cpu / this.limits.cpu < utilizationThreshold ||
      metrics.memory / this.limits.memory < utilizationThreshold ||
      metrics.disk / this.limits.disk < utilizationThreshold
    );
  }

  private isOverutilized(metrics: ResourceMetrics): boolean {
    const utilizationThreshold = 0.8; // 80% utilization threshold

    return (
      metrics.cpu / this.limits.cpu > utilizationThreshold ||
      metrics.memory / this.limits.memory > utilizationThreshold ||
      metrics.disk / this.limits.disk > utilizationThreshold
    );
  }

  // Resource Metrics

  private async getCurrentResourceUsage(): Promise<ResourceMetrics> {
    // Implement actual resource usage collection
    // This would typically involve:
    // 1. Using system APIs to get CPU usage
    // 2. Monitoring memory consumption
    // 3. Tracking disk I/O
    // 4. Measuring network traffic

    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: {
        in: 0,
        out: 0
      }
    };
  }

  private updateMetrics(resources: ResourceMetrics, isAllocation: boolean): void {
    const multiplier = isAllocation ? 1 : -1;

    this.metrics.cpu += resources.cpu * multiplier;
    this.metrics.memory += resources.memory * multiplier;
    this.metrics.disk += resources.disk * multiplier;
    this.metrics.network.in += resources.network.in * multiplier;
    this.metrics.network.out += resources.network.out * multiplier;
  }

  private checkResourceConstraints(metrics: ResourceMetrics): void {
    if (this.isOverutilized(metrics)) {
      this.emit('resourceWarning', {
        type: 'resource.warning',
        timestamp: new Date(),
        payload: {
          metrics,
          limits: this.limits
        }
      });
    }
  }

  // Resource Reporting

  public getResourceReport(): {
    currentUsage: ResourceMetrics;
    allocations: ResourceAllocation[];
    limits: ResourceLimits;
  } {
    return {
      currentUsage: { ...this.metrics },
      allocations: Array.from(this.allocations.values()),
      limits: { ...this.limits }
    };
  }

  // Cleanup

  public async cleanup(): Promise<void> {
    this.stopMonitoring();
    this.allocations.clear();
    this.metrics = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: {
        in: 0,
        out: 0
      }
    };
  }
}

export default ResourceManager; 