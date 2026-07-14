import { NextRequest, NextResponse } from "next/server";
import { loadClient } from "@/src/storage/clientStore.js";
import { processDataRoomFile } from "@/services/data-room-processing-service";

/**
 * POST /api/clients/[clientId]/data-room/files/[fileId]/process
 * Process a client data-room file into safe searchable metadata.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ clientId: string; fileId: string }> }
): Promise<NextResponse> {
  const { clientId, fileId } = await context.params;

  try {
    await loadClient(clientId);
    const document = await processDataRoomFile(clientId, fileId);

    return NextResponse.json({
      success: true,
      document,
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

    const message = error instanceof Error ? error.message : "Failed to process file";
    if (message === "File not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
