import { NextResponse } from "next/server";
import { createEmptyProject } from "../../../src/schemas/projectSchema.js";
import { listProjects, saveProject } from "../../../src/storage/projectStore.js";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const project = createEmptyProject(payload);
    await saveProject(project);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
