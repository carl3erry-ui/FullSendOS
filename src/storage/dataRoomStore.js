import fs from "node:fs/promises";
import path from "node:path";
import { DataRoomSchema, DataRoomFolderSchema, DataRoomFileSchema } from "../schemas/dataRoomSchema.js";

const STORAGE_BASE = path.resolve("data/data-rooms");

function clientDir(clientId) {
  const safe = String(clientId).replace(/[^A-Za-z0-9._-]/g, "");
  if (!safe) throw new Error("Invalid clientId.");
  return path.join(STORAGE_BASE, safe);
}

function dataRoomFile(clientId) {
  return path.join(clientDir(clientId), "data-room.json");
}

function foldersFile(clientId) {
  return path.join(clientDir(clientId), "folders.json");
}

function filesDir(clientId) {
  return path.join(clientDir(clientId), "files");
}

function fileMetaPath(clientId, fileId) {
  const safeId = String(fileId).replace(/[^A-Za-z0-9._-]/g, "");
  return path.join(filesDir(clientId), `${safeId}.json`);
}

async function ensureClientDir(clientId) {
  await fs.mkdir(clientDir(clientId), { recursive: true });
  await fs.mkdir(filesDir(clientId), { recursive: true });
}

// ──────────────────────────────────────────────
// Data Room
// ──────────────────────────────────────────────

export async function loadDataRoom(clientId) {
  const file = dataRoomFile(clientId);
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function saveDataRoom(dataRoom) {
  await ensureClientDir(dataRoom.clientId);
  const file = dataRoomFile(dataRoom.clientId);
  await fs.writeFile(file, JSON.stringify(dataRoom, null, 2), "utf8");
}

export async function dataRoomExists(clientId) {
  try {
    await fs.access(dataRoomFile(clientId));
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Folders
// ──────────────────────────────────────────────

export async function loadFolders(clientId) {
  try {
    const file = foldersFile(clientId);
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return [];
  }
}

export async function saveFolders(clientId, folders) {
  await ensureClientDir(clientId);
  await fs.writeFile(foldersFile(clientId), JSON.stringify(folders, null, 2), "utf8");
}

export async function loadFolder(clientId, folderId) {
  const folders = await loadFolders(clientId);
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) throw new Error(`Folder ${folderId} not found.`);
  return folder;
}

export async function saveFolder(folder) {
  const folders = await loadFolders(folder.clientId);
  const index = folders.findIndex((f) => f.id === folder.id);
  if (index >= 0) {
    folders[index] = folder;
  } else {
    folders.push(folder);
  }
  await saveFolders(folder.clientId, folders);
}

// ──────────────────────────────────────────────
// Files
// ──────────────────────────────────────────────

export async function loadFileMeta(clientId, fileId) {
  const file = fileMetaPath(clientId, fileId);
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function saveFileMeta(fileMeta) {
  await ensureClientDir(fileMeta.clientId);
  const file = fileMetaPath(fileMeta.clientId, fileMeta.id);
  await fs.writeFile(file, JSON.stringify(fileMeta, null, 2), "utf8");
}

export async function listFileMetas(clientId, folderId) {
  try {
    const dir = filesDir(clientId);
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
    const metas = await Promise.all(names.map(async (name) => {
      try {
        return JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
      } catch {
        return null;
      }
    }));
    const valid = metas.filter(Boolean);
    return folderId ? valid.filter((m) => m.folderId === folderId) : valid;
  } catch {
    return [];
  }
}

export async function deleteFileMeta(clientId, fileId) {
  try {
    await fs.unlink(fileMetaPath(clientId, fileId));
  } catch {
    // already gone
  }
}

export async function fileMetaExists(clientId, fileId) {
  try {
    await fs.access(fileMetaPath(clientId, fileId));
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Count helpers
// ──────────────────────────────────────────────

export async function recountDataRoom(clientId, dataRoomId) {
  const folders = await loadFolders(clientId);
  const files = await listFileMetas(clientId, null);
  const folderCount = folders.filter((f) => f.dataRoomId === dataRoomId).length;
  const fileCount = files.filter((f) => f.dataRoomId === dataRoomId).length;
  return { folderCount, fileCount };
}

export { DataRoomSchema, DataRoomFolderSchema, DataRoomFileSchema };
