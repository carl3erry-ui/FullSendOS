import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const FILE_STORAGE_BASE = path.resolve("data/data-room-files");

export async function ensureStorageDir(clientId) {
  const safeClientId = String(clientId).replace(/[^A-Za-z0-9._-]/g, "");
  if (!safeClientId) throw new Error("Invalid clientId for storage path.");
  const dir = path.join(FILE_STORAGE_BASE, safeClientId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function buildStoragePath(clientId, fileId, safeFilename) {
  const safeClientId = String(clientId).replace(/[^A-Za-z0-9._-]/g, "");
  const safeFileId = String(fileId).replace(/[^A-Za-z0-9._-]/g, "");
  const filename = `${safeFileId}-${safeFilename}`;
  // Guard against path traversal: resolved path must be a descendant of base.
  // Allow: starts with base+sep (file inside dir) or equals base (the dir itself).
  // Reject: anything outside the base directory.
  const resolved = path.resolve(FILE_STORAGE_BASE, safeClientId, filename);
  const base = path.resolve(FILE_STORAGE_BASE, safeClientId);
  const insideBase = resolved.startsWith(base + path.sep) || resolved === base;
  if (!insideBase) {
    throw new Error("Path traversal detected.");
  }
  return resolved;
}

export async function writeFileToStorage(clientId, fileId, safeFilename, data) {
  await ensureStorageDir(clientId);
  const storagePath = buildStoragePath(clientId, fileId, safeFilename);
  await fs.writeFile(storagePath, data);
  return storagePath;
}

export async function deleteFileFromStorage(storagePath) {
  try {
    await fs.unlink(storagePath);
  } catch {
    // Ignore missing file errors during cleanup
  }
}

export function computeChecksum(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export { FILE_STORAGE_BASE };
