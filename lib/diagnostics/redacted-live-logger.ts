const REDACTED = "[REDACTED]";

const SECRET_PATTERNS = [
  /apiKey/i,
  /authorization/i,
  /x-api-key/i,
  /providerPayload/i,
  /rawPayload/i,
  /prompt/i,
  /systemPrompt/i,
  /hiddenReasoning/i,
  /\.env\.local/i,
  /secret/i,
  /token/i,
];

export function redactSecretLikeValues(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return SECRET_PATTERNS.some((pattern) => pattern.test(value)) ? REDACTED : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSecretLikeValues(item));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_PATTERNS.some((pattern) => pattern.test(key))) {
        result[key] = REDACTED;
      } else {
        result[key] = redactSecretLikeValues(item);
      }
    }
    return result;
  }

  return value;
}

export function safeStatusLine(label: string, value: unknown): string {
  const safeValue = redactSecretLikeValues(value);
  return `${label}: ${typeof safeValue === "string" ? safeValue : JSON.stringify(safeValue)}`;
}

export function summarizeProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  const redacted = String(redactSecretLikeValues(message));
  return redacted.length > 220 ? `${redacted.slice(0, 217)}...` : redacted;
}

export function summarizeWorkflowForConsole(workflow: {
  id?: string;
  status?: string;
  updatedAt?: string;
  audit?: { activeRun?: { id?: string; model?: string; updatedAt?: string }; warnings?: string[] };
  deliverables?: { executiveReport?: string; onePageSummary?: string; deckOutline?: unknown[] };
  exports?: unknown[];
}) {
  return {
    id: workflow.id || null,
    status: workflow.status || "unknown",
    updatedAt: workflow.updatedAt || null,
    activeRunId: workflow.audit?.activeRun?.id || null,
    model: workflow.audit?.activeRun?.model || null,
    warnings: Array.isArray(workflow.audit?.warnings) ? workflow.audit.warnings.length : 0,
    deliverables: {
      executiveReport: Boolean(workflow.deliverables?.executiveReport),
      onePageSummary: Boolean(workflow.deliverables?.onePageSummary),
      deckOutline: Array.isArray(workflow.deliverables?.deckOutline) && workflow.deliverables.deckOutline.length > 0,
    },
    exports: Array.isArray(workflow.exports) ? workflow.exports.length : 0,
  };
}