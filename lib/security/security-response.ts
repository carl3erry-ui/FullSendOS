import { NextResponse } from "next/server";

export type SecurityErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND";

export class SecurityRouteError extends Error {
  readonly status: 401 | 403 | 404;
  readonly code: SecurityErrorCode;
  readonly reasonCode: string;

  constructor(status: 401 | 403 | 404, code: SecurityErrorCode, reasonCode: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.reasonCode = reasonCode;
  }
}

export function isSecurityRouteError(error: unknown): error is SecurityRouteError {
  return error instanceof SecurityRouteError;
}

export function unauthorized(reasonCode: string): never {
  throw new SecurityRouteError(401, "UNAUTHORIZED", reasonCode);
}

export function forbidden(reasonCode: string): never {
  throw new SecurityRouteError(403, "FORBIDDEN", reasonCode);
}

export function concealedNotFound(reasonCode: string): never {
  throw new SecurityRouteError(404, "NOT_FOUND", reasonCode);
}

export function toSecurityErrorResponse(error: SecurityRouteError): NextResponse {
  if (error.status === 401) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (error.status === 403) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
