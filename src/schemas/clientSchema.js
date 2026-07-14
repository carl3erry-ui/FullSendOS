import { z } from "zod";

export const ClientLifecycleStatusSchema = z.enum(["active", "archived", "deleted"]);

export const ClientSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().optional(),
  website: z.string().url().optional(),
  primaryContact: z.string().optional(),
  lifecycleStatus: ClientLifecycleStatusSchema.default("active"),
  archivedAt: z.string().optional(),
  deletedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function createClient(input) {
  const now = new Date().toISOString();
  const slug = String(input.name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "CLIENT";

  return ClientSchema.parse({
    schemaVersion: "1.0.0",
    id: `${slug}-${Date.now()}`,
    name: input.name,
    industry: input.industry,
    website: input.website,
    primaryContact: input.primaryContact,
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now,
  });
}