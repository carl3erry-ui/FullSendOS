/**
 * Typed error vocabulary for the AgentExecutor.
 *
 * All executor operations return AgentExecutorError rather than
 * raw Error or generic strings, so callers can match on `.code`.
 */

export type AgentErrorCode =
  | "agent_not_found"
  | "agent_disabled"
  | "task_not_found"
  | "invalid_task_input"
  | "provider_not_found"
  | "provider_not_configured"
  | "missing_api_key"
  | "approval_required"
  | "task_already_running"
  | "task_already_completed"
  | "provider_request_failed"
  | "provider_timeout"
  | "output_parsing_failed"
  | "output_validation_failed"
  | "permission_denied";

export class AgentExecutorError extends Error {
  readonly code: AgentErrorCode;
  readonly taskId?: string;
  readonly agentId?: string;
  /** Safe, non-secret supplemental context. Never include API keys or auth headers. */
  readonly details?: unknown;

  constructor(options: {
    code: AgentErrorCode;
    message: string;
    taskId?: string;
    agentId?: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "AgentExecutorError";
    this.code = options.code;
    this.taskId = options.taskId;
    this.agentId = options.agentId;
    this.details = options.details;
  }
}
