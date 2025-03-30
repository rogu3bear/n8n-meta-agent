import { app, BrowserWindow, ipcMain } from 'electron';
import { OrchestrationEngine } from './services/orchestrationEngine';
import { StateManager } from './services/stateManager';
import { SecurityManager } from './services/securityManager';
import { EventBus } from './services/eventBus';
import { ResourceManager } from './services/resourceManager';
import { TaskManager } from './services/taskManager';
import { AgentRegistry } from './services/agentRegistry';
import { TemplateValidator } from './services/templateValidator';
import { N8nIntegrationManager } from './services/n8nIntegration';
import { OrchestrationEvent } from './types/orchestration';

class Application {
  private mainWindow: BrowserWindow | null;
  private orchestrationEngine: OrchestrationEngine;
  private isShuttingDown: boolean;

  constructor() {
    this.mainWindow = null;
    this.orchestrationEngine = new OrchestrationEngine();
    this.isShuttingDown = false;
  }

  public async start(): Promise<void> {
    try {
      // Initialize Electron app
      await app.whenReady();
      this.setupIpcHandlers();
      this.createMainWindow();

      // Initialize orchestration engine
      await this.orchestrationEngine.initialize();

      // Set up event listeners
      this.setupEventListeners();

      // Handle app lifecycle
      this.handleAppLifecycle();
    } catch (error) {
      console.error('Failed to start application:', error);
      app.quit();
    }
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Load the main HTML file
    this.mainWindow.loadFile('dist/renderer/index.html');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    // Handle window close
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIpcHandlers(): void {
    // Agent management
    ipcMain.handle('createAgent', this.handleCreateAgent.bind(this));
    ipcMain.handle('startAgent', this.handleStartAgent.bind(this));
    ipcMain.handle('stopAgent', this.handleStopAgent.bind(this));
    ipcMain.handle('pauseAgent', this.handlePauseAgent.bind(this));
    ipcMain.handle('resumeAgent', this.handleResumeAgent.bind(this));

    // Template management
    ipcMain.handle('createTemplate', this.handleCreateTemplate.bind(this));
    ipcMain.handle('updateTemplate', this.handleUpdateTemplate.bind(this));
    ipcMain.handle('deleteTemplate', this.handleDeleteTemplate.bind(this));

    // Task management
    ipcMain.handle('submitTask', this.handleSubmitTask.bind(this));
    ipcMain.handle('cancelTask', this.handleCancelTask.bind(this));
    ipcMain.handle('getTaskStatus', this.handleGetTaskStatus.bind(this));

    // Resource management
    ipcMain.handle('getResourceStatus', this.handleGetResourceStatus.bind(this));
    ipcMain.handle('optimizeResources', this.handleOptimizeResources.bind(this));

    // State management
    ipcMain.handle('getState', this.handleGetState.bind(this));
    ipcMain.handle('restoreState', this.handleRestoreState.bind(this));

    // Security management
    ipcMain.handle('checkAccess', this.handleCheckAccess.bind(this));
    ipcMain.handle('grantAccess', this.handleGrantAccess.bind(this));
    ipcMain.handle('revokeAccess', this.handleRevokeAccess.bind(this));
  }

  private setupEventListeners(): void {
    // Listen for orchestration events
    this.orchestrationEngine.on('initialized', this.handleEngineInitialized.bind(this));
    this.orchestrationEngine.on('cleanupComplete', this.handleEngineCleanup.bind(this));
    this.orchestrationEngine.on('resourceWarning', this.handleResourceWarning.bind(this));
    this.orchestrationEngine.on('taskCreated', this.handleTaskCreated.bind(this));
    this.orchestrationEngine.on('taskCompleted', this.handleTaskCompleted.bind(this));
    this.orchestrationEngine.on('taskFailed', this.handleTaskFailed.bind(this));
  }

  private handleAppLifecycle(): void {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.shutdown();
      }
    });

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.createMainWindow();
      }
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      // Clean up orchestration engine
      await this.orchestrationEngine.cleanup();

      // Close main window
      if (this.mainWindow) {
        this.mainWindow.close();
      }

      // Quit app
      app.quit();
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // IPC Handlers

  private async handleCreateAgent(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<any> {
    const [template, parameters, userId] = args;
    return this.orchestrationEngine.createAgent(template, parameters, userId);
  }

  private async handleStartAgent(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [agentId, userId] = args;
    return this.orchestrationEngine.startAgent(agentId, userId);
  }

  private async handleStopAgent(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [agentId, userId] = args;
    return this.orchestrationEngine.stopAgent(agentId, userId);
  }

  private async handlePauseAgent(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [agentId, userId] = args;
    // Implement pause functionality
  }

  private async handleResumeAgent(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [agentId, userId] = args;
    // Implement resume functionality
  }

  private async handleCreateTemplate(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<any> {
    const [template, userId] = args;
    // Implement template creation
  }

  private async handleUpdateTemplate(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [templateId, updates, userId] = args;
    // Implement template updates
  }

  private async handleDeleteTemplate(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [templateId, userId] = args;
    // Implement template deletion
  }

  private async handleSubmitTask(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<any> {
    const [agentId, type, parameters, options, userId] = args;
    // Implement task submission
  }

  private async handleCancelTask(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [taskId, userId] = args;
    // Implement task cancellation
  }

  private async handleGetTaskStatus(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<any> {
    const [taskId] = args;
    // Implement task status retrieval
  }

  private async handleGetResourceStatus(event: Electron.IpcMainInvokeEvent): Promise<any> {
    // Implement resource status retrieval
  }

  private async handleOptimizeResources(event: Electron.IpcMainInvokeEvent): Promise<void> {
    // Implement resource optimization
  }

  private async handleGetState(event: Electron.IpcMainInvokeEvent): Promise<any> {
    // Implement state retrieval
  }

  private async handleRestoreState(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [snapshotId] = args;
    // Implement state restoration
  }

  private async handleCheckAccess(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<boolean> {
    const [userId, resourceId, resourceType, permission] = args;
    // Implement access checking
    return false;
  }

  private async handleGrantAccess(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [userId, resourceId, resourceType, permissions] = args;
    // Implement access granting
  }

  private async handleRevokeAccess(event: Electron.IpcMainInvokeEvent, ...args: any[]): Promise<void> {
    const [userId, resourceId, permissions] = args;
    // Implement access revocation
  }

  // Event Handlers

  private handleEngineInitialized(event: OrchestrationEvent): void {
    this.sendToRenderer('engineInitialized', event);
  }

  private handleEngineCleanup(event: OrchestrationEvent): void {
    this.sendToRenderer('engineCleanupComplete', event);
  }

  private handleResourceWarning(event: OrchestrationEvent): void {
    this.sendToRenderer('resourceWarning', event);
  }

  private handleTaskCreated(event: OrchestrationEvent): void {
    this.sendToRenderer('taskCreated', event);
  }

  private handleTaskCompleted(event: OrchestrationEvent): void {
    this.sendToRenderer('taskCompleted', event);
  }

  private handleTaskFailed(event: OrchestrationEvent): void {
    this.sendToRenderer('taskFailed', event);
  }

  // Helper Methods

  private sendToRenderer(channel: string, data: any): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

// Start the application
const application = new Application();
application.start().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
}); 