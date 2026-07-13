/**
 * Workflow Audit Recorder
 *
 * Utilities for recording agent step execution in project audit trail.
 * Integrates with the existing project.audit structure to track agent steps
 * alongside department execution history.
 */

import type { Project } from "../types/project";
import type { WorkflowAgentAuditEntry } from "./workflow-agent-executor";

/**
 * Audit entry for agent steps in the workflow run audit trail.
 * Extends the standard audit run entry with agent-specific fields.
 */
export type AgentAuditRunEntry = {
  department: "agent-step";
  status: "running" | "completed" | "failed" | "waiting-for-approval";
  type: "agent";
  agentId: string;
  taskId: string;
  title: string;
  startedAt: string;
  completedAt?: string;
  provider?: string;
  model?: string;
  error?: string;
};

/**
 * Record an agent step execution in the project audit trail.
 *
 * Adds an entry to project.audit.runs[] with the agent step result.
 * This preserves the workflow history for later review and compliance.
 *
 * @param project - The project to update
 * @param entry - The agent audit entry from executeWorkflowAgentStep
 * @returns Updated project with audit entry added
 */
export function recordAgentStepInAudit(
  project: Project,
  entry: WorkflowAgentAuditEntry,
): Project {
  const auditEntry: AgentAuditRunEntry = {
    department: "agent-step",
    status: entry.status,
    type: "agent",
    agentId: entry.agentId,
    taskId: entry.taskId,
    title: entry.title,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    provider: entry.provider,
    model: entry.model,
    error: entry.error,
  };

  return {
    ...project,
    audit: {
      ...project.audit,
      runs: [...(project.audit?.runs || []), auditEntry as any],
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get all agent steps from project audit trail.
 * Filters audit.runs[] to return only agent step entries.
 */
export function getAgentStepsFromAudit(project: Project): AgentAuditRunEntry[] {
  return (project.audit?.runs || []).filter(
    (run: any) => run.type === "agent",
  ) as AgentAuditRunEntry[];
}

/**
 * Get agent steps by status from project audit trail.
 * Useful for finding approval-pending or failed steps.
 */
export function getAgentStepsByStatus(
  project: Project,
  status: "running" | "completed" | "failed" | "waiting-for-approval",
): AgentAuditRunEntry[] {
  return getAgentStepsFromAudit(project).filter((entry) => entry.status === status);
}
