import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";

export type AskUserHandler = (question: string, options?: string[]) => Promise<string> | string;

export interface AskUserRecord {
  timestamp: string;
  question: string;
  options?: string[];
  response: string;
}

export function createAskUserTool(
  handler: AskUserHandler,
  records: AskUserRecord[]
): AgentTool {
  return {
    name: "ask_user",
    label: "Ask User for Clarification",
    description: "Ask the user a clarifying question when essential information is missing and cannot be deduced. Formulate one clear consolidated question with options if applicable. Do NOT ask if information is already clear or deducible.",
    parameters: Type.Object({
      question: Type.String({ description: "Consolidated clarifying question to ask the user" }),
      options: Type.Optional(Type.Array(Type.String(), { description: "Structured options for the user to choose from" })),
    }),
    execute: async (_toolCallId, params: any) => {
      const response = await handler(params.question, params.options);
      records.push({
        timestamp: new Date().toISOString(),
        question: params.question,
        options: params.options,
        response,
      });
      return {
        content: [{ type: "text" as const, text: `Phản hồi từ người dùng: "${response}"` }],
        details: { user_response: response },
      };
    },
  };
}
