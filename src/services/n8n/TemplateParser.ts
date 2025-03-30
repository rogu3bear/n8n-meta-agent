import { Template, TemplateVersion } from '../../types/template';
import { N8nNode, N8nConnection } from './N8nIntegration';
import { z } from 'zod';

// Schema for template content
const NodeSchema = z.object({
  type: z.string(),
  name: z.string(),
  parameters: z.record(z.any()),
  position: z.tuple([z.number(), z.number()]),
  credentials: z.record(z.any()).optional()
});

const ConnectionSchema = z.object({
  from: z.object({
    node: z.string(),
    index: z.number()
  }),
  to: z.object({
    node: z.string(),
    index: z.number()
  })
});

const TemplateContentSchema = z.object({
  nodes: z.array(NodeSchema),
  connections: z.array(ConnectionSchema)
});

export class TemplateParser {
  /**
   * Parses template content into n8n nodes and connections
   */
  public static parseTemplateContent(
    template: Template,
    version: TemplateVersion,
    parameters: Record<string, any>
  ): { nodes: N8nNode[]; connections: N8nConnection[] } {
    try {
      // Parse template content
      const content = JSON.parse(version.content);
      const validatedContent = TemplateContentSchema.parse(content);

      // Process nodes
      const nodes = validatedContent.nodes.map(node => ({
        ...node,
        id: this.generateNodeId(template.id, node.name),
        parameters: this.processNodeParameters(node.parameters, parameters)
      }));

      // Process connections
      const connections = validatedContent.connections.map(conn => ({
        from: {
          node: this.generateNodeId(template.id, conn.from.node),
          index: conn.from.index
        },
        to: {
          node: this.generateNodeId(template.id, conn.to.node),
          index: conn.to.index
        }
      }));

      return { nodes, connections };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid template content: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(`Failed to parse template content: ${error.message}`);
    }
  }

  /**
   * Processes node parameters, replacing placeholders with actual values
   */
  private static processNodeParameters(
    parameters: Record<string, any>,
    templateParameters: Record<string, any>
  ): Record<string, any> {
    const processed: Record<string, any> = {};

    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // Extract parameter name from placeholder
        const paramName = value.slice(2, -2).trim();
        if (paramName in templateParameters) {
          processed[key] = templateParameters[paramName];
        } else {
          processed[key] = value; // Keep original if parameter not found
        }
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * Generates a unique node ID based on template ID and node name
   */
  private static generateNodeId(templateId: string, nodeName: string): string {
    return `${templateId}-${nodeName.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * Validates template content against schema
   */
  public static validateTemplateContent(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      TemplateContentSchema.parse(parsed);
      return true;
    } catch (error) {
      return false;
    }
  }
} 