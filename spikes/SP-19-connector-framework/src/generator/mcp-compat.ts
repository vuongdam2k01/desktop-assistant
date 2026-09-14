import type { ToolDefinition } from "../types/manifest-types.js";

/**
 * Standard Model Context Protocol (MCP) Tool Specification
 * Matches Anthropic / Linux Foundation MCP standard (2024-11-05+)
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  annotations?: Record<string, any>;
}

export interface MCPCallToolRequest {
  method: "tools/call";
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface MCPCallToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Maps a Connector Manifest ToolDefinition to an official MCP Tool
 */
export function manifestToolToMCPTool(tool: ToolDefinition): MCPTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties: tool.parameters.properties,
      required: tool.parameters.required,
      additionalProperties: tool.parameters.additionalProperties,
    },
    annotations: {
      category: tool.category,
      required_capability: tool.required_capability,
      irreversible: tool.irreversible ?? false,
      changes_permission: tool.changes_permission ?? false,
      snapshot: tool.snapshot,
      compensation: tool.compensation,
    },
  };
}

/**
 * Imports an external MCP Tool into a Desktop Assistant ToolDefinition
 */
export function mcpToolToManifestTool(mcpTool: MCPTool, defaultCategory: "read" | "write" = "read"): ToolDefinition {
  const annotations = mcpTool.annotations || {};

  return {
    id: mcpTool.name,
    name: mcpTool.name,
    label: mcpTool.name,
    description: mcpTool.description || "",
    category: annotations.category || defaultCategory,
    required_capability: annotations.required_capability,
    parameters: {
      type: "object",
      properties: mcpTool.inputSchema.properties || {},
      required: mcpTool.inputSchema.required,
      additionalProperties: mcpTool.inputSchema.additionalProperties,
    },
    snapshot: annotations.snapshot,
    compensation: annotations.compensation,
    irreversible: annotations.irreversible ?? (annotations.category === "write" ? true : false),
    changes_permission: annotations.changes_permission ?? false,
  };
}
