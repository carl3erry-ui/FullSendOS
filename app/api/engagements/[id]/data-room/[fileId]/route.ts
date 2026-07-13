import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import {
  getFileReference,
  archiveFile,
  updateFileMetadata
} from "@/services/client-data-room-store";
import { FileReferenceSafeSchema } from "@/schemas/client-data-room";

/**
 * GET /api/engagements/[id]/data-room/[fileId]
 * Get file metadata
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse> {
  const { id: engagementId, fileId } = await context.params;

  try {
    const file = await getFileReference(engagementId, fileId);
    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Safe response: omit storagePath
    const safeRef = FileReferenceSafeSchema.parse(file);
    return NextResponse.json(safeRef);
  } catch (error) {
    console.error("[DataRoom GET file]", error);
    return NextResponse.json(
      { error: "Failed to retrieve file metadata" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/engagements/[id]/data-room/[fileId]
 * Update file metadata (description, tags, type)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse> {
  const { id: engagementId, fileId } = await context.params;

  try {
    const body = await request.json();
    const { description, tags, type } = body;

    if (
      description === undefined &&
      tags === undefined &&
      type === undefined
    ) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = await updateFileMetadata(engagementId, fileId, {
      description,
      tags,
      type
    });

    const safeRef = FileReferenceSafeSchema.parse(updated);
    return NextResponse.json({
      success: true,
      file: safeRef
    });
  } catch (error) {
    console.error("[DataRoom PATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update file";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/engagements/[id]/data-room/[fileId]
 * Archive (soft delete) a file
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse> {
  const { id: engagementId, fileId } = await context.params;

  try {
    await archiveFile(engagementId, fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DataRoom DELETE]", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete file";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
