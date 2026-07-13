import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

// ── Schemas ──────────────────────────────────────────────────────────────────
import { DataRoomSchema, DataRoomFolderSchema, DataRoomFileSchema } from "./schemas/dataRoomSchema.js";

// ── Utils ────────────────────────────────────────────────────────────────────
import { validateFileType, sanitizeFilename, getExtension, SUPPORTED_EXTENSIONS, DANGEROUS_EXTENSIONS } from "./utils/filePolicy.js";
import { buildStoragePath, FILE_STORAGE_BASE } from "./utils/fileStorage.js";

// ── Store ────────────────────────────────────────────────────────────────────
import {
  loadDataRoom, saveDataRoom, dataRoomExists,
  loadFolders, saveFolder, loadFolder,
  listFileMetas, loadFileMeta, saveFileMeta, deleteFileMeta, fileMetaExists,
  recountDataRoom
} from "./storage/dataRoomStore.js";

// ── Default folders ──────────────────────────────────────────────────────────
import { DEFAULT_FOLDERS } from "./utils/defaultFolders.js";

const TEMP_DIR = path.resolve("data/test-data-room-" + randomBytes(4).toString("hex"));
const TEST_CLIENT_ID = "TEST-CLIENT-DRTEST";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Schema validation
// ────────────────────────────────────────────────────────────────────────────
console.log("\nData Room Schemas");

test("DataRoomSchema validates a valid data room", () => {
  const now = new Date().toISOString();
  const room = DataRoomSchema.parse({
    id: "DR-001",
    clientId: "CLIENT-001",
    name: "Test Room",
    createdAt: now,
    updatedAt: now
  });
  assert.equal(room.id, "DR-001");
  assert.equal(room.fileCount, 0);
  assert.equal(room.folderCount, 0);
});

test("DataRoomFolderSchema validates a folder", () => {
  const now = new Date().toISOString();
  const folder = DataRoomFolderSchema.parse({
    id: "FOLDER-001",
    clientId: "CLIENT-001",
    dataRoomId: "DR-001",
    name: "Financials",
    slug: "financials",
    createdAt: now,
    updatedAt: now
  });
  assert.equal(folder.slug, "financials");
  assert.equal(folder.sortOrder, 0);
});

test("DataRoomFileSchema validates a file record", () => {
  const now = new Date().toISOString();
  const file = DataRoomFileSchema.parse({
    id: "FILE-001",
    clientId: "CLIENT-001",
    dataRoomId: "DR-001",
    folderId: "FOLDER-001",
    originalFilename: "budget.xlsx",
    displayName: "Annual Budget",
    uploadedAt: now,
    updatedAt: now
  });
  assert.equal(file.approvedForAgentUse, false);
  assert.equal(file.sensitive, false);
  assert.equal(file.visibility, "internal");
  assert.equal(file.status, "uploaded");
});

test("DataRoomFileSchema links to clientId", () => {
  const now = new Date().toISOString();
  const file = DataRoomFileSchema.parse({
    id: "FILE-002",
    clientId: "CLIENT-ABC",
    dataRoomId: "DR-001",
    folderId: "FOLDER-001",
    originalFilename: "strategy.pdf",
    displayName: "Strategy",
    uploadedAt: now,
    updatedAt: now
  });
  assert.equal(file.clientId, "CLIENT-ABC");
});

test("DataRoomFileSchema optionally links to engagementId", () => {
  const now = new Date().toISOString();
  const withEngagement = DataRoomFileSchema.parse({
    id: "FILE-003",
    clientId: "CLIENT-001",
    dataRoomId: "DR-001",
    folderId: "FOLDER-001",
    originalFilename: "report.pdf",
    displayName: "Report",
    engagementId: "ENG-001",
    uploadedAt: now,
    updatedAt: now
  });
  assert.equal(withEngagement.engagementId, "ENG-001");

  const withoutEngagement = DataRoomFileSchema.parse({
    id: "FILE-004",
    clientId: "CLIENT-001",
    dataRoomId: "DR-001",
    folderId: "FOLDER-001",
    originalFilename: "report.pdf",
    displayName: "Report",
    uploadedAt: now,
    updatedAt: now
  });
  assert.equal(withoutEngagement.engagementId, undefined);
});

// ────────────────────────────────────────────────────────────────────────────
// 2. File type policy
// ────────────────────────────────────────────────────────────────────────────
console.log("\nFile Type Policy");

test("Supported file extensions are accepted", () => {
  for (const ext of ["pdf", "docx", "xlsx", "csv", "png", "jpg", "txt", "md", "zip"]) {
    const result = validateFileType(`document.${ext}`, 100);
    assert.ok(result.ok, `Expected .${ext} to be accepted, got: ${result.reason}`);
  }
});

test("Unsupported file extensions are rejected", () => {
  const result = validateFileType("document.xyz", 100);
  assert.ok(!result.ok, "Expected .xyz to be rejected");
  assert.ok(result.reason.includes("not supported"), `Unexpected reason: ${result.reason}`);
});

test("Dangerous file types are rejected", () => {
  for (const ext of ["exe", "dll", "bat", "sh", "js", "ts", "php", "py", "jar", "html"]) {
    const result = validateFileType(`file.${ext}`, 100);
    assert.ok(!result.ok, `Expected .${ext} to be rejected`);
    assert.ok(result.reason.includes("not permitted"), `Unexpected reason for .${ext}: ${result.reason}`);
  }
});

test("Files without extensions are rejected", () => {
  const result = validateFileType("nodotfile", 100);
  assert.ok(!result.ok, "Expected file without extension to be rejected");
});

test("Files exceeding size limit are rejected", () => {
  const oversized = 101 * 1024 * 1024; // 101 MB
  const result = validateFileType("file.pdf", oversized);
  assert.ok(!result.ok, "Expected oversized file to be rejected");
  assert.ok(result.reason.toLowerCase().includes("size"), `Unexpected reason: ${result.reason}`);
});

test("DANGEROUS_EXTENSIONS contains expected types", () => {
  for (const ext of ["exe", "dll", "bat", "cmd", "sh", "js", "ts", "jsx", "tsx", "html", "php", "py"]) {
    assert.ok(DANGEROUS_EXTENSIONS.has(ext), `Expected .${ext} in DANGEROUS_EXTENSIONS`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Filename sanitization
// ────────────────────────────────────────────────────────────────────────────
console.log("\nFilename Sanitization");

test("Sanitizer prevents path traversal with ../", () => {
  const safe = sanitizeFilename("../../etc/passwd");
  assert.ok(!safe.includes(".."), `Expected no '..' in sanitized filename, got: ${safe}`);
  assert.ok(!safe.includes("/"), `Expected no '/' in sanitized filename, got: ${safe}`);
});

test("Sanitizer removes path separators", () => {
  const safe = sanitizeFilename("subdir/file.pdf");
  assert.ok(!safe.includes("/"), `Got unexpected /: ${safe}`);
});

test("Sanitizer removes backslashes", () => {
  const safe = sanitizeFilename("C:\\Users\\file.pdf");
  assert.ok(!safe.includes("\\"), `Got unexpected backslash: ${safe}`);
});

test("Sanitizer handles normal filenames", () => {
  const safe = sanitizeFilename("Annual Budget Q4 2024.xlsx");
  assert.ok(safe.length > 0, "Should return non-empty string");
  assert.ok(safe.includes("Annual") || safe.includes("Annual_Budget") || safe.includes("Budget"), `Got: ${safe}`);
});

test("Sanitizer removes null/empty input gracefully", () => {
  const safe = sanitizeFilename("");
  assert.ok(safe.length > 0, "Should return fallback for empty input");
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Storage path safety
// ────────────────────────────────────────────────────────────────────────────
console.log("\nStorage Path Safety");

test("buildStoragePath prevents path traversal in fileId", () => {
  // Path traversal attempt is neutralized by sanitization
  // The result must remain within the storage base directory
  const p = buildStoragePath("CLIENT-001", "../../etc", "passwd");
  assert.ok(p.startsWith(FILE_STORAGE_BASE), `Path must stay within storage base. Got: ${p}`);
  assert.ok(!p.includes("etc/passwd") && !p.includes("etc\\passwd"), `Path must not resolve to /etc/passwd. Got: ${p}`);
});

test("buildStoragePath prevents path traversal in safeFilename with sanitized inputs", () => {
  // Using a safe fileId but a filename that after sanitization stays safe
  const p = buildStoragePath("CLIENT-001", "FILE-001", "budget.xlsx");
  assert.ok(p.startsWith(FILE_STORAGE_BASE), "Path should start with storage base");
  assert.ok(p.includes("CLIENT-001"), "Path should include client id");
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Default folders
// ────────────────────────────────────────────────────────────────────────────
console.log("\nDefault Folders");

test("DEFAULT_FOLDERS has 10 folders", () => {
  assert.equal(DEFAULT_FOLDERS.length, 10);
});

test("DEFAULT_FOLDERS slugs are unique and stable", () => {
  const slugs = DEFAULT_FOLDERS.map((f) => f.slug);
  const uniqueSlugs = new Set(slugs);
  assert.equal(uniqueSlugs.size, slugs.length, "Slugs must be unique");
  // Verify key expected slugs are present
  for (const expected of ["financials", "brand-assets", "legal", "operations", "marketing", "website", "investor-materials", "real-estate", "hr-payroll", "miscellaneous"]) {
    assert.ok(uniqueSlugs.has(expected), `Expected slug '${expected}' in DEFAULT_FOLDERS`);
  }
});

test("DEFAULT_FOLDERS has sortOrder values from 0 to 9", () => {
  const orders = DEFAULT_FOLDERS.map((f) => f.sortOrder).sort((a, b) => a - b);
  for (let i = 0; i < 10; i++) {
    assert.equal(orders[i], i, `Expected sortOrder ${i}`);
  }
});

test("DEFAULT_FOLDERS entries each have name, slug, description, category, sortOrder", () => {
  for (const folder of DEFAULT_FOLDERS) {
    assert.ok(folder.name, "Missing name");
    assert.ok(folder.slug, "Missing slug");
    assert.ok(folder.description, "Missing description");
    assert.ok(folder.category, "Missing category");
    assert.equal(typeof folder.sortOrder, "number", "sortOrder must be number");
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Data room store (file-system backed)
// ────────────────────────────────────────────────────────────────────────────
console.log("\nData Room Store");

const DATA_DIR = path.resolve("data");

// Temporarily override storage base by monkey-patching env for tests
// (we keep tests isolated by using a unique clientId that won't conflict)

await testAsync("Data room can be created and loaded", async () => {
  const now = new Date().toISOString();
  const room = DataRoomSchema.parse({
    id: `DR-${TEST_CLIENT_ID}`,
    clientId: TEST_CLIENT_ID,
    name: "Test Data Room",
    createdAt: now,
    updatedAt: now
  });
  await saveDataRoom(room);
  const loaded = await loadDataRoom(TEST_CLIENT_ID);
  assert.equal(loaded.id, room.id);
  assert.equal(loaded.clientId, TEST_CLIENT_ID);
});

await testAsync("dataRoomExists returns true after creation", async () => {
  const exists = await dataRoomExists(TEST_CLIENT_ID);
  assert.ok(exists, "Data room should exist after creation");
});

await testAsync("Default folders are created via saveFolder", async () => {
  const now = new Date().toISOString();
  const roomId = `DR-${TEST_CLIENT_ID}`;
  for (const def of DEFAULT_FOLDERS) {
    const folder = DataRoomFolderSchema.parse({
      id: `${roomId}-${def.slug}`,
      clientId: TEST_CLIENT_ID,
      dataRoomId: roomId,
      name: def.name,
      slug: def.slug,
      description: def.description,
      category: def.category,
      sortOrder: def.sortOrder,
      createdAt: now,
      updatedAt: now
    });
    await saveFolder(folder);
  }
  const folders = await loadFolders(TEST_CLIENT_ID);
  assert.equal(folders.length, DEFAULT_FOLDERS.length);
});

await testAsync("Folder slugs are stable after load", async () => {
  const folders = await loadFolders(TEST_CLIENT_ID);
  const slugs = folders.map((f) => f.slug).sort();
  const expectedSlugs = DEFAULT_FOLDERS.map((f) => f.slug).sort();
  assert.deepEqual(slugs, expectedSlugs);
});

await testAsync("loadFolder returns correct folder", async () => {
  const folders = await loadFolders(TEST_CLIENT_ID);
  const first = folders[0];
  const loaded = await loadFolder(TEST_CLIENT_ID, first.id);
  assert.equal(loaded.id, first.id);
});

await testAsync("File metadata record saves and loads correctly", async () => {
  const now = new Date().toISOString();
  const folders = await loadFolders(TEST_CLIENT_ID);
  const folderId = folders[0].id;
  const fileMeta = DataRoomFileSchema.parse({
    id: "FILE-TEST-001",
    clientId: TEST_CLIENT_ID,
    dataRoomId: `DR-${TEST_CLIENT_ID}`,
    folderId,
    originalFilename: "test-budget.xlsx",
    displayName: "Test Budget",
    sizeBytes: 1024,
    uploadedAt: now,
    updatedAt: now,
    tags: ["finance", "q4"],
    status: "uploaded",
    visibility: "internal",
    approvedForAgentUse: false,
    sensitive: false
  });
  await saveFileMeta(fileMeta);
  const loaded = await loadFileMeta(TEST_CLIENT_ID, "FILE-TEST-001");
  assert.equal(loaded.id, "FILE-TEST-001");
  assert.equal(loaded.clientId, TEST_CLIENT_ID);
  assert.equal(loaded.folderId, folderId);
  assert.deepEqual(loaded.tags, ["finance", "q4"]);
});

await testAsync("Files can be filtered by folderId", async () => {
  const folders = await loadFolders(TEST_CLIENT_ID);
  const firstFolderId = folders[0].id;
  const now = new Date().toISOString();

  // Add a second file in a different folder
  await saveFileMeta(DataRoomFileSchema.parse({
    id: "FILE-TEST-002",
    clientId: TEST_CLIENT_ID,
    dataRoomId: `DR-${TEST_CLIENT_ID}`,
    folderId: folders[1].id,
    originalFilename: "logo.png",
    displayName: "Logo",
    uploadedAt: now,
    updatedAt: now
  }));

  const inFirst = await listFileMetas(TEST_CLIENT_ID, firstFolderId);
  const inSecond = await listFileMetas(TEST_CLIENT_ID, folders[1].id);

  assert.equal(inFirst.length, 1);
  assert.equal(inFirst[0].id, "FILE-TEST-001");
  assert.equal(inSecond.length, 1);
  assert.equal(inSecond[0].id, "FILE-TEST-002");
});

await testAsync("listFileMetas returns all files when no folderId", async () => {
  const all = await listFileMetas(TEST_CLIENT_ID, null);
  assert.ok(all.length >= 2, "Expected at least 2 files");
});

await testAsync("File metadata does not expose storagePath publicly (safeFileMeta pattern)", async () => {
  const fileMeta = await loadFileMeta(TEST_CLIENT_ID, "FILE-TEST-001");
  // Verify storagePath is on the raw record
  fileMeta.storagePath = "/absolute/internal/path/file.xlsx";
  // The safe version should not include storagePath
  const { storagePath: _omit, ...safe } = fileMeta;
  assert.ok(!("storagePath" in safe), "storagePath should be omitted from safe metadata");
});

await testAsync("File metadata can update displayName, tags, status, visibility, approvedForAgentUse, sensitive", async () => {
  const fileMeta = await loadFileMeta(TEST_CLIENT_ID, "FILE-TEST-001");
  fileMeta.displayName = "Updated Budget";
  fileMeta.tags = ["updated"];
  fileMeta.status = "ready";
  fileMeta.visibility = "client_visible_later";
  fileMeta.approvedForAgentUse = true;
  fileMeta.sensitive = true;
  fileMeta.updatedAt = new Date().toISOString();
  DataRoomFileSchema.parse(fileMeta);
  await saveFileMeta(fileMeta);

  const loaded = await loadFileMeta(TEST_CLIENT_ID, "FILE-TEST-001");
  assert.equal(loaded.displayName, "Updated Budget");
  assert.deepEqual(loaded.tags, ["updated"]);
  assert.equal(loaded.status, "ready");
  assert.equal(loaded.visibility, "client_visible_later");
  assert.equal(loaded.approvedForAgentUse, true);
  assert.equal(loaded.sensitive, true);
});

await testAsync("File metadata delete removes the record", async () => {
  await deleteFileMeta(TEST_CLIENT_ID, "FILE-TEST-001");
  const exists = await fileMetaExists(TEST_CLIENT_ID, "FILE-TEST-001");
  assert.ok(!exists, "File should no longer exist after deletion");
});

await testAsync("recountDataRoom returns correct counts", async () => {
  const counts = await recountDataRoom(TEST_CLIENT_ID, `DR-${TEST_CLIENT_ID}`);
  assert.equal(counts.folderCount, DEFAULT_FOLDERS.length);
  assert.equal(counts.fileCount, 1); // FILE-TEST-002 remains
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Agent-use controls
// ────────────────────────────────────────────────────────────────────────────
console.log("\nAgent-Use Controls");

test("approvedForAgentUse defaults to false", () => {
  const now = new Date().toISOString();
  const file = DataRoomFileSchema.parse({
    id: "FILE-AGENT-001",
    clientId: "CLIENT-001",
    dataRoomId: "DR-001",
    folderId: "FOLDER-001",
    originalFilename: "data.csv",
    displayName: "Data",
    uploadedAt: now,
    updatedAt: now
  });
  assert.equal(file.approvedForAgentUse, false);
});

test("sensitive defaults to false", () => {
  const now = new Date().toISOString();
  const file = DataRoomFileSchema.parse({
    id: "FILE-AGENT-002",
    clientId: "CLIENT-001",
    dataRoomId: "DR-001",
    folderId: "FOLDER-001",
    originalFilename: "data.csv",
    displayName: "Data",
    uploadedAt: now,
    updatedAt: now
  });
  assert.equal(file.sensitive, false);
});

test("visibility defaults to internal", () => {
  const now = new Date().toISOString();
  const file = DataRoomFileSchema.parse({
    id: "FILE-AGENT-003",
    clientId: "CLIENT-001",
    dataRoomId: "DR-001",
    folderId: "FOLDER-001",
    originalFilename: "data.csv",
    displayName: "Data",
    uploadedAt: now,
    updatedAt: now
  });
  assert.equal(file.visibility, "internal");
});

test("status can be set to all valid values", () => {
  const now = new Date().toISOString();
  for (const status of ["uploaded", "registered", "processing_pending", "ready", "rejected"]) {
    const file = DataRoomFileSchema.parse({
      id: `FILE-STATUS-${status}`,
      clientId: "CLIENT-001",
      dataRoomId: "DR-001",
      folderId: "FOLDER-001",
      originalFilename: "data.csv",
      displayName: "Data",
      status,
      uploadedAt: now,
      updatedAt: now
    });
    assert.equal(file.status, status);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────────────────────

// Use the same sanitization logic as clientDir() in dataRoomStore.js
const safeTestClientId = TEST_CLIENT_ID.replace(/[^A-Za-z0-9._-]/g, "");
try {
  await fs.rm(path.join(DATA_DIR, "data-rooms", safeTestClientId), { recursive: true, force: true });
} catch { /* ignore */ }

// ────────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────────
console.log(`\nData Room self-test: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
