/**
 * POST /api/agent-tasks - Create a new agent task
 * GET /api/agent-tasks - List agent tasks with optional filtering
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AgentTaskSchema,
  globalTaskStore,
  globalAgentRegistry,
} from "@/agents";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
  toFieldErrors,
} from "../agent-routes-helper";

// ---------------------------------------------------------------------------
// Schema for task creation
// ---------------------------------------------------------------------------

const CreateAgentTaskInputSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  title: z.string().min(1, "title is required"),
  objective: z.string().min(1, "objective is required"),
  projectId: z.string().optional().nullable(),
  engagementId: z.string().optional().nullable(),
  workflowRunId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  instructions: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
  priority: z
    .enum(["low", "medium", "high", "critical"])
    .default("medium")
    .optional(),
  provider: z.enum(["xai", "mock"]).optional(),
  model: z.string().optional(),
  requestedBy: z.string().optional(),
  approvalStatus: z
    .enum([
      "not_required",
      "pending",
      "approved",
      "rejected",
      "revision_requested",
    ])
    .optional(),
});

// ---------------------------------------------------------------------------
// POST - Create task
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Validate input
    const parsed = CreateAgentTaskInputSchema.parse(payload);

    // Verify agent exists and is enabled
    const agentDef = globalAgentRegistry.getById(parsed.agentId);
    if (!agentDef) {
      return errorResponse(
        "AGENT_NOT_FOUND",
        `Agent "${parsed.agentId}" not found.`,
        404,
      );
    }

    if (!agentDef.enabled) {
      return errorResponse(
        "AGENT_DISABLED",
        `Agent "${parsed.agentId}" is disabled.`,
        403,
      );
    }

    // Create task with sensible defaults
    const now = new Date().toISOString();
    const taskId = `task-${parsed.agentId}-${Date.now()}`;

    const task = AgentTaskSchema.parse({
      id: taskId,
      agentId: parsed.agentId,
      title: parsed.title,
      objective: parsed.objective,
      projectId: parsed.projectId ?? null,
      engagementId: parsed.engagementId ?? null,
      workflowRunId: parsed.workflowRunId ?? null,
      departmentId: parsed.departmentId ?? null,
      instructions: parsed.instructions,
      input: parsed.input,
      context: parsed.context,
      status: "queued",
      priority: parsed.priority ?? "medium",
      provider: parsed.provider ?? agentDef.defaultProvider,
      model: parsed.model ?? agentDef.defaultModel,
      requestedBy: parsed.requestedBy,
      approvalStatus: parsed.approvalStatus ?? (agentDef.requiresApproval ? "pending" : "not_required"),
      createdAt: now,
      updatedAt: now,
    });

    // Persist task
    await globalTaskStore.saveTask(task);

    return successResponse(task, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(
        "Agent task validation failed.",
        toFieldErrors(error.issues),
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}

// ---------------------------------------------------------------------------
// GET - List tasks with optional filtering
// ---------------------------------------------------------------------------

const ListQuerySchema = z.object({
  projectId: z.string().optional(),
  engagementId: z.string().optional(),
  workflowRunId: z.string().optional(),
  agentId: z.string().optional(),
  status: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = ListQuerySchema.parse({
      projectId: searchParams.get("projectId") ?? undefined,
      engagementId: searchParams.get("engagementId") ?? undefined,
      workflowRunId: searchParams.get("workflowRunId") ?? undefined,
      agentId: searchParams.get("agentId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const tasks = await globalTaskStore.listTasks({
      projectId: query.projectId || undefined,
      engagementId: query.engagementId || undefined,
      workflowRunId: query.workflowRunId || undefined,
      agentId: query.agentId,
      status: query.status as any,
    });

    return successResponse(tasks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse("Invalid query parameters.", toFieldErrors(error.issues));
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse("INTERNAL_ERROR", message, 500);
  }
}
