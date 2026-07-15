import { NextResponse } from "next/server";
import { loadClient, updateClientLifecycle } from "../../../../src/storage/clientStore.js";
import { listProjects } from "../../../../src/storage/projectStore.js";
import { ensureClientBaseline } from "@/services/client-baseline-store";

function toEngagementSummary(project: {
  id: string;
  companyName: string;
  objective: string;
  status: string;
  lifecycleStatus?: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
  updatedAt?: string;
  completedDepartments: number;
  totalDepartments: number;
  lastRunError?: string | null;
}) {
  return {
    id: project.id,
    companyName: project.companyName,
    objective: project.objective,
    status: project.status,
    lifecycleStatus: project.lifecycleStatus || "active",
    archivedAt: project.archivedAt || null,
    deletedAt: project.deletedAt || null,
    updatedAt: project.updatedAt,
    completedDepartments: project.completedDepartments,
    totalDepartments: project.totalDepartments,
    lastRunError: project.lastRunError || null,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";
    const includeAll = url.searchParams.get("includeAll") === "true";
    const { clientId } = await params;
    const [client, projects] = await Promise.all([
      loadClient(clientId),
      listProjects({ includeArchived, includeDeleted, includeAll }),
    ]);
    const baseline = await ensureClientBaseline(client.id, client.name);
    const engagements = projects
      .filter((project): project is NonNullable<(typeof projects)[number]> => Boolean(project))
      .filter((project) => project.clientId === client.id)
      .map(toEngagementSummary);

    return NextResponse.json({
      id: client.id,
      name: client.name,
      industry: client.industry || "",
      website: client.website || "",
      primaryContact: client.primaryContact || "",
      lifecycleStatus: client.lifecycleStatus || "active",
      archivedAt: client.archivedAt || null,
      deletedAt: client.deletedAt || null,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      engagements,
      engagementCount: engagements.length,
      baseline,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await params;
    const payload = await request.json();
    const action = payload?.action;

    if (!["archive", "restore", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid lifecycle action." }, { status: 422 });
    }

    const client = await updateClientLifecycle(clientId, action);
    return NextResponse.json({
      id: client.id,
      lifecycleStatus: client.lifecycleStatus || "active",
      archivedAt: client.archivedAt || null,
      deletedAt: client.deletedAt || null,
      updatedAt: client.updatedAt,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
