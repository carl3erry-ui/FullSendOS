import { NextResponse } from "next/server";
import { createClient } from "../../../src/schemas/clientSchema.js";
import { listClients, saveClient } from "../../../src/storage/clientStore.js";
import { listProjects } from "../../../src/storage/projectStore.js";

function toClientSummary(client: {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  primaryContact?: string;
  lifecycleStatus?: string;
  archivedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}, engagementSummaries: Array<{ clientId?: string | null; updatedAt?: string }>) {
  const related = engagementSummaries.filter((engagement) => engagement.clientId === client.id);
  const lastActivityAt = related
    .map((engagement) => engagement.updatedAt)
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

  return {
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
    engagementCount: related.length,
    lastActivityAt,
  };
}

export async function GET(request?: Request) {
  const url = request ? new URL(request.url) : null;
  const includeArchived = url?.searchParams.get("includeArchived") === "true";
  const includeDeleted = url?.searchParams.get("includeDeleted") === "true";
  const includeAll = url?.searchParams.get("includeAll") === "true";

  const [clients, engagements] = await Promise.all([
    listClients({ includeArchived, includeDeleted, includeAll }),
    listProjects({ includeArchived, includeDeleted, includeAll }),
  ]);
  const safeClients = clients.filter((client): client is NonNullable<(typeof clients)[number]> => Boolean(client));
  const safeEngagements = engagements.filter((engagement): engagement is NonNullable<(typeof engagements)[number]> => Boolean(engagement));
  return NextResponse.json(safeClients.map((client) => toClientSummary(client, safeEngagements)));
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const client = createClient(payload);
    await saveClient(client);
    const [engagements] = await Promise.all([listProjects()]);
    const safeEngagements = engagements.filter((engagement): engagement is NonNullable<(typeof engagements)[number]> => Boolean(engagement));
    return NextResponse.json(toClientSummary(client, safeEngagements), { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "issues" in error && Array.isArray(error.issues)) {
      const fieldErrors = error.issues.slice(0, 12).map((issue: { path?: unknown; message?: unknown }) => ({
        path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "root",
        message: typeof issue.message === "string" ? issue.message : "Invalid value",
      }));

      return NextResponse.json({ error: "Client validation failed.", fieldErrors }, { status: 422 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
