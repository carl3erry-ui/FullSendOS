import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getEngagementDetail } from "../app/api/engagements/[id]/route";
import { GET as getProjectDetail } from "../app/api/projects/[id]/route";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveProject } from "../src/storage/projectStore.js";

const projectsDir = path.resolve("data/projects");

async function cleanupProject(id: string) {
  await fs.rm(path.join(projectsDir, `${id}.json`), { force: true });
}

test("engagement detail API returns the existing persisted record and matches project detail route", async () => {
  const project = createEmptyProject({
    companyName: "Detail API Co",
    objective: "Validate detail endpoint",
  });

  project.status = "needs-review";
  project.deliverables.executiveReport = "Executive report body";
  project.deliverables.onePageSummary = "One-page summary";
  project.deliverables.deckOutline = [
    { slide: 1, title: "Opening", purpose: "Set context", keyPoints: ["Problem", "Opportunity"] },
  ];
  project.audit.runs.push({
    department: "research",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: "complete",
    model: "grok-4.5",
  });
  project.audit.warnings.push("Review assumptions before client delivery.");

  await saveProject(project);

  try {
    const engagementResponse = await getEngagementDetail(new Request("http://127.0.0.1/api/engagements/id"), {
      params: Promise.resolve({ id: project.id }),
    });
    const projectResponse = await getProjectDetail(new Request("http://127.0.0.1/api/projects/id"), {
      params: Promise.resolve({ id: project.id }),
    });

    const engagementBody = await engagementResponse.json();
    const projectBody = await projectResponse.json();

    assert.equal(engagementResponse.status, 200);
    assert.equal(projectResponse.status, 200);
    assert.equal(engagementBody.id, project.id);
    assert.equal(engagementBody.status, "needs-review");
    assert.equal(typeof engagementBody.deliverables.executiveReport, "string");
    assert.equal(Array.isArray(engagementBody.audit.runs), true);

    assert.deepEqual(engagementBody, projectBody);
  } finally {
    await cleanupProject(project.id);
  }
});

test("unknown engagement detail returns 404", async () => {
  const response = await getEngagementDetail(new Request("http://127.0.0.1/api/engagements/unknown"), {
    params: Promise.resolve({ id: "UNKNOWN-ENGAGEMENT-ID" }),
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, "Project not found.");
});

test("engagement detail API does not create duplicate records", async () => {
  const project = createEmptyProject({
    companyName: "Detail Persistence Co",
    objective: "Ensure detail read path does not write files",
  });

  await saveProject(project);

  const before = (await fs.readdir(projectsDir)).filter((name) => name.endsWith(".json"));

  try {
    const response = await getEngagementDetail(new Request("http://127.0.0.1/api/engagements/id"), {
      params: Promise.resolve({ id: project.id }),
    });
    assert.equal(response.status, 200);

    const after = (await fs.readdir(projectsDir)).filter((name) => name.endsWith(".json"));
    assert.equal(after.length, before.length);
    assert.equal(after.filter((name) => name === `${project.id}.json`).length, 1);
  } finally {
    await cleanupProject(project.id);
  }
});
