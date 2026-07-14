import { loadProject } from "../../../../../../../src/storage/projectStore.js";
import { getDeliverableExport } from "@/services/deliverable-export-store";

function safeAttachmentFilename(name: string, fallback: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

  return cleaned.length > 0 ? cleaned : fallback;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; exportId: string }> },
) {
  try {
    const { id, exportId } = await params;
    await loadProject(id);

    const record = await getDeliverableExport(id, exportId);
    if (!record) {
      return Response.json({ error: "Export not found." }, { status: 404 });
    }

    if (record.engagementId !== id) {
      return Response.json({ error: "Export does not belong to the requested engagement." }, { status: 404 });
    }

    const filename = safeAttachmentFilename(record.filename, `deliverable-${record.format}.txt`);

    return new Response(record.content, {
      status: 200,
      headers: {
        "Content-Type": record.contentType,
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
