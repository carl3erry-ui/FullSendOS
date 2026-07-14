export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const maybeError = (payload as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim().length > 0) {
      return maybeError;
    }

    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
  }

  return fallback;
}

export function getApiFieldErrors(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];

  const fieldErrors = (payload as { fieldErrors?: unknown }).fieldErrors;
  if (!Array.isArray(fieldErrors)) return [];

  return fieldErrors
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const path = typeof (item as { path?: unknown }).path === "string" ? (item as { path: string }).path : "root";
      const message = typeof (item as { message?: unknown }).message === "string"
        ? (item as { message: string }).message
        : "Invalid value";
      return `${path}: ${message}`;
    })
    .filter((item): item is string => Boolean(item));
}

export function formatApiError(payload: unknown, fallback: string, options: { includeFieldErrors?: boolean } = {}): string {
  const base = getApiErrorMessage(payload, fallback);
  if (!options.includeFieldErrors) return base;

  const fieldErrors = getApiFieldErrors(payload);
  if (!fieldErrors.length) return base;

  return `${base} ${fieldErrors.slice(0, 3).join(" | ")}`;
}
