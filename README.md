# n8n Meta-Agent System

A powerful meta-agent system for orchestrating n8n workflows, built with Electron and TypeScript.

## Features

- **Agent Management**
  - Create, start, stop, pause, and resume agents
  - Template-based agent creation
  - Dependency management between agents
  - Resource allocation and monitoring

- **Template Management**
  - Create and manage agent templates
  - Version control for templates
  - Parameter validation and schema enforcement
  - Template compatibility checking

- **Task Management**
  - Priority-based task queuing
  - Task dependency resolution
  - Automatic retry mechanisms
  - Task status monitoring

- **Resource Management**
  - CPU, memory, and network resource allocation
  - Resource usage monitoring
  - Automatic resource optimization
  - Resource contention handling

- **State Management**
  - Event sourcing for state tracking
  - Transaction support
  - State checkpointing
  - State restoration capabilities

- **Security**
  - Role-based access control
  - Audit logging
  - Secure storage
  - Encryption for sensitive data

- **Event System**
  - Event-based communication
  - Event filtering and routing
  - Event batching
  - Event statistics

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- n8n instance running and accessible

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/n8n-meta-agent.git
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
     id: 'template-1',
     name: 'Data Processing Agent',
     version: '1.0.0',
     parameters: {
       inputSource: {
         type: 'string',
         required: true,
         description: 'Input data source URL'
       },
       outputDestination: {
         type: 'string',
         required: true,
         description: 'Output destination URL'
       }
     }
   };
   ```

3. Create an agent from the template:
   ```typescript
   const agent = await orchestrationEngine.createAgent(
     template,
     {
       inputSource: 'https://api.example.com/data',
       outputDestination: 'https://api.example.com/output'
     },
     'user-1'
   );
   ```

4. Start the agent:
   ```typescript
   await orchestrationEngine.startAgent(agent.id, 'user-1');
   ```

## Architecture

The system is built with a modular architecture:

```
src/
├── main.ts                 # Main entry point
├── services/              # Core services
│   ├── orchestrationEngine.ts
│   ├── agentRegistry.ts
│   ├── templateValidator.ts
│   ├── n8nIntegration.ts
│   ├── stateManager.ts
│   ├── securityManager.ts
│   ├── eventBus.ts
│   ├── resourceManager.ts
│   └── taskManager.ts
├── types/                 # Type definitions
│   ├── agent.ts
│   ├── template.ts
│   ├── registry.ts
│   └── orchestration.ts
└── renderer/             # UI components
    └── index.html
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [n8n](https://n8n.io/) - Workflow automation platform
- [Electron](https://www.electronjs.org/) - Cross-platform desktop application framework
- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types 