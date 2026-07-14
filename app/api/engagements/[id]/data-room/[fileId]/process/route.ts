import { NextRequest, NextResponse } from "next/server";
import { loadProject } from "@/src/storage/projectStore.js";
import { processDataRoomFile } from "@/services/data-room-processing-service";

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
 * POST /api/engagements/[id]/data-room/[fileId]/process
 * Compatibility route for engagement-scoped UI processing action.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse> {
  const { id: engagementId, fileId } = await context.params;

  try {
    const clientId = await resolveClientIdForEngagement(engagementId);
    const document = await processDataRoomFile(clientId, fileId, { engagementId });

    return NextResponse.json({
      success: true,
      engagementId,
      clientId,
      document,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Engagement not found:")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Failed to process file";
    if (message === "File not found" || message === "File not linked to engagement") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
