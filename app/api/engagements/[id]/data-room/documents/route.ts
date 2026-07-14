import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/src/storage/projectStore.js";
import {
  listDataRoomDocuments,
  toSafeDataRoomDocuments,
} from "@/services/data-room-document-store";

async function resolveClientIdForEngagement(engagementId: string): Promise<string> {
  try {
    const project = await loadProject(engagementId);
    return project.clientId || project.id;
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(`Engagement not found: ${engagementId}`);
    }
    throw error;
  }
}

/**
 * GET /api/engagements/[id]/data-room/documents
 * List processed metadata for documents linked to an engagement.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: engagementId } = await context.params;

  try {
    const clientId = await resolveClientIdForEngagement(engagementId);
    const query = new URL(request.url).searchParams;
    const fileId = query.get("fileId") || undefined;
    const folderId = query.get("folderId") || undefined;
    const detectedDocumentType = query.get("detectedDocumentType") || undefined;
    const processingStatus = query.get("processingStatus") || undefined;
    const keywords =
      query
        .get("keywords")
        ?.split(",")
        .map((kw) => kw.trim())
        .filter(Boolean) || undefined;

    const documents = await listDataRoomDocuments(clientId, {
      fileId,
      engagementId,
      folderId,
      detectedDocumentType,
      processingStatus,
      keywords,
    });

    return NextResponse.json({
      engagementId,
      clientId,
      count: documents.length,
      documents: toSafeDataRoomDocuments(documents),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Engagement not found:")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to list engagement documents" },
      { status: 500 }
    );
  }
}
