import type { ZodType } from "zod";
import { createGrokClient } from "./grok-client";
import type { AIProvider, AIProviderRequest, NormalizedAIResponse } from "./provider";
import type { GrokClientConfig } from "./types";

export function createGrokProvider(config: GrokClientConfig = {}): AIProvider {
  const client = createGrokClient(config);

  return {
    async generateText(request: AIProviderRequest): Promise<NormalizedAIResponse> {
      const response = await client.generateText(request);
      return {
        text: response.text,
        model: response.model,
        provider: response.provider,
        usage: response.usage,
        requestId: response.requestId,
      };
    },
    async generateStructuredResult<T>(request: AIProviderRequest, schema: ZodType<T>): Promise<T> {
      const response = await client.generateStructuredResult(request, schema);
      return response.data;
    },
  };
}
