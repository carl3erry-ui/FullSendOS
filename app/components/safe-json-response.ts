import { getApiErrorMessage } from "./api-error";

const DEFAULT_EMPTY_RESPONSE_MESSAGE = "The server returned an empty response. Please refresh or try the action again.";
const DEFAULT_INVALID_RESPONSE_MESSAGE = "The server returned an invalid response. Please refresh or try the action again.";

const UNSAFE_ERROR_PATTERN = /(authorization:|api[_ -]?key|bearer\s+[a-z0-9._-]+|rawprovider|raw provider|system\s*prompt|providerpayload|stack\s*trace|\.env\.local)/i;

export type SafeJsonResponse<T = unknown> = {
  ok: boolean;
  status: number;
  empty: boolean;
  invalid: boolean;
  data: T | null;
  error: string | null;
};

function sanitizeUserMessage(message: string, fallback: string): string {
  const trimmed = message.trim();
  if (!trimmed) return fallback;
  if (trimmed.length > 240) return fallback;
  if (UNSAFE_ERROR_PATTERN.test(trimmed)) return fallback;
  return trimmed;
}

export async function parseJsonResponseSafely<T = unknown>(response: Response): Promise<SafeJsonResponse<T>> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      ok: response.ok,
      status: response.status,
      empty: true,
      invalid: false,
      data: null,
      error: response.ok ? null : `Request failed with status ${response.status}`,
    };
  }

  try {
    return {
      ok: response.ok,
      status: response.status,
      empty: false,
      invalid: false,
      data: JSON.parse(text) as T,
      error: null,
    };
  } catch {
    return {
      ok: false,
      status: response.status,
      empty: false,
      invalid: true,
      data: null,
      error: `Invalid JSON response from server with status ${response.status}`,
    };
  }
}

export function getSafeResponseError(
  parsed: SafeJsonResponse,
  fallback: string,
  options: { emptyMessage?: string; invalidMessage?: string } = {},
): string | null {
  if (parsed.empty) {
    return options.emptyMessage || DEFAULT_EMPTY_RESPONSE_MESSAGE;
  }

  if (parsed.invalid) {
    return options.invalidMessage || DEFAULT_INVALID_RESPONSE_MESSAGE;
  }

  if (!parsed.ok) {
    const baseError = parsed.error || fallback;
    const message = getApiErrorMessage(parsed.data, baseError);
    return sanitizeUserMessage(message, fallback);
  }

  return null;
}
