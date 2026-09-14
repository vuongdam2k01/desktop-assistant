import { Type, type TSchema } from "typebox";
import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import type {
  ConnectorManifest,
  ToolDefinition,
  ManifestMetadata,
  ParameterSchema,
  ParameterPropertySchema,
} from "../types/manifest-types.js";
import type { ConnectorAdapter } from "../adapters/adapter-interface.js";

export interface GeneratedAgentTool extends AgentTool<any, any> {
  manifestMeta: ManifestMetadata;
}

/**
 * Converts parameter schema JSON to TypeBox TSchema
 */
export function convertSchemaToTypeBox(schema: ParameterSchema): TSchema {
  const properties: Record<string, any> = {};

  for (const [key, prop] of Object.entries(schema.properties || {})) {
    const isRequired = schema.required?.includes(key) ?? false;
    let propTypeBox: any;

    switch (prop.type) {
      case "string":
        propTypeBox = prop.enum
          ? Type.Union(prop.enum.map((v) => Type.Literal(v)), { description: prop.description })
          : Type.String({ description: prop.description });
        break;
      case "number":
        propTypeBox = Type.Number({ description: prop.description });
        break;
      case "boolean":
        propTypeBox = Type.Boolean({ description: prop.description });
        break;
      case "object":
        propTypeBox = Type.Record(Type.String(), Type.Any(), { description: prop.description });
        break;
      case "array":
        propTypeBox = Type.Array(Type.Any(), { description: prop.description });
        break;
      default:
        propTypeBox = Type.Any({ description: prop.description });
    }

    properties[key] = isRequired ? propTypeBox : Type.Optional(propTypeBox);
  }

  return Type.Object(properties);
}

/**
 * Generates an AgentTool for pi agent harness from a single ToolDefinition
 */
export function generateToolFromDefinition(
  manifest: ConnectorManifest,
  toolDef: ToolDefinition,
  adapter: ConnectorAdapter
): GeneratedAgentTool {
  const parameters = convertSchemaToTypeBox(toolDef.parameters);

  const manifestMeta: ManifestMetadata = {
    connectorId: manifest.id,
    connectorName: manifest.name,
    toolId: toolDef.id,
    category: toolDef.category,
    snapshot: toolDef.snapshot,
    compensation: toolDef.compensation,
    isIrreversible: Boolean(toolDef.irreversible),
    changesPermission: Boolean(toolDef.changes_permission),
    requiredCapability: toolDef.required_capability,
  };

  const baseTool: GeneratedAgentTool = {
    name: toolDef.name,
    label: toolDef.label,
    description: toolDef.description,
    parameters,
    manifestMeta,
    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal,
      _onUpdate?: AgentToolUpdateCallback<any>
    ): Promise<AgentToolResult<any>> => {
      const rawResult = await adapter.execute(toolDef.id, params, signal);
      return {
        content: [
          {
            type: "text",
            text: typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult, null, 2),
          },
        ],
        details: rawResult,
      };
    },
  };

  return baseTool;
}

/**
 * Tool Generator: generates dynamic tools from a ConnectorManifest and ConnectorAdapter
 */
export class ToolGenerator {
  static generateTools(
    manifest: ConnectorManifest,
    adapter: ConnectorAdapter
  ): GeneratedAgentTool[] {
    if (manifest.id !== adapter.connectorId) {
      throw new Error(
        `ToolGenerator: manifest id '${manifest.id}' does not match adapter connectorId '${adapter.connectorId}'`
      );
    }

    return manifest.tools.map((toolDef) =>
      generateToolFromDefinition(manifest, toolDef, adapter)
    );
  }
}
