/**
 * Intake Enrichment Service (Slice 10)
 *
 * When an engagement is "enrichable", creates:
 *   1. An EnrichmentPlan describing what is known, missing, and what to research
 *   2. An AgentTask assigned to the Research Agent to gather missing context
 *
 * The enrichment task uses the existing Agent Framework (AgentTask schema,
 * globalTaskStore). It does NOT call external APIs directly — the Research
 * Agent handles the structured output with its existing capability set.
 *
 * Limitation: Live web search / external business data lookup requires a
 * connected search provider tool. If unavailable, the Research Agent will
 * produce structured assumptions and flag them as unverified.
 */

import { z } from "zod";
import { globalTaskStore } from "../agents";
import type { AgentTask } from "../agents/types";
import {
  classifyIntake,
  buildResearchQuestions,
  buildAssumptionNote,
  describeIntakeFields,
  EnrichmentPlanSchema,
  type EnrichmentPlan,
  type IntakeContext,
} from "./intake-classifier";

// ---------------------------------------------------------------------------
// Build enrichment plan (pure, no side effects)
// ---------------------------------------------------------------------------

export function buildEnrichmentPlan(
  ctx: IntakeContext,
  projectId: string,
): EnrichmentPlan {
  const classification = classifyIntake(ctx);
  const { knownFields, missingFields } = describeIntakeFields(ctx);
  const researchQuestions = buildResearchQuestions(ctx);
  const assumptionNote = buildAssumptionNote(ctx, classification);

  const canProceed = classification === "complete" || classification === "enrichable";
  const needsHumanConfirmation = classification === "needs_user_input";

  return EnrichmentPlanSchema.parse({
    id: `enrichment-${projectId}-${Date.now()}`,
    projectId,
    intakeClassification: classification,
    createdAt: new Date().toISOString(),
    companyName: ctx.companyName ?? "(unknown)",
    knownFields,
    missingFields,
    researchQuestions,
    canProceed,
    needsHumanConfirmation,
    recommendedAgentId: "researcher",
    assumptionNote,
  });
}

// ---------------------------------------------------------------------------
// Create enrichment agent task
// ---------------------------------------------------------------------------

/**
 * Create a Research Agent task to enrich missing context for an engagement.
 * The task is linked to the projectId/engagementId.
 * Returns the created AgentTask.
 */
export async function createEnrichmentTask(
  plan: EnrichmentPlan,
  options: {
    provider?: "mock" | "xai";
    model?: string;
  } = {},
): Promise<AgentTask> {
  const provider = options.provider ?? "mock";
  const model = options.model ?? "grok-4.5";
  const now = new Date().toISOString();

  const missingList = plan.missingFields.map((f) => `- ${f.label}`).join("\n");
  const questionList = plan.researchQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n");

  const objective = [
    `Research and enrich missing context for "${plan.companyName}".`,
    "",
    "Known information:",
    ...plan.knownFields.map((f) => `- ${f.label}: ${f.currentValue}`),
    "",
    "Missing fields (to be inferred or discovered):",
    missingList,
    "",
    "Research questions:",
    questionList,
    "",
    "For each finding: state the value, confidence level (high/medium/low), source or basis, and whether it is verified or inferred.",
    "Do not fabricate specific addresses. If location cannot be confirmed, state 'unverified — requires confirmation'.",
    plan.assumptionNote,
  ].join("\n");

  const task: AgentTask = {
    id: `task-enrichment-${plan.projectId}-${Date.now()}`,
    agentId: "researcher",
    title: `Research Enrichment: ${plan.companyName}`,
    objective,
    projectId: plan.projectId,
    engagementId: plan.projectId,
    status: "queued",
    approvalStatus: "not_required",
    priority: "high",
    provider,
    model,
    createdAt: now,
    updatedAt: now,
  };

  await globalTaskStore.saveTask(task);
  return task;
}

// ---------------------------------------------------------------------------
// Run full enrichment flow: classify → plan → task
// ---------------------------------------------------------------------------

export type EnrichmentFlowResult =
  | { ok: true; classification: string; plan: EnrichmentPlan; task: AgentTask | null }
  | { ok: false; reason: string; classification: string };

/**
 * Run the full enrichment flow for a newly created project.
 * Returns classification + plan + task (or null if task creation is skipped).
 *
 * @param ctx - Intake context from user input
 * @param projectId - The project being created
 * @param options.createTask - Whether to create the enrichment agent task (default: true for enrichable)
 */
export async function runEnrichmentFlow(
  ctx: IntakeContext,
  projectId: string,
  options: {
    createTask?: boolean;
    provider?: "mock" | "xai";
    model?: string;
  } = {},
): Promise<EnrichmentFlowResult> {
  const classification = classifyIntake(ctx);

  const plan = buildEnrichmentPlan(ctx, projectId);

  if (!plan.canProceed) {
    return {
      ok: false,
      reason: plan.assumptionNote,
      classification,
    };
  }

  // Create enrichment task for enrichable intakes (unless opted out)
  const shouldCreateTask = options.createTask !== false && classification === "enrichable";

  let task: AgentTask | null = null;
  if (shouldCreateTask) {
    try {
      task = await createEnrichmentTask(plan, {
        provider: options.provider,
        model: options.model,
      });
    } catch (err) {
      // Non-fatal: task creation failure doesn't block engagement creation
      console.warn(
        "enrichment-task-creation-failed",
        projectId,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return {
    ok: true,
    classification,
    plan,
    task,
  };
}
