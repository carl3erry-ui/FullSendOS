import { NextResponse } from "next/server";
import { beginWorkflowRun, getActiveRunSnapshot, isActiveRun, markRunStaleAsFailed } from "../../../../../src/orchestrator/runLifecycle.js";
import { runExistingProject } from "../../../../../src/orchestrator/orchestrator.js";
import { loadProject } from "../../../../../src/storage/projectStore.js";
import { listHumanInputRequests } from "@/services/human-input-service";
import { requireAuthenticatedActor, recordAllow, recordDeny } from "@/lib/security/route-guards";
import { authorizeWorkflowAction } from "@/lib/security/workflow-authorization";
import {
  concealedNotFound,
  isSecurityRouteError,
  toSecurityErrorResponse,
} from "@/lib/security/security-response";

type FieldValidationError = {
  path: string;
  message: string;
};

type RouteError = {
  status: number;
  message: string;
  fieldErrors?: FieldValidationError[];
};

export function normalizeRouteError(error: unknown): RouteError {
  if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
    return { status: 404, message: "Project not found." };
  }

  if (typeof error === "object" && error && "issues" in error && Array.isArray(error.issues)) {
    const fieldErrors = error.issues
      .slice(0, 12)
      .map((issue: { path?: unknown; message?: unknown }) => ({
        path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "root",
        message: typeof issue.message === "string" ? issue.message : "Invalid value",
      }));

    return {
      status: 422,
      message: "Workflow validation failed.",
      fieldErrors,
    };
  }

  if (error instanceof Error && error.message.includes("XAI_API_KEY is not configured")) {
    return { status: 503, message: "Workflow provider is unavailable." };
  }

  return { status: 500, message: "An unexpected error occurred while starting the workflow." };
}

function normalizeLifecycleStatus(project: { lifecycleStatus?: string }) {
  return project.lifecycleStatus || "active";
}

function notRunnableLifecycleResponse(lifecycleStatus: string) {
  return NextResponse.json(
    {
      error: {
        code: "ENGAGEMENT_NOT_RUNNABLE",
        message: "This engagement cannot be run because it is archived or deleted. Restore the engagement before running the workflow.",
        status: lifecycleStatus,
      },
    },
    { status: 409 },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor: Awaited<ReturnType<typeof requireAuthenticatedActor>> | null = null;
  const action = {
    action: "workflow_run",
    resourceType: "project",
    resourceId: "unknown",
  };

  try {
    const { id } = await params;
    action.resourceId = id;

    actor = await requireAuthenticatedActor(request, action);

    let project;
    try {
      project = await loadProject(id);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
        concealedNotFound("workflow_project_not_found");
      }
      throw error;
    }

    authorizeWorkflowAction({
      actor,
      project,
      engagementId: id,
      action: "run",
    });

    const lifecycleStatus = normalizeLifecycleStatus(project);

    if (lifecycleStatus !== "active") {
      await recordDeny(actor, action, "workflow_lifecycle_not_runnable");
      return notRunnableLifecycleResponse(lifecycleStatus);
    }

    const blockingRequests = await listHumanInputRequests({
      engagementId: project.id,
      blockingOnly: true,
    });

    if (blockingRequests.length > 0) {
      await recordDeny(actor, action, "workflow_blocking_input_required");
      return NextResponse.json(
        {
          error: "Human input is required before this workflow can continue.",
          blockingRequestCount: blockingRequests.length,
        },
        { status: 409 },
      );
    }

    await markRunStaleAsFailed(project);

    if (isActiveRun(project)) {
      const active = getActiveRunSnapshot(project);
      await recordDeny(actor, action, "workflow_run_already_active");
      return NextResponse.json(
        {
          error: "Workflow is already running for this project.",
          status: project.status,
          activeRunId: active?.id || null,
          activeRunUpdatedAt: active?.updatedAt || null,
        },
        { status: 409 },
      );
    }

    if (process.env.NODE_ENV === "production" && !process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "Workflow provider is unavailable." }, { status: 503 });
    }

    const model = process.env.XAI_MODEL || "grok-4.5";
    const activeRun = await beginWorkflowRun(project, { model });

    void runExistingProject(project, {
      skipRunStart: true,
      model,
      onProgress: (event: { type: string; department?: string }) => {
        console.log("workflow-progress", event.type, event.department || project.id);
      },
    }).catch((backgroundError) => {
      console.error("workflow-run-background-error", project.id, backgroundError instanceof Error ? backgroundError.name : "Error");
    });

    await recordAllow(actor, action, "workflow_run_started");

    return NextResponse.json(
      {
        id: project.id,
        status: "running",
        activeRunId: activeRun.id,
      },
      { status: 202 },
    );
  } catch (error) {
    if (isSecurityRouteError(error)) {
      if (error.status !== 401) {
        await recordDeny(actor, action, error.reasonCode);
      }
      return toSecurityErrorResponse(error);
    }

    const normalized = normalizeRouteError(error);
    return NextResponse.json(
      normalized.fieldErrors
        ? { error: normalized.message, fieldErrors: normalized.fieldErrors }
        : { error: normalized.message },
      { status: normalized.status },
    );
  }
}
