import { NextResponse } from "next/server";
import { loadClient } from "../../../../src/storage/clientStore.js";
import { listProjects } from "../../../../src/storage/projectStore.js";

function toEngagementSummary(project: {
  id: string;
  companyName: string;
  objective: string;
  status: string;
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
    updatedAt: project.updatedAt,
    completedDepartments: project.completedDepartments,
    totalDepartments: project.totalDepartments,
    lastRunError: project.lastRunError || null,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await params;
    const [client, projects] = await Promise.all([loadClient(clientId), listProjects()]);
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
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      engagements,
      engagementCount: engagements.length,
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
