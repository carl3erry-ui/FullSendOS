import fs from "node:fs/promises";
import path from "node:path";
import {
  ClientBaselineSchema,
  ClientBaselineUpsertSchema,
  createEmptyClientBaseline,
  normalizeUpsertInput,
  type ClientBaseline,
  type ClientBaselineUpsertInput,
} from "@/schemas/client-baseline";

const CLIENT_DIR = path.resolve("data/clients");

function baselinePath(clientId: string): string {
  const safe = String(clientId).replace(/[^A-Za-z0-9._-]/g, "");
  return path.join(CLIENT_DIR, `${safe}-baseline.json`);
}

export async function loadClientBaseline(clientId: string): Promise<ClientBaseline | null> {
  try {
    const raw = await fs.readFile(baselinePath(clientId), "utf8");
    return ClientBaselineSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function saveClientBaselineRecord(record: ClientBaseline): Promise<ClientBaseline> {
  await fs.mkdir(CLIENT_DIR, { recursive: true });
  const file = baselinePath(record.clientId);
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  const validated = ClientBaselineSchema.parse(record);
  await fs.writeFile(temp, JSON.stringify(validated, null, 2), "utf8");
  await fs.rename(temp, file);
  return validated;
}

export async function upsertClientBaseline(clientId: string, input: ClientBaselineUpsertInput): Promise<ClientBaseline> {
  const validatedInput = ClientBaselineUpsertSchema.parse(input);
  const normalized = normalizeUpsertInput(validatedInput);
  const existing = await loadClientBaseline(clientId);
  const now = new Date().toISOString();

  const record: ClientBaseline = {
    ...(existing || createEmptyClientBaseline(clientId)),
    ...normalized,
    clientId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  return saveClientBaselineRecord(record);
}

export async function ensureClientBaseline(clientId: string, companyName = ""): Promise<ClientBaseline> {
  const existing = await loadClientBaseline(clientId);
  if (existing) return existing;
  return saveClientBaselineRecord(createEmptyClientBaseline(clientId, companyName));
}
