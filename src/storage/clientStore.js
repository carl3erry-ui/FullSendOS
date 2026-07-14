import fs from "node:fs/promises";
import path from "node:path";
import { ClientSchema } from "../schemas/clientSchema.js";

const storageDir = path.resolve("data/clients");

function isVisibleByLifecycle(client, options = {}) {
  const lifecycleStatus = client?.lifecycleStatus || "active";
  if (options.includeAll) return true;
  if (lifecycleStatus === "archived") return Boolean(options.includeArchived);
  if (lifecycleStatus === "deleted") return Boolean(options.includeDeleted);
  return true;
}

export async function saveClient(client) {
  const parsed = ClientSchema.parse(client);
  await fs.mkdir(storageDir, { recursive: true });
  const file = path.join(storageDir, `${parsed.id}.json`);
  const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempFile, JSON.stringify(parsed, null, 2), "utf8");
  await fs.rename(tempFile, file);
  return file;
}

export async function loadClient(id) {
  const safeId = String(id).replace(/[^A-Za-z0-9._-]/g, "");
  const file = path.join(storageDir, `${safeId}.json`);
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  return ClientSchema.parse(raw);
}

export async function listClients(options = {}) {
  await fs.mkdir(storageDir, { recursive: true });
  const files = (await fs.readdir(storageDir)).filter((name) => name.endsWith(".json"));
  const clients = await Promise.all(files.map(async (name) => {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(storageDir, name), "utf8"));
      return ClientSchema.parse(raw);
    } catch {
      return null;
    }
  }));

  return clients
    .filter(Boolean)
    .filter((client) => isVisibleByLifecycle(client, options))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function updateClientLifecycle(id, action) {
  const current = await loadClient(id);
  const now = new Date().toISOString();

  const next = {
    ...current,
    lifecycleStatus:
      action === "archive"
        ? "archived"
        : action === "delete"
          ? "deleted"
          : "active",
    archivedAt: action === "archive" ? now : undefined,
    deletedAt: action === "delete" ? now : undefined,
    updatedAt: now,
  };

  await saveClient(next);
  return next;
}