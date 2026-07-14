import { NextResponse } from "next/server";
import { loadProject } from "../../../../../src/storage/projectStore.js";
import { buildWorkProductEvidenceForDetail } from "@/services/work-product-evidence";
import { buildDeliverableExport } from "@/services/deliverable-export-service";
import { resolveDeliverableTemplate } from "@/services/deliverable-template-service";
import {
  createDeliverableExport,
  listDeliverableExports,
} from "@/services/deliverable-export-store";
import { DeliverableExportCreateInputSchema } from "@/schemas/deliverable-export";
import type { EngagementDetail } from "@/app/components/work-product-model";

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

async function toDetailResponse(project: ProjectDetailRecord): Promise<EngagementDetail> {
  const baseDetail: EngagementDetail = {
    id: project.id,
    status: project.status || "draft",
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

function hasWorkProduct(detail: EngagementDetail): boolean {
  const executive = Boolean(detail.deliverables?.executiveReport?.trim());
  const summary = Boolean(detail.deliverables?.onePageSummary?.trim());
  const deck = Array.isArray(detail.deliverables?.deckOutline) && detail.deliverables.deckOutline.length > 0;
  return executive || summary || deck;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await loadProject(id);
    const exports = await listDeliverableExports(id);
    return NextResponse.json(exports);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await loadProject(id);
    const input = DeliverableExportCreateInputSchema.parse(await request.json());
    const detail = await toDetailResponse(project);

    if (!hasWorkProduct(detail)) {
      return NextResponse.json(
        { error: "Export requires a generated work product." },
        { status: 422 },
      );
    }

    const template = resolveDeliverableTemplate(input.templateId, input.format);
    if (!template) {
      return NextResponse.json(
        { error: "Invalid template selection for the requested format." },
        { status: 422 },
      );
    }

    const record = await buildDeliverableExport({
      engagementId: id,
      clientId: project.clientId || undefined,
      engagementTitle: project.client?.companyName || id,
      clientName: project.client?.companyName || undefined,
      sourceWorkProductId: `${id}:${project.updatedAt || "latest"}`,
      detail,
      format: input.format,
      template,
    });

    const created = await createDeliverableExport(record);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (typeof error === "object" && error && "issues" in error && Array.isArray(error.issues)) {
      const fieldErrors = error.issues.slice(0, 10).map((issue: { path?: unknown; message?: unknown }) => ({
        path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "root",
        message: typeof issue.message === "string" ? issue.message : "Invalid value",
      }));
      return NextResponse.json({ error: "Export validation failed.", fieldErrors }, { status: 422 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
