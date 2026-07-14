export type LiveVerificationConfig = {
  smokeEnabled: boolean;
  apiKeyPresent: boolean;
  defaultModel: string;
  baseUrl?: string;
};

export type LiveVerificationGuardResult =
  | {
      ok: true;
      config: LiveVerificationConfig;
    }
  | {
      ok: false;
      reasons: string[];
      config: LiveVerificationConfig;
    };

export type CollaborationTraceStep = {
  taskId: string;
  agentId: string;
  provider: string;
  model: string;
  status: "completed" | "failed" | "running";
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  error?: string;
};

export type CollaborationTraceSummary = {
  workflowRunId: string;
  taskIds: string[];
  agentIds: string[];
  provider: string;
  statuses: Array<{ taskId: string; status: string; completedAt?: string }>;
  timestamps: {
    startedAt?: string;
    completedAt?: string;
  };
  highLevelSummary: string;
  handoffLinks: Array<{
    fromTaskId: string;
    toTaskId: string;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
  }>;
  finalSynthesis: string;
  safetyStatus: "clean" | "redacted";
};

const SECRET_PATTERNS: RegExp[] = [
  /xai-[a-z0-9_-]{8,}/gi,
  /bearer\s+[a-z0-9._-]{8,}/gi,
  /api[_-]?key\s*[:=]\s*["']?[^\s"']+["']?/gi,
  /authorization\s*[:=]\s*["']?[^\s"']+["']?/gi,
];

export function evaluateLiveVerificationGuard(
  env: NodeJS.ProcessEnv = process.env,
): LiveVerificationGuardResult {
  const smokeEnabled = env.LIVE_PROVIDER_SMOKE === "1";
  const apiKeyPresent = Boolean(env.XAI_API_KEY && env.XAI_API_KEY.trim().length > 0);
  const defaultModel = env.XAI_DEFAULT_MODEL || env.XAI_MODEL || "grok-4.5";
  const baseUrl = env.XAI_BASE_URL;

  const config: LiveVerificationConfig = {
    smokeEnabled,
    apiKeyPresent,
    defaultModel,
    ...(baseUrl ? { baseUrl } : {}),
  };

  const reasons: string[] = [];
  if (!smokeEnabled) {
    reasons.push("LIVE_PROVIDER_SMOKE=1 is required for live verification scripts.");
  }
  if (!apiKeyPresent) {
    reasons.push("XAI_API_KEY is required for live verification scripts.");
  }

  if (reasons.length > 0) {
    return { ok: false, reasons, config };
  }

  return { ok: true, config };
}

export function redactSecrets(value: string): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

export function buildCollaborationTraceSummary(input: {
  workflowRunId: string;
  steps: CollaborationTraceStep[];
}): CollaborationTraceSummary {
  const steps = input.steps.map((step) => ({
    ...step,
    summary: step.summary ? redactSecrets(step.summary) : undefined,
    error: step.error ? redactSecrets(step.error) : undefined,
  }));

  const taskIds = steps.map((step) => step.taskId);
  const agentIds = Array.from(new Set(steps.map((step) => step.agentId)));
  const provider = steps.length > 0 ? steps[0].provider : "unknown";

  const handoffLinks = steps
    .slice(0, -1)
    .map((step, index) => {
      const next = steps[index + 1];
      return {
        fromTaskId: step.taskId,
        toTaskId: next.taskId,
        fromAgentId: step.agentId,
        toAgentId: next.agentId,
        reason: "Sequential agent handoff in verification workflow.",
      };
    });

  const combined = redactSecrets(JSON.stringify(steps));
  const safetyStatus = combined.includes("[REDACTED]") ? "redacted" : "clean";

  const startedAt = steps[0]?.startedAt;
  const completedAt = steps[steps.length - 1]?.completedAt;
  const successCount = steps.filter((step) => step.status === "completed").length;

  const highLevelSummary =
    steps.length === 0
      ? "No collaboration steps were recorded."
      : `${successCount}/${steps.length} agent steps completed in workflow ${input.workflowRunId}.`;

  const finalSynthesis =
    steps[steps.length - 1]?.summary ||
    (steps.length > 0
      ? `Final status: ${steps[steps.length - 1].status}.`
      : "No final synthesis available.");

  return {
    workflowRunId: input.workflowRunId,
    taskIds,
    agentIds,
    provider,
    statuses: steps.map((step) => ({
      taskId: step.taskId,
      status: step.status,
      completedAt: step.completedAt,
    })),
    timestamps: {
      startedAt,
      completedAt,
    },
    highLevelSummary,
    handoffLinks,
    finalSynthesis,
    safetyStatus,
  };
}