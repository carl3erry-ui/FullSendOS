import { NextRequest, NextResponse } from "next/server";
import { loadClient } from "@/src/storage/clientStore.js";
import {
  getDataRoomDocument,
  toSafeDataRoomDocument,
} from "@/services/data-room-document-store";

/**
 * GET /api/clients/[clientId]/data-room/documents/[documentId]
 * Get one processed document metadata record.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ clientId: string; documentId: string }> }
): Promise<NextResponse> {
  const { clientId, documentId } = await context.params;

  try {
    await loadClient(clientId);

    const document = await getDataRoomDocument(clientId, documentId);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(toSafeDataRoomDocument(document));
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}
