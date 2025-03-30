# Template Management System

A robust and flexible template management system for the registry, providing comprehensive functionality for creating, managing, and versioning templates.

## Features

- **Template Management**
  - Create, read, update, and delete templates
  - Version control with semantic versioning
  - Parameter validation and type checking
  - Dependency management
  - Capability definitions

- **Search and Filtering**
  - Filter by type, category, tags, and capabilities
  - Full-text search
  - Pagination support
  - Sorting options

- **Backup and Recovery**
  - Automatic backup creation
  - Manual backup triggers
  - Backup restoration
  - Backup listing and management

- **Statistics and Monitoring**
  - Template usage statistics
  - Version distribution
  - Storage metrics
  - Performance monitoring

## Architecture

The template system consists of several key components:

### Core Components

1. **TemplateManager**
   - Handles template CRUD operations
   - Manages template versions
   - Validates template data
   - Emits events for template lifecycle

2. **TemplateStorage**
   - Persists templates to disk
   - Manages caching
   - Handles backup operations
   - Provides storage statistics

3. **TemplateValidationService**
   - Validates template structure
   - Checks parameter types
   - Verifies dependencies
   - Ensures version compatibility

4. **TemplateAPI**
   - RESTful API endpoints
   - Request validation
   - Error handling
   - Response formatting

### Data Models

1. **Template**
   ```typescript
   {
     id: string;
     name: string;
     description: string;
     type: string;
     currentVersion: string;
     versions: TemplateVersion[];
     metadata: TemplateMetadata;
     createdAt: Date;
     updatedAt: Date;
   }
   ```

2. **TemplateVersion**
   ```typescript
   {
     version: string;
     changelog: string;
     compatibility: Record<string, any>;
     parameters: TemplateParameter[];
     dependencies: TemplateDependency[];
     capabilities: TemplateCapability[];
     deprecated: boolean;
   }
   ```

3. **TemplateParameter**
   ```typescript
   {
     name: string;
     type: string;
     description: string;
     required?: boolean;
     default?: any;
     pattern?: string;
     min?: number;
     max?: number;
     enum?: any[];
   }
   ```

## API Endpoints

### Templates

- `POST /api/v1/templates` - Create a new template
- `GET /api/v1/templates` - List templates with filtering
- `GET /api/v1/templates/:id` - Get template by ID
- `PUT /api/v1/templates/:id` - Update template
- `DELETE /api/v1/templates/:id` - Delete template

### Template Versions

- `POST /api/v1/templates/:id/versions` - Add new version
- `PUT /api/v1/templates/:id/versions/:version/deprecate` - Deprecate version

### Backups

- `POST /api/v1/backups` - Create backup
- `GET /api/v1/backups` - List backups
- `POST /api/v1/backups/:timestamp/restore` - Restore backup

### Statistics

- `GET /api/v1/stats` - Get storage statistics

## Usage Examples

### Creating a Template

```typescript
const template = {
  name: "My Template",
  description: "A sample template",
  type: "sample",
  parameters: [
    {
      name: "param1",
      type: "string",
      description: "First parameter",
      required: true
    }
  ],
  dependencies: [
    {
      name: "dep1",
      version: "1.0.0",
      type: "runtime",
      description: "Required dependency"
    }
  ],
  capabilities: [
    {
      name: "cap1",
      description: "Sample capability",
      parameters: ["param1"],
      requiredPermissions: ["dep1"]
    }
  ],
  metadata: {
    author: "John Doe",
    category: "Sample",
    tags: ["sample", "test"],
    license: "MIT",
    repository: "https://github.com/example/template",
    documentation: "https://docs.example.com/template",
    examples: ["example1", "example2"]
  }
};

const response = await fetch('/api/v1/templates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(template)
});
```

### Adding a Version

```typescript
const version = {
  changelog: "Added new parameter",
  compatibility: {
    minVersion: "1.0.0"
  },
  parameters: [
    {
      name: "param1",
      type: "string",
      description: "First parameter",
      required: true
    },
    {
      name: "param2",
      type: "number",
      description: "New parameter",
      required: false
    }
  ],
  dependencies: [],
  capabilities: [],
  deprecated: false
};

const response = await fetch('/api/v1/templates/template-id/versions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(version)
});
```

## Error Handling

The API uses standard HTTP status codes and returns detailed error messages:

```typescript
{
  error: string;      // Error code
  message: string;    // Human-readable message
  timestamp: string;  // Error timestamp
  details?: object;   // Additional error details
}
```

Common error codes:
- `VALIDATION_ERROR` - Invalid request data
- `TEMPLATE_NOT_FOUND` - Template does not exist
- `VERSION_NOT_FOUND` - Version does not exist
- `BACKUP_NOT_FOUND` - Backup does not exist
- `INTERNAL_ERROR` - Server error

## Best Practices

1. **Version Management**
   - Use semantic versioning
   - Document changes in changelog
   - Maintain backward compatibility
   - Deprecate old versions properly

2. **Parameter Design**
   - Use clear, descriptive names
   - Provide detailed descriptions
   - Set appropriate defaults
   - Validate input thoroughly

3. **Dependency Management**
   - Specify exact versions
   - Document dependency types
   - Handle circular dependencies
   - Validate compatibility

4. **Backup Strategy**
   - Regular automatic backups
   - Manual backup before major changes
   - Test backup restoration
   - Monitor backup size

5. **Performance**
   - Use caching effectively
   - Optimize queries
   - Monitor resource usage
   - Handle large datasets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

## License

MIT License - see LICENSE file for details 