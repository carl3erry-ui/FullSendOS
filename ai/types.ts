import type { ZodType } from "zod";

export type GrokRequestMetadata = Record<string, string | number | boolean | null>;

export type GrokGenerateRequest = {
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: GrokRequestMetadata;
};

export type GrokUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type GrokTextResponse = {
  text: string;
  model: string;
  provider: "xai";
  usage?: GrokUsage;
  requestId?: string;
  rawResponse?: unknown;
};

export type GrokStructuredResponse<T> = GrokTextResponse & {
  data: T;
};

export type ProviderErrorKind =
  | "authentication"
  | "rate_limit"
  | "validation"
  | "timeout"
  | "provider";

export class GrokProviderError extends Error {
  kind: ProviderErrorKind;
  statusCode?: number;
  requestId?: string;
  details?: unknown;

  constructor(options: {
    kind: ProviderErrorKind;
    message: string;
    statusCode?: number;
    requestId?: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "GrokProviderError";
    this.kind = options.kind;
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export type GrokClientConfig = {
  apiKey?: string;
  defaultModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  includeRawResponse?: boolean;
  fetchImpl?: typeof fetch;
};

export type GrokClient = {
  generateText: (request: GrokGenerateRequest) => Promise<GrokTextResponse>;
  generateStructuredResult: <T>(
    request: GrokGenerateRequest,
    schema: ZodType<T>,
  ) => Promise<GrokStructuredResponse<T>>;
};

export type ParsedXaiResponse = {
  id?: string;
  model?: string;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};
