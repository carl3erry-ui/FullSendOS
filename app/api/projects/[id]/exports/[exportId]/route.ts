import { NextResponse } from "next/server";
import { loadProject } from "../../../../../../src/storage/projectStore.js";
import { getDeliverableExport } from "@/services/deliverable-export-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; exportId: string }> },
) {
  try {
    const { id, exportId } = await params;
    await loadProject(id);
    const record = await getDeliverableExport(id, exportId);

    if (!record) {
      return NextResponse.json({ error: "Export not found." }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
