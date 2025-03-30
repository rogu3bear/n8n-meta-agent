# Development Guide

## Local Development Setup

### Prerequisites

1. **n8n Instance**
   - You need a running n8n instance (local or cloud)
   - Recommended: Use the [n8n AI Starter Kit](https://docs.n8n.io/hosting/starter-kits/ai-starter-kit/)
   - Minimum version: n8n v1.0.0

2. **Development Environment**
   - Node.js v16+
   - npm v7+
   - TypeScript 4.9+
   - Git

3. **Optional Components**
   - Ollama for local LLM support
   - Qdrant for vector storage
   - PostgreSQL for data persistence

### Setting Up Your Development Environment

1. **Clone and Install**
   ```bash
   git clone https://github.com/rogu3bear/n8n-meta-agent.git
   cd n8n-meta-agent
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start n8n**
   ```bash
   # If using AI Starter Kit
   docker-compose up -d
   
   # Or standalone n8n
   n8n start
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── services/              # Core services
│   ├── n8n/              # n8n Integration
│   ├── template/         # Template Management
│   ├── wrapper/          # MCP Integration
│   └── registry/         # Agent Registry
├── types/                # TypeScript types
└── tests/               # Test suites
```

## Key Components

### N8n Integration

The `N8nIntegration` service manages all interaction with n8n:
- Workflow creation and management
- Execution monitoring
- Error handling
- Resource management

### Template System

Templates define reusable workflow patterns:
- Version control
- Parameter validation
- Dependency management
- Marketplace integration

### MCP Integration

The Model Context Protocol integration enables:
- AI model communication
- Tool management
- Resource sharing
- Security controls

## Development Workflow

1. **Feature Development**
   - Create feature branch
   - Implement changes
   - Add tests
   - Update documentation

2. **Testing**
   ```bash
   # Run all tests
   npm test
   
   # Run specific test suite
   npm test -- services/n8n
   ```

3. **Code Quality**
   ```bash
   # Lint code
   npm run lint
   
   # Format code
   npm run format
   ```

4. **Documentation**
   - Update relevant docs
   - Add JSDoc comments
   - Update README if needed

## Debugging

### Common Issues

1. **n8n Connection**
   - Check n8n is running
   - Verify API key
   - Check network access

2. **MCP Integration**
   - Verify MCP server status
   - Check tool configurations
   - Monitor resource usage

3. **Template Issues**
   - Validate JSON schema
   - Check version compatibility
   - Verify dependencies

### Logging

Configure log levels in `.env`:
```env
LOG_LEVEL=debug # or info, warn, error
```

View logs:
```bash
npm run logs
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/) 