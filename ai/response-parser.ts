import { ZodError, type ZodType } from "zod";
import { jsonrepair } from "jsonrepair";
import { XaiResponsesApiSchema } from "../schemas/ai-response";
import { GrokProviderError, type ParsedXaiResponse } from "./types";

function buildJsonCandidates(rawText: string): string[] {
  const trimmed = rawText.trim();
  const candidates = new Set<string>([trimmed]);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidates.add(fenced[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  return Array.from(candidates).filter((candidate) => candidate.length > 0);
}

function tryParseJson(text: string): unknown {
  const candidate = text.trim();
  const looksJsonLike = candidate.startsWith("{") || candidate.startsWith("[");
  if (!looksJsonLike) {
    throw new Error("Candidate does not look like JSON.");
  }

  try {
    return JSON.parse(candidate);
  } catch {
    const repaired = jsonrepair(candidate);
    return JSON.parse(repaired);
  }
}

export function extractResponseText(response: unknown): string {
  const parsed = XaiResponsesApiSchema.parse(response);

  if (typeof parsed.output_text === "string" && parsed.output_text.trim().length > 0) {
    return parsed.output_text.trim();
  }

  const pieces: string[] = [];
  for (const item of parsed.output || []) {
    for (const block of item.content || []) {
      if (typeof block.text === "string" && block.text.trim().length > 0) {
        pieces.push(block.text.trim());
      }
    }
  }

  if (pieces.length > 0) {
    return pieces.join("\n");
  }

  throw new GrokProviderError({
    kind: "provider",
    message: "xAI response did not include readable output text.",
  });
}

export function parseStructuredJson<T>(text: string, schema: ZodType<T>): T {
  let parsedJson: unknown;
  let parseError: unknown;

  for (const candidate of buildJsonCandidates(text)) {
    try {
      parsedJson = tryParseJson(candidate);
      parseError = undefined;
      break;
    } catch (error) {
      parseError = error;
    }
  }

  if (parseError !== undefined || parsedJson === undefined) {
    throw new GrokProviderError({
      kind: "validation",
      message: "Model output is not valid JSON.",
      details: parseError instanceof Error ? parseError.message : parseError,
    });
  }

  try {
    return schema.parse(parsedJson);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new GrokProviderError({
        kind: "validation",
        message: `Structured result failed schema validation: ${error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; ")}`,
        details: error.issues,
      });
    }

    throw new GrokProviderError({
      kind: "validation",
      message: "Structured result failed schema validation.",
      details: error,
    });
  }
}

export function normalizeProviderError(error: unknown): GrokProviderError {
  if (error instanceof GrokProviderError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new GrokProviderError({
      kind: "validation",
      message: "Provider response shape was invalid.",
      details: error.issues,
    });
  }

  const err = error as {
    name?: string;
    message?: string;
    status?: number;
    statusCode?: number;
    requestId?: string;
    details?: unknown;
  };

  if (err?.name === "AbortError") {
    return new GrokProviderError({
      kind: "timeout",
      message: "xAI request timed out.",
    });
  }

  const statusCode = typeof err?.statusCode === "number" ? err.statusCode : err?.status;
  const message = err?.message || "xAI provider request failed.";

  if (statusCode === 401 || statusCode === 403) {
    return new GrokProviderError({
      kind: "authentication",
      message: "xAI authentication failed. Check XAI_API_KEY.",
      statusCode,
      requestId: err?.requestId,
      details: err?.details,
    });
  }

  if (statusCode === 429) {
    return new GrokProviderError({
      kind: "rate_limit",
      message: "xAI rate limit reached. Retry later.",
      statusCode,
      requestId: err?.requestId,
      details: err?.details,
    });
  }

  if (statusCode === 400 || statusCode === 408 || statusCode === 422) {
    return new GrokProviderError({
      kind: statusCode === 408 ? "timeout" : "validation",
      message,
      statusCode,
      requestId: err?.requestId,
      details: err?.details,
    });
  }

  return new GrokProviderError({
    kind: "provider",
    message,
    statusCode,
    requestId: err?.requestId,
    details: err?.details,
  });
}

export function toParsedXaiResponse(value: unknown): ParsedXaiResponse {
  return XaiResponsesApiSchema.parse(value);
}
