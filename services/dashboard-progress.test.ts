import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { listProjects, saveProject } from "../src/storage/projectStore.js";

const storageDir = path.resolve("data/projects");

async function cleanupProject(id: string) {
  await fs.rm(path.join(storageDir, `${id}.json`), { force: true });
}

function calculateDashboardAverage(projects: Array<{ completedDepartments: number; totalDepartments: number }>) {
  if (!projects.length) return 0;
  return Math.round(
    (projects.reduce((sum, project) => {
      if (!project.totalDepartments) return sum;
      return sum + project.completedDepartments / project.totalDepartments;
    }, 0) /
      projects.length) *
      100,
  );
}

test("progress summaries reflect new, partial, successful, and failed runs with accurate average", async () => {
  const now = Date.now();

  const newProject = createEmptyProject({
    companyName: `Progress New ${now}`,
    objective: "New project progress should be zero",
  });

  const partialProject = createEmptyProject({
    companyName: `Progress Partial ${now}`,
    objective: "Partial run should report completed subset",
  });
  partialProject.status = "running";
  partialProject.audit.runs = [
    { department: "research", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "competitors", startedAt: new Date().toISOString(), status: "running", model: "grok-4.5" },
  ];

  const successfulProject = createEmptyProject({
    companyName: `Progress Success ${now}`,
    objective: "Successful run should report full completion",
  });
  successfulProject.status = "needs-review";
  successfulProject.audit.runs = [
    { department: "research", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "competitors", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "customers", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "strategy", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "brand", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "website", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "publishing", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
  ];

  const failedProject = createEmptyProject({
    companyName: `Progress Failed ${now}`,
    objective: "Failed run should not inherit stale completion counts",
  });
  failedProject.status = "failed";
  failedProject.audit.runs = [
    { department: "research", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "competitors", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "customers", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "strategy", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "brand", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "website", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "publishing", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "complete", model: "grok-4.5" },
    { department: "research", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: "failed", model: "grok-4.5", error: "Validation failed" },
  ];

  const ids = [newProject.id, partialProject.id, successfulProject.id, failedProject.id];

  await Promise.all([saveProject(newProject), saveProject(partialProject), saveProject(successfulProject), saveProject(failedProject)]);

  try {
    const summaries = await listProjects();
    const byId = new Map(summaries.map((summary) => [summary.id, summary]));

    assert.equal(byId.get(newProject.id)?.completedDepartments, 0);
    assert.equal(byId.get(partialProject.id)?.completedDepartments, 1);
    assert.equal(byId.get(successfulProject.id)?.completedDepartments, 7);
    assert.equal(byId.get(failedProject.id)?.completedDepartments, 0);

    const subset = [
      byId.get(newProject.id),
      byId.get(partialProject.id),
      byId.get(successfulProject.id),
      byId.get(failedProject.id),
    ].filter(Boolean) as Array<{ completedDepartments: number; totalDepartments: number }>;

    assert.equal(calculateDashboardAverage(subset), 29);
  } finally {
    await Promise.all(ids.map((id) => cleanupProject(id)));
  }
});
