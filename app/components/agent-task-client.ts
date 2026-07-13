import { getApiErrorMessage } from "./api-error";

export type PublicAgentMetadata = {
  id: string;
  name: string;
  description: string;
  role: string;
  version: string;
  capabilities: string[];
  defaultProvider: string;
  defaultModel: string;
  requiresApproval: boolean;
  enabled: boolean;
};

export type AgentTaskSummary = {
  id: string;
  agentId: string;
  title: string;
  objective: string;
  projectId: string | null;
  engagementId: string | null;
  status: string;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
  output?: unknown;
  error?: string | null;
};

export type TaskDetailResponse = {
  task: {
    id: string;
    agentId: string;
    title: string;
    objective: string;
    instructions?: string;
    context?: unknown;
    status: string;
    approvalStatus: string;
    priority: string;
    provider: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    output?: unknown;
    error?: string | null;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
    estimatedCost?: number | null;
  };
  agent: {
    name: string;
    role: string;
  };
};

export type TaskCreationFormData = {
  agentId: string;
  title: string;
  objective: string;
  instructions: string;
  context: string;
  engagementId: string;
  priority: "low" | "medium" | "high" | "critical";
  provider: "xai" | "mock";
};

export type TaskApprovalAction = "approve" | "reject" | "revision";

type FetchLike = typeof fetch;

const UNSAFE_OUTPUT_KEYS = new Set([
  "apiKey",
  "authorization",
  "debugPrompt",
  "diagnosticTrace",
  "password",
  "rawProviderPayload",
  "rawProviderResponse",
  "rawResponse",
  "secret",
  "stack",
  "stackTrace",
  "systemPrompt",
  "systemPromptSnapshot",
  "token",
]);

function isUnsafeKey(key: string): boolean {
  return UNSAFE_OUTPUT_KEYS.has(key) || key.toLowerCase().includes("secret");
}

function sanitizeStructuredValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStructuredValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const safeEntries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !isUnsafeKey(key))
    .map(([key, nestedValue]) => [key, sanitizeStructuredValue(nestedValue)]);

  return Object.fromEntries(safeEntries);
}

async function parseResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export function buildTaskCreatePayload(formData: TaskCreationFormData) {
  return {
    agentId: formData.agentId,
    title: formData.title,
    objective: formData.objective,
    instructions: formData.instructions || undefined,
    context: formData.context ? { raw: formData.context } : undefined,
    engagementId: formData.engagementId || undefined,
    priority: formData.priority,
    provider: formData.provider,
  };
}

export function mapFieldErrors(errors: string[]): Record<string, string> {
  const fieldMap: Record<string, string> = {};

  for (const error of errors) {
    const [field, message] = error.split(": ");
    if (field && message) {
      fieldMap[field] = message;
    }
  }

  return fieldMap;
}

export function getApprovalRequestConfig(action: TaskApprovalAction, reviewerNotes: string) {
  const payload = reviewerNotes.trim().length > 0 ? { reviewerNotes } : {};

  switch (action) {
    case "approve":
      return { endpoint: "approve", payload };
    case "reject":
      return { endpoint: "reject", payload };
    case "revision":
      return { endpoint: "request-revision", payload };
  }
}

export function sanitizeOutputForDisplay(data: unknown): unknown {
  return sanitizeStructuredValue(data);
}

export async function fetchAgents(fetchImpl: FetchLike = fetch): Promise<PublicAgentMetadata[]> {
  const response = await fetchImpl("/api/agents");
  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to load agents."));
  }

  const agents = Array.isArray((data as { data?: unknown }).data)
    ? ((data as { data: PublicAgentMetadata[] }).data)
    : [];

  return agents.map((agent) => sanitizeOutputForDisplay(agent) as PublicAgentMetadata);
}

export async function fetchTasks(
  filterOptions?: { engagementId?: string; projectId?: string },
  fetchImpl: FetchLike = fetch,
): Promise<AgentTaskSummary[]> {
  const url = new URL("/api/agent-tasks", typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  if (filterOptions?.engagementId) {
    url.searchParams.set("engagementId", filterOptions.engagementId);
  }
  if (filterOptions?.projectId) {
    url.searchParams.set("projectId", filterOptions.projectId);
  }

  const response = await fetchImpl(url.toString());
  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to load tasks."));
  }

  return Array.isArray((data as { data?: unknown }).data)
    ? ((data as { data: AgentTaskSummary[] }).data)
    : [];
}

export async function createTask(
  formData: TaskCreationFormData,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const response = await fetchImpl("/api/agent-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildTaskCreatePayload(formData)),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(getApiErrorMessage(data, "Failed to create task."));
    (error as Error & { payload?: unknown }).payload = data;
    throw error;
  }
}

export async function fetchTaskDetail(
  taskId: string,
  fetchImpl: FetchLike = fetch,
): Promise<TaskDetailResponse> {
  const response = await fetchImpl(`/api/agent-tasks/${taskId}`);
  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to load task details."));
  }

  const detail = (data as { data: TaskDetailResponse }).data;
  return {
    ...detail,
    task: {
      ...detail.task,
      output: sanitizeOutputForDisplay(detail.task.output),
    },
  };
}

export async function runTask(taskId: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const response = await fetchImpl(`/api/agent-tasks/${taskId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to run task."));
  }
}

export async function submitTaskApproval(
  taskId: string,
  action: TaskApprovalAction,
  reviewerNotes: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const { endpoint, payload } = getApprovalRequestConfig(action, reviewerNotes);
  const response = await fetchImpl(`/api/agent-tasks/${taskId}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to submit approval action."));
  }
}