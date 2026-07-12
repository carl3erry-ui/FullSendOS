import type { WorkflowStageId } from "../types/project";

export type DepartmentExecutionErrorKind =
  | "unknown_department"
  | "dependency_incomplete"
  | "provider_failure"
  | "schema_validation_failure"
  | "malformed_structured_response";

export type DepartmentExecutionConfig = {
  defaultModel?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type DepartmentExecutionResult = {
  departmentId: WorkflowStageId;
  completedAt: string;
};
