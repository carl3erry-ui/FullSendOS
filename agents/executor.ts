import { GrokProviderError } from "../ai/types";
import { AgentExecutorError } from "./errors";
import type { AgentExecutionStore } from "./execution-store";
import { HIGH_RISK_PERMISSIONS } from "./permissions";
import type { AgentInstanceRegistry, AgentRegistry } from "./registry";
import type { AgentTaskStore } from "./task-store";
import type { AgentExecution, AgentTask } from "./types";
import type { AIProviderRegistry } from "../ai/provider-registry";
import { loadProject } from "../src/storage/projectStore.js";
import { retrieveDataRoomContext } from "../services/data-room-retrieval-service";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type AgentExecutorResult =
  | {
      ok: true;
      task: AgentTask;
      execution: AgentExecution;
      output: unknown;
    }
  | {
      ok: false;
      error: AgentExecutorError;
      task?: AgentTask;
      execution?: AgentExecution;
    };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type AgentExecutorOptions = {
  taskStore: AgentTaskStore;
  executionStore: AgentExecutionStore;
  /** Registry of agent definitions (for enabled/requiresApproval checks). */
  agentRegistry: AgentRegistry;
  /** Registry of agent instances (for calling execute/validate). */
  instanceRegistry: AgentInstanceRegistry;
  /** Registry of AI provider implementations. */
  providerRegistry: AIProviderRegistry;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExecutionId(taskId: string, attempt: number): string {
  return `exec-${taskId}-${attempt}-${Date.now()}`;
}

/**
 * Sanitize a raw provider response before persisting it.
 * Removes any field whose key looks like an authorization header or API key,
 * guarding against accidental secret storage in edge cases.
 */
function sanitizeRawResponse(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    // If already a string, parse and re-sanitize
    try {
      return sanitizeRawResponse(JSON.parse(raw));
    } catch {
      return raw;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      // Never persist authorization header values
      if (lower.includes("authorization") || lower.includes("api_key") || lower.includes("apikey")) {
        continue;
      }
      sanitized[key] = value;
    }
    return JSON.stringify(sanitized);
  }
  return JSON.stringify(raw);
}

function toSafeError(error: unknown): string {
  if (error instanceof AgentExecutorError) return `${error.code}: ${error.message}`;
  if (error instanceof GrokProviderError) return `provider error (${error.kind}): ${error.message}`;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function mapProviderError(error: unknown): AgentExecutorError {
  if (error instanceof AgentExecutorError) return error;
  if (error instanceof GrokProviderError) {
    if (error.kind === "timeout") {
      return new AgentExecutorError({
        code: "provider_timeout",
        message: `Provider request timed out: ${error.message}`,
      });
    }
    if (error.kind === "authentication") {
      return new AgentExecutorError({
        code: "missing_api_key",
        message: `Provider authentication failed: ${error.message}`,
      });
    }
    if (error.kind === "validation") {
      return new AgentExecutorError({
        code: "output_validation_failed",
        message: `Provider returned invalid structured output: ${error.message}`,
      });
    }
    return new AgentExecutorError({
      code: "provider_request_failed",
      message: `Provider request failed: ${error.message}`,
    });
  }
  if (error instanceof Error && error.name === "ZodError") {
    return new AgentExecutorError({
      code: "output_validation_failed",
      message: `Output schema validation failed: ${error.message}`,
    });
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("json") || msg.includes("parse")) {
      return new AgentExecutorError({
        code: "output_parsing_failed",
        message: `Failed to parse provider output: ${error.message}`,
      });
    }
    return new AgentExecutorError({
      code: "provider_request_failed",
      message: error.message,
    });
  }
  return new AgentExecutorError({
    code: "provider_request_failed",
    message: "An unknown provider error occurred.",
  });
}

async function resolveTaskClientId(task: AgentTask): Promise<string | null> {
  const explicitClientId =
    task.dataRoomRetrieval &&
    typeof task.dataRoomRetrieval.clientId === "string" &&
    task.dataRoomRetrieval.clientId.trim().length > 0
      ? task.dataRoomRetrieval.clientId.trim()
      : null;

  if (explicitClientId) {
    return explicitClientId;
  }

  const entityId = task.engagementId || task.projectId;
  if (!entityId) {
    return null;
  }

  try {
    const project = await loadProject(entityId);
    return project.clientId || project.id;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AgentExecutor
// ---------------------------------------------------------------------------

/**
 * AgentExecutor runs a queued agent task end-to-end.
 *
 * Lifecycle:
 * 1.  Load task from store
 * 2.  Resolve agent definition from agentRegistry
 * 3.  Resolve agent instance from instanceRegistry
 * 4.  Validate agent is enabled
 * 5.  Validate task input against agent contract
 * 6.  Check approval status
 * 7.  Reject duplicate running/completed tasks
 * 8.  Check for high-risk permission without approval
 * 9.  Resolve provider from providerRegistry
 * 10. Determine execution attempt number
 * 11. Create execution record (status: running)
 * 12. Update task status to running
 * 13. Optionally retrieve safe data-room context (if enabled)
 * 14. Call agent.execute(task, provider)
 * 15. On success: persist output, mark task + execution completed
 * 16. On failure: persist error, mark task + execution failed
 * 17. Return normalized ExecutorResult
 */
export class AgentExecutor {
  private readonly taskStore: AgentTaskStore;
  private readonly executionStore: AgentExecutionStore;
  private readonly agentRegistry: AgentRegistry;
  private readonly instanceRegistry: AgentInstanceRegistry;
  private readonly providerRegistry: AIProviderRegistry;

  constructor(options: AgentExecutorOptions) {
    this.taskStore = options.taskStore;
    this.executionStore = options.executionStore;
    this.agentRegistry = options.agentRegistry;
    this.instanceRegistry = options.instanceRegistry;
    this.providerRegistry = options.providerRegistry;
  }

  async execute(taskId: string): Promise<AgentExecutorResult> {
    // ----- Step 1: Load task -----
    let task: AgentTask;
    try {
      task = await this.taskStore.loadTask(taskId);
    } catch (error) {
      if (error instanceof AgentExecutorError) {
        return { ok: false, error };
      }
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "task_not_found",
          message: `Failed to load task "${taskId}".`,
          taskId,
        }),
      };
    }

    // ----- Step 2: Resolve agent definition -----
    const definition = this.agentRegistry.getById(task.agentId);
    if (!definition) {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "agent_not_found",
          message: `Agent "${task.agentId}" is not registered.`,
          taskId,
          agentId: task.agentId,
        }),
        task,
      };
    }

    // ----- Step 3: Resolve agent instance -----
    const agent = this.instanceRegistry.get(task.agentId);
    if (!agent) {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "agent_not_found",
          message: `Agent instance for "${task.agentId}" is not registered.`,
          taskId,
          agentId: task.agentId,
        }),
        task,
      };
    }

    // ----- Step 4: Check agent enabled -----
    if (!definition.enabled) {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "agent_disabled",
          message: `Agent "${task.agentId}" is disabled and cannot execute tasks.`,
          taskId,
          agentId: task.agentId,
        }),
        task,
      };
    }

    // ----- Step 5: Validate task input -----
    const validation = agent.validateTask(task);
    if (!validation.valid) {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "invalid_task_input",
          message: `Task validation failed: ${validation.errors.join("; ")}`,
          taskId,
          agentId: task.agentId,
          details: validation.errors,
        }),
        task,
      };
    }

    // ----- Step 6: Approval checks -----
    if (task.approvalStatus === "pending") {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "approval_required",
          message: "Task cannot execute — approval is pending human review.",
          taskId,
          agentId: task.agentId,
        }),
        task,
      };
    }

    if (
      definition.requiresApproval &&
      task.approvalStatus !== "approved" &&
      task.approvalStatus !== "not_required"
    ) {
      // Move task to waiting_for_approval
      const updatedTask: AgentTask = {
        ...task,
        status: "waiting_for_approval",
        updatedAt: new Date().toISOString(),
      };
      await this.taskStore.saveTask(updatedTask);
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "approval_required",
          message: `Agent "${task.agentId}" requires approval before execution. Task moved to waiting_for_approval.`,
          taskId,
          agentId: task.agentId,
        }),
        task: updatedTask,
      };
    }

    // ----- Step 7: Duplicate-run protection -----
    if (task.status === "running") {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "task_already_running",
          message: `Task "${taskId}" is already running. Duplicate execution rejected.`,
          taskId,
          agentId: task.agentId,
        }),
        task,
      };
    }

    if (task.status === "completed") {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "task_already_completed",
          message: `Task "${taskId}" is already completed. To rerun, create a new task.`,
          taskId,
          agentId: task.agentId,
        }),
        task,
      };
    }

    // ----- Step 8: High-risk permission check -----
    const toolPermissions = definition.allowedTools ?? definition.permissions ?? [];
    const highRiskTools = toolPermissions.filter((tool) =>
      HIGH_RISK_PERMISSIONS.has(tool as Parameters<typeof HIGH_RISK_PERMISSIONS.has>[0]),
    );
    if (highRiskTools.length > 0 && task.approvalStatus !== "approved") {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "permission_denied",
          message: `Agent has high-risk permissions [${highRiskTools.join(", ")}] that require explicit approval.`,
          taskId,
          agentId: task.agentId,
          details: { highRiskTools },
        }),
        task,
      };
    }

    // ----- Step 9: Resolve provider -----
    let provider;
    try {
      provider = this.providerRegistry.resolve(task.provider);
    } catch {
      return {
        ok: false,
        error: new AgentExecutorError({
          code: "provider_not_found",
          message: `Provider "${task.provider}" is not registered.`,
          taskId,
          agentId: task.agentId,
        }),
        task,
      };
    }

    // ----- Step 10: Determine attempt number -----
    const existingExecutions = await this.executionStore.listByTaskId(taskId);
    const attempt = existingExecutions.length + 1;

    // ----- Step 11: Create execution record -----
    const now = new Date().toISOString();
    const executionId = makeExecutionId(taskId, attempt);
    const execution: AgentExecution = {
      id: executionId,
      agentTaskId: taskId,
      agentId: task.agentId,
      provider: task.provider,
      model: task.model,
      status: "running",
      attempt,
      systemPromptSnapshot: agent.buildSystemPrompt(task),
      toolPermissionsSnapshot: toolPermissions,
      startedAt: now,
    };
    await this.executionStore.saveExecution(execution);

    // ----- Step 12: Update task to running -----
    const runningTask: AgentTask = {
      ...task,
      status: "running",
      startedAt: task.startedAt ?? now,
      updatedAt: now,
    };
    await this.taskStore.saveTask(runningTask);

    let executionTask = runningTask;
    let retrievalContext: Awaited<ReturnType<typeof retrieveDataRoomContext>> | null = null;

    if (runningTask.dataRoomRetrieval?.enabled === true) {
      const clientId = await resolveTaskClientId(runningTask);
      if (!clientId) {
        return {
          ok: false,
          error: new AgentExecutorError({
            code: "invalid_task_input",
            message:
              "Data room retrieval enabled, but no client context could be resolved from task.",
            taskId,
            agentId: task.agentId,
          }),
          task: runningTask,
          execution,
        };
      }

      try {
        retrievalContext = await retrieveDataRoomContext({
          clientId,
          engagementId: runningTask.engagementId || undefined,
          agentId: runningTask.agentId,
          agentPermissions: definition.permissions,
          taskId: runningTask.id,
          query: runningTask.dataRoomRetrieval.query || runningTask.objective,
          documentTypes: runningTask.dataRoomRetrieval.documentTypes || [],
          folderIds: runningTask.dataRoomRetrieval.folderIds || [],
          fileIds: runningTask.dataRoomRetrieval.fileIds || [],
          keywords: runningTask.dataRoomRetrieval.keywords || [],
          maxDocuments: runningTask.dataRoomRetrieval.maxDocuments || 5,
          maxExcerpts: runningTask.dataRoomRetrieval.maxExcerpts || 12,
          maxCharacters: runningTask.dataRoomRetrieval.maxCharacters || 280,
          maxTotalCharacters: runningTask.dataRoomRetrieval.maxTotalCharacters || 2400,
          includeSummaries: runningTask.dataRoomRetrieval.includeSummaries ?? true,
          includePreviews: runningTask.dataRoomRetrieval.includePreviews ?? true,
          allowSensitive: runningTask.dataRoomRetrieval.allowSensitive ?? false,
        });

        executionTask = {
          ...runningTask,
          context: {
            ...(runningTask.context || {}),
            dataRoomRetrieval: {
              retrievalAuditId: retrievalContext.retrievalAuditId,
              query: runningTask.dataRoomRetrieval.query || runningTask.objective,
              sources: retrievalContext.sources,
              excerpts: retrievalContext.excerpts,
              summaries: retrievalContext.summaries,
              warnings: retrievalContext.warnings,
              totalCharacters: retrievalContext.totalCharacters,
              confidence: retrievalContext.confidence,
            },
          },
          updatedAt: new Date().toISOString(),
        };
        await this.taskStore.saveTask(executionTask);
      } catch (retrievalError) {
        if (retrievalError instanceof AgentExecutorError) {
          return {
            ok: false,
            error: retrievalError,
            task: runningTask,
            execution,
          };
        }

        return {
          ok: false,
          error: new AgentExecutorError({
            code: "provider_request_failed",
            message: "Data room retrieval failed before agent execution.",
            taskId,
            agentId: task.agentId,
          }),
          task: runningTask,
          execution,
        };
      }
    }

    // ----- Steps 13–17: Call provider, handle result -----
    let output: unknown;
    try {
      output = await agent.execute(executionTask, provider);
    } catch (providerError) {
      const executorError = mapProviderError(providerError);
      const failedAt = new Date().toISOString();

      const failedExecution: AgentExecution = {
        ...execution,
        status: "failed",
        error: toSafeError(providerError),
        completedAt: failedAt,
      };
      await this.executionStore.saveExecution(failedExecution);

      const failedTask: AgentTask = {
        ...executionTask,
        status: "failed",
        failedAt,
        error: toSafeError(providerError),
        updatedAt: failedAt,
      };
      await this.taskStore.saveTask(failedTask);

      return { ok: false, error: executorError, task: failedTask, execution: failedExecution };
    }

    // ----- Persist successful result -----
    const completedAt = new Date().toISOString();

    // Extract usage from output if present (provider may attach it via metadata)
    // The agent's execute() returns the structured output; usage lives on the
    // NormalizedAIResponse which the agent doesn't surface directly in this slice.
    // Usage is captured via the execution's usage field when available.

    // Structured output — store as record if it's a plain object
    const structuredOutput =
      output !== null && typeof output === "object" && !Array.isArray(output)
        ? (output as Record<string, unknown>)
        : undefined;

    const completedExecution: AgentExecution = {
      ...execution,
      status: "completed",
      parsedResponse: structuredOutput,
      validationResult: { valid: true, errors: [] },
      estimatedCost: null, // Pricing not configured in this slice
      completedAt,
    };
    await this.executionStore.saveExecution(completedExecution);

    const retrievalEvidence =
      retrievalContext?.sources.map((source) => {
        const excerpt = retrievalContext?.excerpts.find(
          (candidate) =>
            candidate.documentId === source.documentId && candidate.fileId === source.fileId,
        );

        return {
          type: "document" as const,
          title: `${source.citationLabel} - ${source.displayName}`,
          content: excerpt?.text || "No excerpt available.",
          source: source.documentId,
          confidence: excerpt?.confidence ?? retrievalContext?.confidence ?? 0.6,
          retrievedAt: completedAt,
        };
      }) || [];

    const completedTask: AgentTask = {
      ...executionTask,
      status: "completed",
      completedAt,
      structuredOutput,
      output: typeof output === "object" ? JSON.stringify(output) : String(output),
      evidence: [...(executionTask.evidence || []), ...retrievalEvidence],
      sources: [
        ...(executionTask.sources || []),
        ...((retrievalContext?.sources || []).map(
          (source) => `${source.citationLabel}: ${source.displayName}`,
        )),
      ],
      updatedAt: completedAt,
    };
    await this.taskStore.saveTask(completedTask);

    return { ok: true, task: completedTask, execution: completedExecution, output };
  }
}
