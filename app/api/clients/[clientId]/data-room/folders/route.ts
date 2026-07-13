import { NextRequest, NextResponse } from "next/server";
import { getFolders } from "@/services/client-data-room-store";
import { loadClient } from "@/src/storage/clientStore.js";

/**
 * GET /api/clients/[clientId]/data-room/folders
 * List default and custom folders
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const { clientId } = await context.params;

  try {
    await loadClient(clientId);
    const folders = await getFolders(clientId);

    return NextResponse.json({
      clientId,
      folders
    });
  } catch (error) {
    console.error("[DataRoom Folders GET]", error);
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to list folders" },
      { status: 500 }
    );
  }
}
