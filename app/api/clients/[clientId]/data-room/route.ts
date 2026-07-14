import { NextRequest, NextResponse } from "next/server";
import {
  loadClientDataRoom,
  getFolders
} from "@/services/client-data-room-store";
import { loadClient } from "@/src/storage/clientStore.js";

/**
 * GET /api/clients/[clientId]/data-room
 * Overview of client data room (stats and folder list)
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const { clientId } = await context.params;

  try {
    // Verify client exists
    await loadClient(clientId);

    const dataRoom = await loadClientDataRoom(clientId);
    const folders = await getFolders(clientId);

    return NextResponse.json({
      clientId,
      fileCount: dataRoom.fileCount,
      totalSize: dataRoom.totalSize,
      createdAt: dataRoom.createdAt,
      updatedAt: dataRoom.updatedAt,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        slug: f.slug,
        description: f.description,
        category: f.category,
        sortOrder: f.sortOrder,
        fileCount: dataRoom.files.filter(
          (file) => file.folderId === f.id && !file.isArchived
        ).length
      }))
    });
  } catch (error) {
    console.error("[ClientDataRoom GET]", error);
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
      { error: "Failed to load data room" },
      { status: 500 }
    );
  }
}
