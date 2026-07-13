/**
 * Agent API response helpers.
 *
 * Consistent response format for success and error states.
 */

import { NextResponse } from "next/server";
import type { AgentExecutorError } from "@/agents";

type FieldValidationError = {
  path: string;
  message: string;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors: FieldValidationError[];
  };
};

/**
 * Build a success response.
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    } as ApiResponse<T>,
    { status },
  );
}

/**
 * Build a validation error response.
 */
export function validationErrorResponse(
  message: string,
  fieldErrors: FieldValidationError[] = [],
  status = 422,
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message,
        fieldErrors,
      },
    } as ApiResponse,
    { status },
  );
}

/**
 * Build an error response.
 */
export function errorResponse(
  code: string,
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        fieldErrors: [],
      },
    } as ApiResponse,
    { status },
  );
}

/**
 * Map AgentExecutorError to HTTP status and response.
 */
export function mapExecutorErrorToResponse(error: AgentExecutorError): NextResponse {
  const statusMap: Record<string, number> = {
    agent_not_found: 404,
    agent_disabled: 403,
    task_not_found: 404,
    invalid_task_input: 422,
    provider_not_found: 404,
    provider_not_configured: 503,
    missing_api_key: 503,
    approval_required: 403,
    task_already_running: 409,
    task_already_completed: 409,
    provider_request_failed: 502,
    provider_timeout: 504,
    output_parsing_failed: 422,
    output_validation_failed: 422,
    permission_denied: 403,
  };

  const status = statusMap[error.code] || 500;
  return errorResponse(error.code.toUpperCase(), error.message, status);
}

/**
 * Convert Zod validation errors to field errors.
 */
export function toFieldErrors(
  issues: Array<{ path?: unknown; message?: unknown }>,
): FieldValidationError[] {
  return issues.slice(0, 12).map((issue) => ({
    path:
      Array.isArray(issue.path) && issue.path.length
        ? issue.path.join(".")
        : "root",
    message:
      typeof issue.message === "string"
        ? issue.message
        : "Invalid value",
  }));
}
