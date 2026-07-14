import { NextResponse } from "next/server";
import { loadProject, updateProjectLifecycle } from "../../../../src/storage/projectStore.js";
import { buildWorkProductEvidenceForDetail } from "@/services/work-product-evidence";

type ProjectDetailRecord = {
  id: string;
  clientId?: string | null;
  status?: string;
  lifecycleStatus?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  client?: Record<string, any>;
  brief?: Record<string, any>;
  departments?: Record<string, any>;
  deliverables?: Record<string, any>;
  audit?: Record<string, any>;
};

async function toDetailResponse(project: ProjectDetailRecord) {
  const baseDetail = {
    id: project.id,
    clientId: project.clientId || null,
    status: project.status || "draft",
    lifecycleStatus: project.lifecycleStatus || "active",
    archivedAt: project.archivedAt || null,
    deletedAt: project.deletedAt || null,
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

  const evidenceBundle = await buildWorkProductEvidenceForDetail(project, baseDetail);

  return {
    ...baseDetail,
    deliverables: {
      ...baseDetail.deliverables,
      deckOutline: evidenceBundle.deckOutline,
      evidenceReferences: evidenceBundle.evidenceReferences,
      evidenceSummary: evidenceBundle.evidenceSummary,
    },
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await loadProject(id);
    return NextResponse.json(await toDetailResponse(project));
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await request.json();
    const action = payload?.action;

    if (!["archive", "restore", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid lifecycle action." }, { status: 422 });
    }

    const project = await updateProjectLifecycle(id, action);
    return NextResponse.json({
      id: project.id,
      lifecycleStatus: project.lifecycleStatus || "active",
      archivedAt: project.archivedAt || null,
      deletedAt: project.deletedAt || null,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
