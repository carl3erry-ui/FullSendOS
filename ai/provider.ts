import type { ZodType } from "zod";

export type AIProviderRequest = {
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type NormalizedAIResponse = {
  text: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  requestId?: string;
};

export interface AIProvider {
  generateText(request: AIProviderRequest): Promise<NormalizedAIResponse>;
  generateStructuredResult<T>(request: AIProviderRequest, schema: ZodType<T>): Promise<T>;
}
