/**
 * Orchestrator Agent Integration Example
 *
 * This file demonstrates how to integrate workflow agent steps into
 * the existing orchestrator.js PIPELINE loop. It shows:
 *
 * 1. Optional research agent step before strategy department
 * 2. Optional QC review step after research
 * 3. How to record steps in audit trail
 * 4. How to handle approval gates
 *
 * NOT YET INTEGRATED into src/orchestrator/orchestrator.js — this is a reference
 * implementation for Step 7 of Slice 6. To activate:
 *
 * 1. Import executeWorkflowAgentStep and recordAgentStepInAudit
 * 2. Add conditional steps in the PIPELINE loop
 * 3. Update project and save after each step
 * 4. Handle waiting-for-approval status by pausing/failing workflow
 */

import type { Project } from "../types/project";
import { executeWorkflowAgentStep, type WorkflowAgentStepConfig } from "./workflow-agent-executor";
import {
  recordAgentStepInAudit,
  getAgentStepsByStatus,
} from "./workflow-audit-recorder";

/**
 * Check if workflow has approval gates that require pausing.
 */
export function hasApprovalGates(project: Project): boolean {
  return getAgentStepsByStatus(project, "waiting-for-approval").length > 0;
}

/**
 * Should workflow pause pending approvals?
 */
export function shouldPauseWorkflow(project: Project): boolean {
  // Pause if any agent steps are waiting for approval
  return hasApprovalGates(project);
}

// ============================================================================
// Example 1: Optional research advisor step
// ============================================================================

export async function tryResearchAdvisorStep(
  project: Project,
  options: {
    enabled: boolean;
    requiresApproval?: boolean;
  },
): Promise<{ project: Project; stepExecuted: boolean }> {
  if (!options.enabled) {
    return { project, stepExecuted: false };
  }

  const step: WorkflowAgentStepConfig = {
    agentId: "researcher",
    title: "Research Advisor Review",
    objective: `Review the project brief and provide early research recommendations before full workflow execution. Project: ${project.id}`,
    instructions:
      "Provide high-level research guidance on key questions that should be answered before strategy development.",
    requiresApproval: options.requiresApproval ?? false,
  };

  const entry = await executeWorkflowAgentStep({
    project,
    step,
    workflowRunId: `run-${project.id}-${Date.now()}`,
  });

  // If approval is required and pending, pause workflow
  if (entry.status === "waiting-for-approval") {
    console.log(
      `workflow-progress research-advisor-awaiting-approval ${project.id}`,
    );
    // Workflow should check project.audit for waiting-for-approval status before continuing
    // Return updated project without executing further steps
    const updatedProject = recordAgentStepInAudit(project, entry);
    return { project: updatedProject, stepExecuted: false };
  }

  // Record step in audit
  const updatedProject = recordAgentStepInAudit(project, entry);

  if (entry.status === "failed") {
    console.log(`workflow-progress research-advisor-failed ${project.id}`);
    // Workflow can either continue or fail based on requirements
    // For now, just log and continue
  }

  return { project: updatedProject, stepExecuted: true };
}

// ============================================================================
// Example 2: Optional QC review step after research
// ============================================================================

export async function tryQualityControlReviewStep(
  project: Project,
  options: {
    enabled: boolean;
    requiresApproval?: boolean;
  },
): Promise<{ project: Project; stepExecuted: boolean }> {
  if (!options.enabled) {
    return { project, stepExecuted: false };
  }

  const step: WorkflowAgentStepConfig = {
    agentId: "quality-control",
    title: "Research Output QC Review",
    objective: `Quality control review of research outputs before proceeding to strategy. Project: ${project.id}`,
    instructions:
      "Review research findings for logical consistency, evidence support, and confidence levels. Flag any gaps or unsupported claims.",
    requiresApproval: options.requiresApproval ?? false,
  };

  const entry = await executeWorkflowAgentStep({
    project,
    step,
    workflowRunId: `run-${project.id}-${Date.now()}`,
    departmentId: "research",
  });

  if (entry.status === "waiting-for-approval") {
    console.log(`workflow-progress qc-review-awaiting-approval ${project.id}`);
    const updatedProject = recordAgentStepInAudit(project, entry);
    return { project: updatedProject, stepExecuted: false };
  }

  const updatedProject = recordAgentStepInAudit(project, entry);

  if (entry.status === "failed") {
    console.log(`workflow-progress qc-review-failed ${project.id}`);
  }

  return { project: updatedProject, stepExecuted: true };
}

// ============================================================================
// Example 3: How to integrate into orchestrator.js PIPELINE loop
// ============================================================================

/**
 * Pseudo-code showing how to integrate agent steps into orchestrator.js:
 *
 * ```javascript
 * // In src/orchestrator/orchestrator.js, in the main run loop:
 *
 * // Before strategy department, optionally run research advisor
 * if (features.researchAdvisor) {
 *   const { project: updated, stepExecuted } = await tryResearchAdvisorStep(project, {
 *     enabled: true,
 *     requiresApproval: false, // or true for gates
 *   });
 *   project = updated;
 *
 *   // Check if workflow is paused waiting for approval
 *   const pendingApprovals = getAgentStepsByStatus(project, "waiting-for-approval");
 *   if (pendingApprovals.length > 0) {
 *     console.log("workflow-progress awaiting-approval-gate");
 *     break; // Pause workflow until approvals are completed
 *   }
 * }
 *
 * // Continue with normal department loop
 * for (const dept of PIPELINE) {
 *   // ... existing department execution code ...
 * }
 * ```
 */

