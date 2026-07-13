import { NextRequest, NextResponse } from "next/server";
import {
  getFileReference,
  archiveFile,
  updateFileMetadata
} from "@/services/client-data-room-store";
import { loadProject } from "@/src/storage/projectStore.js";
import { FileReferenceSafeSchema } from "@/schemas/client-data-room";

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
 * GET /api/engagements/[id]/data-room/[fileId]
 * Get file metadata
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse> {
  const { id: engagementId, fileId } = await context.params;

  try {
    const clientId = await resolveClientIdForEngagement(engagementId);
    const file = await getFileReference(clientId, fileId);
    if (!file || !file.engagementIds.includes(engagementId)) {
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
    if (error instanceof Error && error.message.startsWith("Engagement not found:")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
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
    const clientId = await resolveClientIdForEngagement(engagementId);
    const current = await getFileReference(clientId, fileId);
    if (!current || !current.engagementIds.includes(engagementId)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

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

    const updated = await updateFileMetadata(clientId, fileId, {
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
    if (typeof message === "string" && message.startsWith("Engagement not found:")) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }
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
    const clientId = await resolveClientIdForEngagement(engagementId);
    const current = await getFileReference(clientId, fileId);
    if (!current || !current.engagementIds.includes(engagementId)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    await archiveFile(clientId, fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DataRoom DELETE]", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete file";
    if (typeof message === "string" && message.startsWith("Engagement not found:")) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
