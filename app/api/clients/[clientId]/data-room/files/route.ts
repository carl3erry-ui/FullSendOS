import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  addFileReference,
  listFiles,
  searchFiles
} from "@/services/client-data-room-store";
import { loadClient } from "@/src/storage/clientStore.js";
import { FileReferenceSafeSchema } from "@/schemas/client-data-room";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/**
 * GET /api/clients/[clientId]/data-room/files
 * List files with optional filtering
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const { clientId } = await context.params;

  try {
    await loadClient(clientId);

    const query = new URL(request.url).searchParams;
    const folderId = query.get("folderId") || undefined;
    const engagementId = query.get("engagementId") || undefined;
    const tags = query.get("tags")?.split(",").filter(Boolean) || undefined;
    const name = query.get("name") || undefined;
    const type = query.get("type") || undefined;

    let files;
    if (tags || name || type || folderId || engagementId) {
      files = await searchFiles(clientId, {
        tags,
        name,
        type,
        folderId,
        engagementId
      });
    } else {
      files = await listFiles(clientId);
    }

    const safeFiles = files.map((f) => FileReferenceSafeSchema.parse(f));

    return NextResponse.json({
      clientId,
      fileCount: files.length,
      files: safeFiles
    });
  } catch (error) {
    console.error("[DataRoom Files GET]", error);
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
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[clientId]/data-room/files
 * Upload file to client data room
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const { clientId } = await context.params;

  try {
    await loadClient(clientId);

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
      ? engagementIdsStr.split(",").map((id) => id.trim())
      : [];
    const approvedForAgentUse =
      formData.get("approvedForAgentUse") === "true";
    const sensitive = formData.get("sensitive") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate MIME type
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

    // Generate unique filename
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
        engagementIds,
        approvedForAgentUse,
        sensitive
      },
      uploadedBy,
      storagePath
    );

    const safeRef = FileReferenceSafeSchema.parse(fileRef);

    return NextResponse.json(
      {
        success: true,
        file: safeRef
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DataRoom Files POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && message.includes("not found") ? 404 : 500 }
    );
  }
}
