import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { listProjects, saveProject } from "../src/storage/projectStore.js";
import { createEmptyProject } from "../src/schemas/projectSchema.js";

const storageDir = path.resolve("data/projects");

async function cleanupProject(id: string) {
  await fs.rm(path.join(storageDir, `${id}.json`), { force: true });
}

test("failed latest attempt does not report stale completed departments from previous successful run", async () => {
  const project = createEmptyProject({
    companyName: "Summary Consistency Co",
    objective: "Validate department count consistency",
  });

  const start = new Date().toISOString();
  const end = new Date(Date.now() + 1000).toISOString();

  // Historical successful run with all departments complete.
  project.audit.runs = [
    { department: "research", startedAt: start, completedAt: end, status: "complete", model: "grok-4.5" },
    { department: "competitors", startedAt: start, completedAt: end, status: "complete", model: "grok-4.5" },
    { department: "customers", startedAt: start, completedAt: end, status: "complete", model: "grok-4.5" },
    { department: "strategy", startedAt: start, completedAt: end, status: "complete", model: "grok-4.5" },
    { department: "brand", startedAt: start, completedAt: end, status: "complete", model: "grok-4.5" },
    { department: "website", startedAt: start, completedAt: end, status: "complete", model: "grok-4.5" },
    { department: "publishing", startedAt: start, completedAt: end, status: "complete", model: "grok-4.5" },
    // New failed attempt starts at research.
    { department: "research", startedAt: new Date(Date.now() + 2000).toISOString(), completedAt: new Date(Date.now() + 2500).toISOString(), status: "failed", model: "grok-4.5", error: "Schema validation failed" },
  ];

  project.status = "failed";
  await saveProject(project);

  try {
    const summaries = await listProjects();
    const summary = summaries.find((item) => item?.id === project.id);

    assert.ok(summary);
    assert.equal(summary.status, "failed");
    assert.equal(summary.completedDepartments, 0);
    assert.equal(summary.totalDepartments, 7);
  } finally {
    await cleanupProject(project.id);
  }
});
