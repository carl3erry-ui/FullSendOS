import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  addFileReference,
  listFiles,
  searchFiles
} from "@/services/client-data-room-store";
import { loadProject } from "@/src/storage/projectStore.js";
import { FileReferenceSafeSchema } from "@/schemas/client-data-room";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

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
 * GET /api/engagements/[id]/data-room
 * List all files in client data room
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: engagementId } = await context.params;

  try {
    const clientId = await resolveClientIdForEngagement(engagementId);
    const query = new URL(request.url).searchParams;
    const folderId = query.get("folderId") || undefined;
    const tags = query.get("tags")?.split(",").filter(Boolean) || undefined;
    const name = query.get("name") || undefined;
    const type = query.get("type") || undefined;

    let files;
    if (tags || name || type || folderId) {
      files = await searchFiles(clientId, {
        tags,
        name,
        type,
        folderId,
        engagementId
      });
    } else {
      files = await listFiles(clientId, { engagementId, folderId });
    }

    // Safe response: omit storagePath
    const safeFiles = files.map((f) => FileReferenceSafeSchema.parse(f));

    return NextResponse.json({
      engagementId,
      clientId,
      fileCount: files.length,
      files: safeFiles
    });
  } catch (error) {
    console.error("[DataRoom GET]", error);
    if (error instanceof Error && error.message.startsWith("Engagement not found:")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to list data room files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/engagements/[id]/data-room
 * Upload a new file to data room
 * Expects multipart/form-data with file and optional metadata
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: engagementId } = await context.params;

  try {
    const clientId = await resolveClientIdForEngagement(engagementId);
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const description = (formData.get("description") as string) || undefined;
    const tagsStr = formData.get("tags") as string;
    const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()) : [];
    const type = (formData.get("type") as string) || "other";
    const folderId = (formData.get("folderId") as string) || undefined;
    const uploadedBy = (formData.get("uploadedBy") as string) || "system";
    const engagementIdsStr = formData.get("engagementIds") as string;
    const engagementIds = engagementIdsStr
      ? engagementIdsStr.split(",").map((id) => id.trim()).filter(Boolean)
      : [];
    const approvedForAgentUse = formData.get("approvedForAgentUse") === "true";
    const sensitive = formData.get("sensitive") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate MIME type (basic security check)
    const allowedMimes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
      "application/xml",
      "text/xml",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "image/gif"
    ];

    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        {
          error: `File type not allowed. Supported: ${allowedMimes.join(", ")}`
        },
        { status: 400 }
      );
    }

    // Create upload directory
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename and save
    const ext = path.extname(file.name);
    const basename = path.basename(file.name, ext);
    const storageName = `${clientId}-${Date.now()}-${basename}${ext}`;
    const storagePath = path.join(UPLOAD_DIR, storageName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(storagePath, Buffer.from(arrayBuffer));

    // Record in data room
    const fileRef = await addFileReference(
      clientId,
      {
        name: file.name,
        mimeType: file.type,
        size: file.size,
        description,
        tags,
        type: type as any,
        folderId,
        engagementIds: Array.from(new Set([engagementId, ...engagementIds])),
        approvedForAgentUse,
        sensitive
      },
      uploadedBy,
      storagePath
    );

    // Safe response
    const safeRef = FileReferenceSafeSchema.parse(fileRef);

    return NextResponse.json(
      {
        success: true,
        clientId,
        engagementId,
        file: safeRef
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DataRoom POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
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
