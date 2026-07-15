import type { ZodType } from "zod";
import {
  extractResponseText,
  normalizeProviderError,
  parseStructuredJson,
  toParsedXaiResponse,
} from "./response-parser";
import {
  GrokProviderError,
  type GrokClient,
  type GrokClientConfig,
  type GrokGenerateRequest,
  type GrokStructuredResponse,
  type GrokTextResponse,
} from "./types";

const DEFAULT_MODEL = "grok-4.5";
const DEFAULT_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

function createTimeoutController(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const onAbort = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onAbort);
      }
    },
  };
}

function buildInput(request: GrokGenerateRequest) {
  const input: Array<{ role: "system" | "user"; content: string }> = [];
  if (request.systemPrompt) {
    input.push({ role: "system", content: request.systemPrompt });
  }
  input.push({ role: "user", content: request.userPrompt });
  return input;
}

export function createGrokClient(config: GrokClientConfig = {}): GrokClient {
  const apiKey = config.apiKey || process.env.XAI_API_KEY;
  const defaultModel =
    config.defaultModel || process.env.XAI_DEFAULT_MODEL || process.env.XAI_MODEL || DEFAULT_MODEL;
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const includeRawResponse = config.includeRawResponse ?? false;
  const fetchImpl = config.fetchImpl || fetch;

  if (!apiKey) {
    throw new GrokProviderError({
      kind: "validation",
      message: "XAI_API_KEY is not configured.",
    });
  }

  async function generateText(request: GrokGenerateRequest): Promise<GrokTextResponse> {
    const model = request.model || defaultModel;
    const controller = createTimeoutController(timeoutMs);
    const requestBody: {
      model: string;
      input: Array<{ role: "system" | "user"; content: string }>;
      store: false;
      temperature?: number;
      max_output_tokens?: number;
    } = {
      model,
      input: buildInput(request),
      store: false,
    };

    if (typeof request.temperature === "number") {
      requestBody.temperature = request.temperature;
    }

    if (typeof request.maxOutputTokens === "number") {
      requestBody.max_output_tokens = request.maxOutputTokens;
    }

    try {
      const response = await fetchImpl(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      const responseBody = await response.json().catch(() => null);
      const requestId = response.headers.get("x-request-id") || undefined;

      if (!response.ok) {
        throw normalizeProviderError({
          status: response.status,
          message:
            responseBody?.error?.message ||
            responseBody?.message ||
            `xAI request failed with status ${response.status}.`,
          requestId,
          details: responseBody,
        });
      }

      const parsed = toParsedXaiResponse(responseBody);
      const text = extractResponseText(parsed);

      return {
        text,
        model: parsed.model || model,
        provider: "xai",
        usage: parsed.usage
          ? {
              inputTokens: parsed.usage.input_tokens ?? undefined,
              outputTokens: parsed.usage.output_tokens ?? undefined,
              totalTokens: parsed.usage.total_tokens ?? undefined,
            }
          : undefined,
        requestId: requestId || parsed.id,
        rawResponse: includeRawResponse ? parsed : undefined,
      };
    } catch (error) {
      throw normalizeProviderError(error);
    } finally {
      controller.cleanup();
    }
  }

  async function generateStructuredResult<T>(
    request: GrokGenerateRequest,
    schema: ZodType<T>,
  ): Promise<GrokStructuredResponse<T>> {
    const textResponse = await generateText(request);
    const data = parseStructuredJson(textResponse.text, schema);
    return {
      ...textResponse,
      data,
    };
  }

  return {
    generateText,
    generateStructuredResult,
  };
}

export { extractResponseText, normalizeProviderError };
