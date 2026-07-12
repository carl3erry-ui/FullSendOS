import { NextResponse } from "next/server";
import { loadProject } from "../../../../src/storage/projectStore.js";

function toDetailResponse(project: Record<string, any>) {
  return {
    id: project.id,
    clientId: project.clientId || null,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    client: {
      companyName: project.client?.companyName,
      contactName: project.client?.contactName,
      website: project.client?.website,
      industry: project.client?.industry,
      geography: Array.isArray(project.client?.geography) ? project.client.geography : [],
    },
    brief: {
      objective: project.brief?.objective,
      requestedDeliverables: Array.isArray(project.brief?.requestedDeliverables)
        ? project.brief.requestedDeliverables
        : [],
    },
    departments: project.departments || {},
    deliverables: {
      executiveReport: project.deliverables?.executiveReport,
      onePageSummary: project.deliverables?.onePageSummary,
      deckOutline: Array.isArray(project.deliverables?.deckOutline) ? project.deliverables.deckOutline : [],
    },
    audit: {
      activeRun: project.audit?.activeRun || null,
      runs: Array.isArray(project.audit?.runs) ? project.audit.runs : [],
      warnings: Array.isArray(project.audit?.warnings) ? project.audit.warnings : [],
    },
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await loadProject(id);
    return NextResponse.json(toDetailResponse(project));
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
