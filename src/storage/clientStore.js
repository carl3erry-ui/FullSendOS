import fs from "node:fs/promises";
import path from "node:path";
import { ClientSchema } from "../schemas/clientSchema.js";

const storageDir = path.resolve("data/clients");

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

export async function listClients() {
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
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}