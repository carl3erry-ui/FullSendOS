export type WorkflowStabilityState =
  | "healthy"
  | "running"
  | "stale"
  | "stuck"
  | "timed-out"
  | "failed"
  | "aborted"
  | "needs-review"
  | "completed"
  | "unknown";

function normalizeTerminalStatus(status?: string | null): "completed" | "needs-review" | "failed" | "aborted" | null {
  if (!status) return null;

  if (status === "complete" || status === "completed") return "completed";
  if (status === "needs-review") return "needs-review";
  if (status === "aborted") return "aborted";
  if (status === "failed") return "failed";

  return null;
}

export type WorkflowDepartmentSnapshot = {
  department?: string;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type WorkflowStabilityOptions = {
  timeoutMs?: number;
  stuckDepartmentTimeoutMs?: number;
  now?: Date;
};

function toTime(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isWorkflowTerminal(status?: string | null): boolean {
  return normalizeTerminalStatus(status) !== null;
}

export function isWorkflowStale(updatedAt?: string | null, now: Date = new Date(), timeoutMs = 15 * 60 * 1000): boolean {
  const updated = toTime(updatedAt || undefined);
  if (updated === null) return true;
  return now.getTime() - updated > timeoutMs;
}

export function detectStuckDepartment(
  departments: WorkflowDepartmentSnapshot[] | Record<string, WorkflowDepartmentSnapshot | undefined> | undefined,
  now: Date = new Date(),
  timeoutMs = 15 * 60 * 1000,
): { department: string; status: WorkflowStabilityState; startedAt?: string; elapsedMs?: number } | null {
  const list = Array.isArray(departments)
    ? departments
    : departments
      ? Object.entries(departments).map(([department, snapshot]) => ({ department, ...snapshot }))
      : [];

  let candidate: { department: string; status: WorkflowStabilityState; startedAt?: string; elapsedMs?: number } | null = null;

  for (const item of list) {
    if (!item || item.status !== "running") continue;
    const started = toTime(item.startedAt || undefined);
    if (started === null) {
      candidate = candidate || { department: item.department || "unknown", status: "stuck" };
      continue;
    }

    const elapsedMs = now.getTime() - started;
    if (elapsedMs > timeoutMs) {
      return {
        department: item.department || "unknown",
        status: elapsedMs > timeoutMs * 2 ? "timed-out" : "stuck",
        startedAt: item.startedAt,
        elapsedMs,
      };
    }

    candidate = candidate || {
      department: item.department || "unknown",
      status: "running",
      startedAt: item.startedAt,
      elapsedMs,
    };
  }

  return candidate;
}

export function getWorkflowStabilityState(
  workflowOrEngagement: {
    status?: string | null;
    updatedAt?: string | null;
    departments?: WorkflowDepartmentSnapshot[] | Record<string, WorkflowDepartmentSnapshot | undefined>;
  } | null | undefined,
  options: WorkflowStabilityOptions = {},
): { state: WorkflowStabilityState; reason: string; stuckDepartment?: ReturnType<typeof detectStuckDepartment> } {
  if (!workflowOrEngagement) {
    return { state: "unknown", reason: "No workflow data available." };
  }

  const now = options.now || new Date();
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const stuckDepartmentTimeoutMs = options.stuckDepartmentTimeoutMs ?? timeoutMs;

  const terminalStatus = normalizeTerminalStatus(workflowOrEngagement.status);
  if (terminalStatus) {
    if (terminalStatus === "completed") return { state: "completed", reason: "Workflow completed." };
    if (terminalStatus === "needs-review") return { state: "needs-review", reason: "Workflow is awaiting human review." };
    if (terminalStatus === "aborted") return { state: "aborted", reason: "Workflow was aborted." };
    return { state: "failed", reason: "Workflow failed." };
  }

  if (workflowOrEngagement.status !== "running") {
    return { state: workflowOrEngagement.status ? "healthy" : "unknown", reason: "Workflow not actively running." };
  }

  if (isWorkflowStale(workflowOrEngagement.updatedAt, now, timeoutMs)) {
    const stuckDepartment = detectStuckDepartment(workflowOrEngagement.departments, now, stuckDepartmentTimeoutMs);
    if (stuckDepartment) {
      return {
        state: stuckDepartment.status,
        reason: `Workflow stalled in ${stuckDepartment.department}.`,
        stuckDepartment,
      };
    }

    return { state: "timed-out", reason: "Workflow running beyond safe timeout." };
  }

  const stuckDepartment = detectStuckDepartment(workflowOrEngagement.departments, now, stuckDepartmentTimeoutMs);
  if (stuckDepartment && stuckDepartment.status !== "running") {
    return {
      state: stuckDepartment.status,
      reason: `Workflow stalled in ${stuckDepartment.department}.`,
      stuckDepartment,
    };
  }

  return { state: "running", reason: "Workflow is actively running.", stuckDepartment: stuckDepartment || undefined };
}