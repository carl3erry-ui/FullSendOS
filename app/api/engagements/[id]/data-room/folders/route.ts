import { NextRequest, NextResponse } from "next/server";
import { getFolders } from "@/services/client-data-room-store";
import { loadProject } from "@/src/storage/projectStore.js";

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
 * GET /api/engagements/[id]/data-room/folders
 * Compatibility view: lists client-owned folders for this engagement.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: engagementId } = await context.params;

  try {
    const clientId = await resolveClientIdForEngagement(engagementId);
    const folders = await getFolders(clientId);

    return NextResponse.json({
      engagementId,
      clientId,
      folders,
    });
  } catch (error) {
    console.error("[DataRoom Folders GET]", error);
    const message = error instanceof Error ? error.message : "Failed to list folders";

    if (typeof message === "string" && message.startsWith("Engagement not found:")) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to list folders" },
      { status: 500 }
    );
  }
}
