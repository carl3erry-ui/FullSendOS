import { NextRequest, NextResponse } from "next/server";
import { loadClient } from "@/src/storage/clientStore.js";
import {
  listDataRoomDocuments,
  toSafeDataRoomDocuments,
} from "@/services/data-room-document-store";

/**
 * GET /api/clients/[clientId]/data-room/documents
 * List processed document metadata for a client.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const { clientId } = await context.params;

  try {
    await loadClient(clientId);

    const query = new URL(request.url).searchParams;
    const fileId = query.get("fileId") || undefined;
    const engagementId = query.get("engagementId") || undefined;
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
      clientId,
      count: documents.length,
      documents: toSafeDataRoomDocuments(documents),
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}
