# n8n Meta-Agent System

A powerful meta-agent system for orchestrating n8n workflows with MCP (Model Context Protocol) integration, built with TypeScript. This system enables intelligent workflow automation by combining n8n's extensive integration capabilities with advanced AI features.

## 🌟 Current Status: Alpha Development

This project is currently in active development, focusing on core functionality and n8n integration. We're working closely with the n8n ecosystem to provide a seamless experience for workflow automation with AI capabilities.

See our [ROADMAP.md](ROADMAP.md) for detailed development plans and [DEVELOPMENT.md](DEVELOPMENT.md) for technical details.

## Overview

The n8n Meta-Agent system provides a bridge between n8n's workflow automation platform and AI-powered agents. It leverages the Model Context Protocol (MCP) to enable seamless integration with various AI models and tools while maintaining security and control over your automation workflows.

### Working with n8n

This system is designed to work alongside a running n8n instance:
- Uses n8n's API for workflow management
- Extends n8n's capabilities with AI features
- Integrates with n8n's AI Starter Kit components
- Maintains compatibility with n8n's workflow format

## Features

- **MCP Integration**
  - Full Model Context Protocol support
  - Secure tool and resource management
  - AI model integration capabilities
  - Real-time streaming results
  - Interactive workflow support

- **Agent Management**
  - Create, start, stop, pause, and resume agents
  - Template-based agent creation
  - Hierarchical agent systems
  - Dependency management between agents
  - Resource allocation and monitoring

- **Template Management**
  - Create and manage workflow templates
  - Version control and compatibility checking
  - Parameter validation with schema enforcement
  - Template marketplace integration
  - Backup and restore capabilities

- **AI Capabilities**
  - Local LLM integration via Ollama
  - Vector storage with Qdrant
  - PDF processing and analysis
  - Natural language task creation
  - Intelligent error handling

- **Security & Monitoring**
  - Role-based access control
  - Audit logging and tracking
  - Secure credential storage
  - Resource usage monitoring
  - Performance analytics

- **Task Management**
  - Priority-based task queuing
  - Task dependency resolution
  - Automatic retry mechanisms
  - Task status monitoring

- **Resource Management**
  - CPU, memory, and network resource allocation
  - Automatic resource optimization
  - Resource contention handling

- **State Management**
  - Event sourcing for state tracking
  - Transaction support
  - State checkpointing
  - State restoration capabilities

- **Event System**
  - Event-based communication
  - Event filtering and routing
  - Event batching
  - Event statistics

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- n8n instance running and accessible
- Ollama (optional, for local LLM support)
- Qdrant (optional, for vector storage)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/rogu3bear/n8n-meta-agent.git
   cd n8n-meta-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure n8n connection:
   - Create a `.env` file in the root directory
   - Add your n8n configuration:
     ```
     N8N_URL=http://your-n8n-instance:5678
     N8N_API_KEY=your-api-key
     OLLAMA_URL=http://localhost:11434  # Optional
     QDRANT_URL=http://localhost:6333   # Optional
     ```

## Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Lint code:
   ```bash
   npm run lint
   ```

4. Format code:
   ```bash
   npm run format
   ```

## Building

1. Build the application:
   ```bash
   npm run build
   ```

2. The built application will be available in the `release` directory.

## Usage

1. Start the application:
   ```bash
   npm start
   ```

2. Create an agent template:
   ```typescript
   const template = {
     id: 'ai-workflow-1',
     name: 'Document Processing Agent',
     type: 'ai-workflow',
     parameters: {
       inputDocument: {
         type: 'file',
         required: true,
         description: 'PDF document to process'
       },
       outputFormat: {
         type: 'string',
         enum: ['summary', 'analysis', 'extraction'],
         default: 'summary'
       }
     }
   };
   ```

3. Create an agent from the template:
   ```typescript
   const agent = await orchestrationEngine.createAgent(template, {
     inputDocument: '/path/to/document.pdf',
     outputFormat: 'analysis'
   });
   ```

4. Start the agent:
   ```typescript
   await orchestrationEngine.startAgent(agent.id, 'user-1');
   ```

## Architecture

The system follows a modular architecture with MCP integration:

```
src/
├── main.ts                    # Main entry point
├── services/                  # Core services
│   ├── n8n/                  # n8n Integration
│   │   ├── N8nIntegration.ts
│   │   └── TemplateParser.ts
│   ├── template/             # Template Management
│   │   ├── TemplateStorage.ts
│   │   ├── TemplateRenderer.ts
│   │   └── TemplateAPI.ts
│   ├── wrapper/              # MCP Integration
│   │   ├── WrapperInterface.ts
│   │   └── __tests__/
│   ├── registry/             # Agent Registry
│   │   ├── AgentRegistry.ts
│   │   └── RegistryFactory.ts
│   └── core/                 # Core Services
│       ├── orchestrationEngine.ts
│       ├── stateManager.ts
│       └── eventBus.ts
├── types/                    # Type definitions
└── tests/                    # Test suites
```

## Quick Start with n8n

1. **Set Up n8n**
   ```bash
   # Option 1: Use n8n AI Starter Kit (Recommended)
   git clone https://github.com/n8n-io/ai-starter-kit
   cd ai-starter-kit
   docker-compose up -d

   # Option 2: Standalone n8n
   npm install n8n -g
   n8n start
   ```

2. **Install Meta-Agent**
   ```bash
   git clone https://github.com/rogu3bear/n8n-meta-agent.git
   cd n8n-meta-agent
   npm install
   ```

3. **Configure Integration**
   ```bash
   cp .env.example .env
   # Edit .env with your n8n details
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## Usage Examples

### Creating an AI-powered Workflow

```typescript
const template = {
  id: 'ai-workflow-1',
  name: 'Document Processing Agent',
  type: 'ai-workflow',
  parameters: {
    inputDocument: {
      type: 'file',
      required: true,
      description: 'PDF document to process'
    },
    outputFormat: {
      type: 'string',
      enum: ['summary', 'analysis', 'extraction'],
      default: 'summary'
    }
  }
};

const agent = await orchestrationEngine.createAgent(template, {
  inputDocument: '/path/to/document.pdf',
  outputFormat: 'analysis'
});
```

### Using MCP Tools

```typescript
const mcpTool = await wrapperInterface.createTool({
  name: 'documentAnalyzer',
  description: 'Analyzes documents using AI',
  inputSchema: {
    type: 'object',
    properties: {
      document: { type: 'string' },
      analysisType: { type: 'string' }
    }
  }
});

const result = await mcpTool.execute({
  document: documentContent,
  analysisType: 'sentiment'
});
```

## Integration Examples

### Basic Workflow Creation

```typescript
// Create a simple n8n workflow with AI capabilities
const workflow = await n8nIntegration.createWorkflow({
  name: 'AI-Powered Data Processing',
  nodes: [
    {
      type: 'n8n-nodes-base.httpRequest',
      parameters: {
        url: 'https://api.example.com/data'
      }
    },
    {
      type: 'n8n-nodes-base.function',
      parameters: {
        functionCode: 'return await $ai.analyze(items[0].json);'
      }
    }
  ]
});
```

### Using AI Templates

```typescript
// Create an AI-powered workflow from a template
const template = await templateStorage.getTemplate('document-analysis');
const workflow = await n8nIntegration.createFromTemplate(template, {
  inputDocument: '/path/to/document.pdf',
  analysisType: 'sentiment'
});
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details. Key areas for contribution:

- Additional AI model integrations
- New workflow templates
- Performance improvements
- Documentation enhancements
- Bug fixes and testing

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [AI Starter Kit Guide](https://docs.n8n.io/hosting/starter-kits/ai-starter-kit/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [n8n](https://n8n.io/) - Workflow automation platform
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI integration protocol
- [Ollama](https://ollama.ai/) - Local LLM platform
- [Qdrant](https://qdrant.tech/) - Vector database 