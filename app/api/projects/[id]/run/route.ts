import { NextResponse } from "next/server";
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

    if (process.env.NODE_ENV === "production" && !process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "XAI_API_KEY is not configured in .env." }, { status: 503 });
    }

    await runExistingProject(project, {
      onProgress: (event: { type: string; department?: string }) => {
        console.log("workflow-progress", event.type, event.department || project.id);
      },
    });

    return NextResponse.json({ id: project.id, status: project.status });
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
