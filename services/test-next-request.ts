import { NextRequest } from "next/server";

type CreateTestNextRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown>;
};

export function createTestNextRequest(
  url: string,
  init: CreateTestNextRequestInit = {},
): NextRequest {
  const { body, headers, signal, ...rest } = init;

  const normalizedHeaders = new Headers(headers ?? {});
  let normalizedBody: BodyInit | undefined;

  if (body === undefined) {
    normalizedBody = undefined;
  } else if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream
  ) {
    normalizedBody = body;
  } else {
    normalizedBody = JSON.stringify(body);
    if (!normalizedHeaders.has("content-type")) {
      normalizedHeaders.set("content-type", "application/json");
    }
  }

  return new NextRequest(url, {
    ...rest,
    headers: normalizedHeaders,
    body: normalizedBody,
    signal: signal ?? undefined,
  });
}
