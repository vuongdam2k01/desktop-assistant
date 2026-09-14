import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export const LLM_BASE_URL = process.env.LLM_BASE_URL || '';
export const LLM_API_KEY = process.env.LLM_API_KEY || '';
export const LLM_MODEL_STRONG = process.env.LLM_MODEL_STRONG || 'deepseek-v4-pro-ga-260813';

if (!LLM_BASE_URL || !LLM_API_KEY) {
  throw new Error('Missing LLM_BASE_URL or LLM_API_KEY in spikes/.env.local');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callLLM(messages: ChatMessage[], options: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
  const url = `${LLM_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL_STRONG,
      messages,
      temperature: options.temperature ?? 0.0,
      max_tokens: options.max_tokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM call failed with HTTP ${response.status}: ${errText}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`No content returned from LLM: ${JSON.stringify(data)}`);
  }
  return content.trim();
}
