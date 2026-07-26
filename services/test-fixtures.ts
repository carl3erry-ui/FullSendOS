import type { AgentTask } from "../agents/types";
import type { Project } from "../types/project";

function nowIso(): string {
  return new Date().toISOString();
}

export function createTestProject(overrides: Partial<Project> = {}): Project {
  const now = nowIso();

  const base: Project = {
    id: "test-project-123",
    client: {
      companyName: "Test Company",
      contactName: "John Doe",
      website: "https://test.com",
      industry: "Tech",
    },
    objective: {
      summary: "Test objective",
      constraints: [],
      requestedDeliverables: [],
    },
    status: "in-progress",
    createdAt: now,
    updatedAt: now,
    workflow: {
      initializedAt: now,
      stages: [],
      stageResults: {},
    },
    deliverables: {
      assets: {},
    },
    evidence: {
      sources: [],
      items: [],
    },
    departments: {
      intelligence: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      strategy: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      creative: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
      publishing: { status: "pending", outputs: {}, unknowns: [], warnings: [] },
    },
    audit: {
      activeRun: null,
      runs: [],
      warnings: [],
    },
  };

  return {
    ...base,
    ...overrides,
    client: {
      ...base.client,
      ...overrides.client,
    },
    objective: {
      ...base.objective,
      ...overrides.objective,
    },
    workflow: {
      ...base.workflow,
      ...overrides.workflow,
    },
    deliverables: {
      ...base.deliverables,
      ...overrides.deliverables,
    },
    evidence: {
      ...base.evidence,
      ...overrides.evidence,
    },
    departments: {
      ...base.departments,
      ...overrides.departments,
    },
    audit:
      overrides.audit === undefined
        ? base.audit
        : {
            ...base.audit,
            ...overrides.audit,
          },
  };
}

export function createTestAgentTask(overrides: Partial<AgentTask> = {}): AgentTask {
  const now = nowIso();

  return {
    id: "task-test-1",
    agentId: "orchestrator",
    title: "Plan",
    objective: "Plan engagement",
    status: "queued",
    approvalStatus: "not_required",
    priority: "medium",
    provider: "mock",
    model: "mock-1.0",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}