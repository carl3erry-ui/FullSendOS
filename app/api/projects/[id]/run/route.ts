import { NextResponse } from "next/server";
import { beginWorkflowRun, getActiveRunSnapshot, isActiveRun, markRunStaleAsFailed } from "../../../../../src/orchestrator/runLifecycle.js";
import { runExistingProject } from "../../../../../src/orchestrator/orchestrator.js";
import { loadProject } from "../../../../../src/storage/projectStore.js";

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
  const message = error instanceof Error ? error.message : "Unknown error";

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

  if (message.includes("XAI_API_KEY is not configured")) {
    return { status: 503, message };
  }

  return { status: 500, message };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await loadProject(id);

    await markRunStaleAsFailed(project);

    if (isActiveRun(project)) {
      const active = getActiveRunSnapshot(project);
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
      return NextResponse.json({ error: "XAI_API_KEY is not configured in .env." }, { status: 503 });
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
      const message = backgroundError instanceof Error ? backgroundError.message : "Unknown background workflow error";
      console.error("workflow-run-background-error", project.id, message);
    });

    return NextResponse.json(
      {
        id: project.id,
        status: "running",
        activeRunId: activeRun.id,
      },
      { status: 202 },
    );
  } catch (error) {
    const normalized = normalizeRouteError(error);
    return NextResponse.json(
      normalized.fieldErrors
        ? { error: normalized.message, fieldErrors: normalized.fieldErrors }
        : { error: normalized.message },
      { status: normalized.status },
    );
  }
}
