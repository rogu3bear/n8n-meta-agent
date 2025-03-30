import { Agent, AgentStatus } from '../../types/agent';
import { AgentTemplate, ParameterType } from '../../types/template';
import { v4 as uuidv4 } from 'uuid';

export class TestUtils {
  /**
   * Creates a mock agent template for testing
   */
  static createMockTemplate(overrides: Partial<AgentTemplate> = {}): AgentTemplate {
    return {
      id: uuidv4(),
      name: 'Test Template',
      description: 'A template for testing',
      version: '1.0.0',
      parameters: [
        {
          name: 'testParam',
          type: ParameterType.STRING,
          description: 'Test parameter',
          validation: {
            required: true,
            minLength: 3,
            maxLength: 50
          }
        }
      ],
      tags: ['test', 'mock'],
      workflows: {
        main: '{}' // Empty workflow JSON
      },
      ...overrides
    };
  }

  /**
   * Creates a mock agent for testing
   */
  static createMockAgent(overrides: Partial<Agent> = {}): Agent {
    return {
      id: uuidv4(),
      name: 'Test Agent',
      status: 'created' as AgentStatus,
      templateId: uuidv4(),
      version: '1.0.0',
      parameters: {
        testParam: 'test value'
      },
      tags: ['test', 'mock'],
      owner: 'test-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
      metadata: {},
      ...overrides
    };
  }

  /**
   * Creates a mock n8n workflow for testing
   */
  static createMockWorkflow(overrides: any = {}) {
    return {
      id: uuidv4(),
      name: 'Test Workflow',
      nodes: [
        {
          id: 'start',
          name: 'Start',
          type: 'n8n-nodes-base.start',
          position: [100, 300],
          parameters: {}
        }
      ],
      connections: {},
      active: true,
      ...overrides
    };
  }

  /**
   * Creates a mock n8n execution result for testing
   */
  static createMockExecutionResult(overrides: any = {}) {
    return {
      id: uuidv4(),
      finished: true,
      mode: 'manual',
      data: {
        resultData: {
          runData: {
            output: [{
              data: {
                success: true,
                data: { test: 'result' }
              }
            }]
          }
        }
      },
      status: 'success',
      startedAt: new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Delays execution for a specified time
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates a mock error for testing
   */
  static createMockError(message: string = 'Test error'): Error {
    return new Error(message);
  }

  /**
   * Generates a random string of specified length
   */
  static generateRandomString(length: number): string {
    return Math.random().toString(36).substring(2, length + 2);
  }

  /**
   * Creates a mock user credentials object for testing
   */
  static createMockUserCredentials(overrides: any = {}) {
    return {
      username: 'test-user',
      passwordHash: 'test-hash',
      salt: 'test-salt',
      roles: ['user'],
      apiKeys: [],
      failedLoginAttempts: 0,
      disabled: false,
      ...overrides
    };
  }

  /**
   * Creates a mock audit log entry for testing
   */
  static createMockAuditLog(overrides: any = {}) {
    return {
      id: uuidv4(),
      timestamp: new Date(),
      userId: 'test-user',
      action: 'test-action',
      resourceId: uuidv4(),
      resourceType: 'agent',
      details: {},
      ...overrides
    };
  }
}

export default TestUtils; 