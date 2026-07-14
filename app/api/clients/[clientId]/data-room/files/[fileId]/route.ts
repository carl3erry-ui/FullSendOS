import { NextRequest, NextResponse } from "next/server";
import {
  getFileReference,
  archiveFile,
  updateFileMetadata
} from "@/services/client-data-room-store";
import { loadClient } from "@/src/storage/clientStore.js";
import { FileReferenceSafeSchema } from "@/schemas/client-data-room";

/**
 * GET /api/clients/[clientId]/data-room/files/[fileId]
 * Get file metadata
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ clientId: string; fileId: string }> }
): Promise<NextResponse> {
  const { clientId, fileId } = await context.params;

  try {
    await loadClient(clientId);
    const file = await getFileReference(clientId, fileId);
    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const safeRef = FileReferenceSafeSchema.parse(file);
    return NextResponse.json(safeRef);
  } catch (error) {
    console.error("[DataRoom File GET]", error);
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
      { error: "Failed to retrieve file" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[clientId]/data-room/files/[fileId]
 * Update file metadata
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ clientId: string; fileId: string }> }
): Promise<NextResponse> {
  const { clientId, fileId } = await context.params;

  try {
    await loadClient(clientId);
    const body = await request.json();
    const {
      description,
      tags,
      type,
      engagementIds,
      approvedForAgentUse,
      sensitive
    } = body;

    if (
      description === undefined &&
      tags === undefined &&
      type === undefined &&
      engagementIds === undefined &&
      approvedForAgentUse === undefined &&
      sensitive === undefined
    ) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = await updateFileMetadata(clientId, fileId, {
      description,
      tags,
      type,
      engagementIds,
      approvedForAgentUse,
      sensitive
    });

    const safeRef = FileReferenceSafeSchema.parse(updated);
    return NextResponse.json({
      success: true,
      file: safeRef
    });
  } catch (error) {
    console.error("[DataRoom File PATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update file";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[clientId]/data-room/files/[fileId]
 * Archive (soft delete) file
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ clientId: string; fileId: string }> }
): Promise<NextResponse> {
  const { clientId, fileId } = await context.params;

  try {
    await loadClient(clientId);
    await archiveFile(clientId, fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DataRoom File DELETE]", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete file";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
