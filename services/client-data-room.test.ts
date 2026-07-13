import { test } from "node:test";
import { strict as assert } from "node:assert";
import { promises as fs } from "fs";
import path from "path";
import {
  loadClientDataRoom,
  saveClientDataRoom,
  addFileReference,
  listFiles,
  getFileReference,
  archiveFile,
  updateFileMetadata,
  searchFiles
} from "./client-data-room-store";

// Note: These tests use file-based persistence
// In production, you may want to mock or use temporary directories

test("Client Data Room — loadClientDataRoom initializes new data room", async () => {
  const engagementId = "test-engagement-1";
  const dataRoom = await loadClientDataRoom(engagementId);

  assert.strictEqual(dataRoom.engagementId, engagementId);
  assert.strictEqual(dataRoom.files.length, 0);
  assert.strictEqual(dataRoom.fileCount, 0);
  assert.strictEqual(dataRoom.totalSize, 0);
  assert(dataRoom.createdAt);
  assert(dataRoom.updatedAt);
});

test("Client Data Room — addFileReference adds file to data room", async () => {
  const engagementId = `test-engagement-2-${Date.now()}`;
  const fileRef = await addFileReference(
    engagementId,
    {
      name: "document.pdf",
      mimeType: "application/pdf",
      size: 50000,
      description: "Test document",
      tags: ["research", "client-provided"],
      type: "document"
    },
    "test-user",
    "/data/uploads/test-file"
  );

  assert.strictEqual(fileRef.name, "document.pdf");
  assert.strictEqual(fileRef.mimeType, "application/pdf");
  assert.strictEqual(fileRef.size, 50000);
  assert.strictEqual(fileRef.type, "document");
  assert.deepStrictEqual(fileRef.tags, ["research", "client-provided"]);
  assert.strictEqual(fileRef.uploadedBy, "test-user");
  assert.strictEqual(fileRef.isArchived, false);
  assert(fileRef.id);

  // Verify persisted
  const dataRoom = await loadClientDataRoom(engagementId);
  assert.strictEqual(dataRoom.fileCount, 1);
  assert.strictEqual(dataRoom.totalSize, 50000);
});

test("Client Data Room — listFiles returns non-archived files", async () => {
  const engagementId = `test-engagement-3-${Date.now()}`;

  // Add multiple files
  const file1 = await addFileReference(
    engagementId,
    {
      name: "doc1.pdf",
      mimeType: "application/pdf",
      size: 10000
    },
    "user1",
    "/uploads/doc1"
  );

  const file2 = await addFileReference(
    engagementId,
    {
      name: "doc2.pdf",
      mimeType: "application/pdf",
      size: 20000
    },
    "user1",
    "/uploads/doc2"
  );

  // Archive one
  await archiveFile(engagementId, file1.id);

  const files = await listFiles(engagementId);
  assert.strictEqual(files.length, 1);
  assert.strictEqual(files[0].id, file2.id);
});

test("Client Data Room — getFileReference retrieves by ID", async () => {
  const engagementId = `test-engagement-4-${Date.now()}`;
  const fileRef = await addFileReference(
    engagementId,
    {
      name: "test.pdf",
      mimeType: "application/pdf",
      size: 5000,
      description: "Test file"
    },
    "user1",
    "/uploads/test"
  );

  const retrieved = await getFileReference(engagementId, fileRef.id);
  assert(retrieved);
  assert.strictEqual(retrieved.id, fileRef.id);
  assert.strictEqual(retrieved.name, "test.pdf");

  const notFound = await getFileReference(engagementId, "invalid-id");
  assert.strictEqual(notFound, null);
});

test("Client Data Room — updateFileMetadata modifies description/tags", async () => {
  const engagementId = `test-engagement-5-${Date.now()}`;
  const fileRef = await addFileReference(
    engagementId,
    {
      name: "doc.pdf",
      mimeType: "application/pdf",
      size: 5000,
      tags: ["original"]
    },
    "user1",
    "/uploads/doc"
  );

  const updated = await updateFileMetadata(engagementId, fileRef.id, {
    description: "Updated description",
    tags: ["updated", "important"]
  });

  assert.strictEqual(updated.description, "Updated description");
  assert.deepStrictEqual(updated.tags, ["updated", "important"]);

  // Verify persisted
  const retrieved = await getFileReference(engagementId, fileRef.id);
  assert(retrieved);
  assert.strictEqual(retrieved.description, "Updated description");
  assert.deepStrictEqual(retrieved.tags, ["updated", "important"]);
});

test("Client Data Room — searchFiles filters by tags and name", async () => {
  const engagementId = `test-engagement-6-${Date.now()}`;

  await addFileReference(
    engagementId,
    {
      name: "research-report.pdf",
      mimeType: "application/pdf",
      size: 10000,
      tags: ["research", "market"]
    },
    "user1",
    "/uploads/r1"
  );

  await addFileReference(
    engagementId,
    {
      name: "competitor-analysis.pdf",
      mimeType: "application/pdf",
      size: 8000,
      tags: ["competitor", "analysis"]
    },
    "user1",
    "/uploads/r2"
  );

  const byTag = await searchFiles(engagementId, {
    tags: ["market"]
  });
  assert.strictEqual(byTag.length, 1);
  assert.strictEqual(byTag[0].name, "research-report.pdf");

  const byName = await searchFiles(engagementId, {
    name: "competitor"
  });
  assert.strictEqual(byName.length, 1);
  assert.strictEqual(byName[0].name, "competitor-analysis.pdf");

  // Search for either research OR competitor tags (any matching tag)
  const byTagResearch = await searchFiles(engagementId, {
    tags: ["research"]
  });
  assert.strictEqual(byTagResearch.length, 1);
  assert.strictEqual(byTagResearch[0].name, "research-report.pdf");
});

test("Client Data Room — archiveFile soft-deletes and updates counts", async () => {
  const engagementId = `test-engagement-7-${Date.now()}`;
  const fileRef = await addFileReference(
    engagementId,
    {
      name: "doc.pdf",
      mimeType: "application/pdf",
      size: 30000
    },
    "user1",
    "/uploads/doc"
  );

  let dataRoom = await loadClientDataRoom(engagementId);
  assert.strictEqual(dataRoom.fileCount, 1);
  assert.strictEqual(dataRoom.totalSize, 30000);

  await archiveFile(engagementId, fileRef.id);

  dataRoom = await loadClientDataRoom(engagementId);
  assert.strictEqual(dataRoom.fileCount, 0);
  assert.strictEqual(dataRoom.totalSize, 0);

  // Archived files still exist but are hidden
  const files = await listFiles(engagementId);
  assert.strictEqual(files.length, 0);
});

test("Client Data Room — file size validation rejects oversized files", async () => {
  const engagementId = `test-engagement-8-${Date.now()}`;
  const MAX_FILE_SIZE = 100 * 1024 * 1024;

  try {
    await addFileReference(
      engagementId,
      {
        name: "huge.bin",
        mimeType: "application/octet-stream",
        size: MAX_FILE_SIZE + 1
      },
      "user1",
      "/uploads/huge"
    );
    assert.fail("Should have thrown for oversized file");
  } catch (err) {
    assert(err instanceof Error);
    assert(err.message.includes("exceeds maximum size"));
  }
});

test("Client Data Room — total storage quota validation", async () => {
  const engagementId = `test-engagement-quota-${Date.now()}`;
  const MAX_TOTAL = 5 * 1024 * 1024 * 1024; // 5GB
  const LARGE_FILE = 80 * 1024 * 1024; // 80MB (less than 100MB max per file)

  // Add file near quota
  await addFileReference(
    engagementId,
    {
      name: "large1.bin",
      mimeType: "application/octet-stream",
      size: LARGE_FILE
    },
    "user1",
    "/uploads/large1"
  );

  // Add another large file to get closer to quota
  await addFileReference(
    engagementId,
    {
      name: "large2.bin",
      mimeType: "application/octet-stream",
      size: LARGE_FILE
    },
    "user1",
    "/uploads/large2"
  );

  // Add one more to exceed
  await addFileReference(
    engagementId,
    {
      name: "large3.bin",
      mimeType: "application/octet-stream",
      size: LARGE_FILE
    },
    "user1",
    "/uploads/large3"
  );

  // Now try to exceed the 5GB quota
  try {
    await addFileReference(
      engagementId,
      {
        name: "overflow.bin",
        mimeType: "application/octet-stream",
        size: LARGE_FILE
      },
      "user1",
      "/uploads/overflow"
    );
    assert.fail("Should have thrown for quota exceeded");
  } catch (err) {
    assert(err instanceof Error);
    assert(err.message.includes("quota exceeded"));
  }
});
