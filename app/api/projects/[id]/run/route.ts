import { NextResponse } from "next/server";
import { runExistingProject } from "../../../../../src/orchestrator/orchestrator.js";
import { loadProject } from "../../../../../src/storage/projectStore.js";

function normalizeRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
    return { status: 404, message: "Project not found." };
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
    return NextResponse.json({ error: normalized.message }, { status: normalized.status });
  }
}
