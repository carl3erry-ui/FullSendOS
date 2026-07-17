import { NextResponse } from "next/server";
import { loadProject } from "../../../../../src/storage/projectStore.js";
import { failWorkflowRun } from "../../../../../src/orchestrator/runLifecycle.js";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await loadProject(id);

    if (project.status !== "running" && !project.audit?.activeRun) {
      return NextResponse.json(
        {
          ok: false,
          error: "Workflow is not currently running.",
          engagementId: id,
          status: project.status,
          safeToRetry: true,
        },
        { status: 409 },
      );
    }

    await failWorkflowRun(project, "Workflow aborted by operator.");

    return NextResponse.json({
      ok: true,
      engagementId: id,
      status: "failed",
      reason: "Workflow aborted by operator.",
      safeToRetry: true,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ ok: false, error: "Engagement not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}