/**
 * XAIProvider — environment-configured xAI (Grok) provider.
 *
 * SECURITY:
 * - This module reads XAI_API_KEY from process.env.
 * - It must only be imported server-side (API routes, server actions, Node scripts).
 * - Never import this in client-side components or pages.
 * - The API key is never logged, serialized, or included in responses.
 */

import { createGrokProvider } from "./grok-provider";
import type { AIProvider } from "./provider";
import { GrokProviderError } from "./types";

export type XAIProviderConfig = {
  /** Override the API key. Defaults to XAI_API_KEY env var. */
  apiKey?: string;
  /** Override the default model. Defaults to XAI_DEFAULT_MODEL or "grok-4.5". */
  defaultModel?: string;
  /** Override the base URL. Defaults to XAI_BASE_URL env var. */
  baseUrl?: string;
};

export type XAIProviderResult =
  | { ok: true; provider: AIProvider }
  | { ok: false; error: GrokProviderError };

/**
 * Create a configured xAI provider from environment variables.
 *
 * Returns a discriminated union — callers must check `.ok` before using `.provider`.
 * A missing API key returns a typed authentication error rather than throwing.
 *
 * @example
 * const result = createXAIProvider();
 * if (!result.ok) throw result.error;
 * const text = await result.provider.generateText({ userPrompt: "Hello" });
 */
export function createXAIProvider(config: XAIProviderConfig = {}): XAIProviderResult {
  const apiKey = config.apiKey ?? process.env.XAI_API_KEY;
  const defaultModel =
    config.defaultModel ?? process.env.XAI_DEFAULT_MODEL ?? "grok-4.5";
  const baseUrl = config.baseUrl ?? process.env.XAI_BASE_URL;

  if (!apiKey) {
    return {
      ok: false,
      error: new GrokProviderError({
        kind: "authentication",
        message:
          "XAI_API_KEY is not configured. Set the XAI_API_KEY environment variable on the server.",
      }),
    };
  }

  const provider = createGrokProvider({
    apiKey,
    defaultModel,
    ...(baseUrl ? { baseUrl } : {}),
  });

  return { ok: true, provider };
}
