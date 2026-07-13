import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  loadClientDataRoom,
  addFileReference,
  listFiles,
  getFileReference,
  archiveFile,
  updateFileMetadata,
  searchFiles
} from "@/services/client-data-room-store";
import { FileReferenceSafeSchema } from "@/schemas/client-data-room";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

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
    const query = request.nextUrl.searchParams;
    const tags = query.get("tags")?.split(",").filter(Boolean) || undefined;
    const name = query.get("name") || undefined;
    const type = query.get("type") || undefined;

    let files;
    if (tags || name || type) {
      files = await searchFiles(engagementId, { tags, name, type });
    } else {
      files = await listFiles(engagementId);
    }

    // Safe response: omit storagePath
    const safeFiles = files.map((f) => FileReferenceSafeSchema.parse(f));

    return NextResponse.json({
      engagementId,
      fileCount: files.length,
      files: safeFiles
    });
  } catch (error) {
    console.error("[DataRoom GET]", error);
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
    const uploadedBy = (formData.get("uploadedBy") as string) || "system";

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
    const storageName = `${engagementId}-${Date.now()}-${basename}${ext}`;
    const storagePath = path.join(UPLOAD_DIR, storageName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(storagePath, Buffer.from(arrayBuffer));

    // Record in data room
    const fileRef = await addFileReference(
      engagementId,
      {
        name: file.name,
        mimeType: file.type,
        size: file.size,
        description,
        tags,
        type: type as any
      },
      uploadedBy,
      storagePath
    );

    // Safe response
    const safeRef = FileReferenceSafeSchema.parse(fileRef);

    return NextResponse.json(
      {
        success: true,
        file: safeRef
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DataRoom POST]", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
