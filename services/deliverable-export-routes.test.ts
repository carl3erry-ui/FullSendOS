import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { GET as getProjectExports, POST as postProjectExports } from "../app/api/projects/[id]/exports/route";
import { GET as getProjectExportDetail } from "../app/api/projects/[id]/exports/[exportId]/route";
import { GET as getProjectExportDownload } from "../app/api/projects/[id]/exports/[exportId]/download/route";
import { GET as getEngagementExports, POST as postEngagementExports } from "../app/api/engagements/[id]/exports/route";
import { GET as getEngagementExportDetail } from "../app/api/engagements/[id]/exports/[exportId]/route";
import { GET as getEngagementExportDownload } from "../app/api/engagements/[id]/exports/[exportId]/download/route";
import { GET as getDeliverableTemplates } from "../app/api/deliverable-templates/route";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { saveProject } from "../src/storage/projectStore.js";

const projectsDir = path.resolve("data/projects");
const exportsDir = path.resolve("data/deliverable-exports");

async function cleanupProject(id: string) {
  await fs.rm(path.join(projectsDir, `${id}.json`), { force: true });
  await fs.rm(path.join(exportsDir, `${id}.json`), { force: true });
}

function makeProject(withDeliverables = true) {
  const project = createEmptyProject({
    companyName: "Export Route Co",
    objective: "Validate export route behavior",
  });

  if (withDeliverables) {
    project.status = "needs-review";
    project.deliverables.executiveReport = "Executive report body";
    project.deliverables.onePageSummary = "One-page summary body";
    project.deliverables.deckOutline = [
      {
        slide: 1,
        title: "Context",
        purpose: "Set context",
        keyPoints: ["Current state", "Opportunity"],
      },
    ];
  }

  return project;
}

test("project export route generates markdown export and supports list/detail", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const createResponse = await postProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "markdown" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );

    const created = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(created.format, "markdown");
    assert.match(created.content, /## Executive Report/);
    assert.doesNotMatch(created.content, /storagePath|textExtracted|rawProviderResponse/i);

    const listResponse = await getProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports"),
      { params: Promise.resolve({ id: project.id }) },
    );
    const listed = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(Array.isArray(listed), true);
    assert.equal(listed.length, 1);

    const detailResponse = await getProjectExportDetail(
      new Request("http://127.0.0.1/api/projects/id/exports/exportId"),
      { params: Promise.resolve({ id: project.id, exportId: created.id }) },
    );
    const detail = await detailResponse.json();
    assert.equal(detailResponse.status, 200);
    assert.equal(detail.id, created.id);
    assert.equal(typeof detail.content, "string");
  } finally {
    await cleanupProject(project.id);
  }
});

test("project export route supports html, text, and json formats", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const formats = ["html", "text", "json"] as const;

    for (const format of formats) {
      const response = await postProjectExports(
        new Request("http://127.0.0.1/api/projects/id/exports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format }),
        }),
        { params: Promise.resolve({ id: project.id }) },
      );

      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.format, format);
    }
  } finally {
    await cleanupProject(project.id);
  }
});

test("template API returns built-in templates", async () => {
  const response = await getDeliverableTemplates();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(body), true);
  assert.ok(body.some((template: { id: string }) => template.id === "executive-standard"));
  assert.ok(body.some((template: { id: string }) => template.id === "client-ready"));
  assert.ok(body.some((template: { id: string }) => template.id === "investor-brief"));
  assert.ok(body.some((template: { id: string }) => template.id === "internal-review"));
});

test("default template is used when templateId is omitted", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const response = await postProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "markdown" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );

    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.templateId, "executive-standard");
    assert.equal(typeof body.templateName, "string");
  } finally {
    await cleanupProject(project.id);
  }
});

test("invalid templateId fails safely", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const response = await postProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "markdown", templateId: "not-a-template" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );

    const body = await response.json();
    assert.equal(response.status, 422);
    assert.ok(typeof body.error === "string");
  } finally {
    await cleanupProject(project.id);
  }
});

test("project download route sets safe content type and attachment filename", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const createResponse = await postProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "markdown", templateId: "client-ready" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );
    const created = await createResponse.json();

    const downloadResponse = await getProjectExportDownload(
      new Request("http://127.0.0.1/api/projects/id/exports/exportId/download"),
      { params: Promise.resolve({ id: project.id, exportId: created.id }) },
    );

    const contentDisposition = downloadResponse.headers.get("Content-Disposition") || "";
    const contentType = downloadResponse.headers.get("Content-Type") || "";
    const content = await downloadResponse.text();

    assert.equal(downloadResponse.status, 200);
    assert.match(contentType, /text\/markdown/i);
    assert.match(contentDisposition, /attachment;/i);
    assert.match(contentDisposition, /\.md/i);
    assert.doesNotMatch(contentDisposition, /\.{2}|\//);
    assert.doesNotMatch(content, /storagePath|textExtracted|rawProviderResponse|systemPrompt|apiKey|diagnosticTrace/i);
  } finally {
    await cleanupProject(project.id);
  }
});

test("download route returns correct content types for all formats", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const formats = [
      { format: "markdown", expected: /text\/markdown/i },
      { format: "html", expected: /text\/html/i },
      { format: "text", expected: /text\/plain/i },
      { format: "json", expected: /application\/json/i },
    ] as const;

    for (const item of formats) {
      const createResponse = await postProjectExports(
        new Request("http://127.0.0.1/api/projects/id/exports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: item.format }),
        }),
        { params: Promise.resolve({ id: project.id }) },
      );
      const created = await createResponse.json();

      const downloadResponse = await getProjectExportDownload(
        new Request("http://127.0.0.1/api/projects/id/exports/exportId/download"),
        { params: Promise.resolve({ id: project.id, exportId: created.id }) },
      );

      assert.equal(downloadResponse.status, 200);
      assert.match(downloadResponse.headers.get("Content-Type") || "", item.expected);
    }
  } finally {
    await cleanupProject(project.id);
  }
});

test("download route fails safely for missing export and wrong project", async () => {
  const project = makeProject(true);
  await saveProject(project);

  const other = makeProject(true);
  await saveProject(other);

  try {
    const createResponse = await postProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "text" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );
    const created = await createResponse.json();

    const missingResponse = await getProjectExportDownload(
      new Request("http://127.0.0.1/api/projects/id/exports/missing/download"),
      { params: Promise.resolve({ id: project.id, exportId: "missing" }) },
    );
    assert.equal(missingResponse.status, 404);

    const wrongResponse = await getProjectExportDownload(
      new Request("http://127.0.0.1/api/projects/id/exports/exportId/download"),
      { params: Promise.resolve({ id: other.id, exportId: created.id }) },
    );
    assert.equal(wrongResponse.status, 404);
  } finally {
    await cleanupProject(project.id);
    await cleanupProject(other.id);
  }
});

test("project export route fails safely when work product is missing", async () => {
  const project = makeProject(false);
  await saveProject(project);

  try {
    const response = await postProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "markdown" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );

    const body = await response.json();
    assert.equal(response.status, 422);
    assert.match(body.error, /requires a generated work product/i);
  } finally {
    await cleanupProject(project.id);
  }
});

test("project export route validates format safely", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const response = await postProjectExports(
      new Request("http://127.0.0.1/api/projects/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );

    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error, "Export validation failed.");
  } finally {
    await cleanupProject(project.id);
  }
});

test("engagement alias export routes mirror project export behavior", async () => {
  const project = makeProject(true);
  await saveProject(project);

  try {
    const createResponse = await postEngagementExports(
      new Request("http://127.0.0.1/api/engagements/id/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "text" }),
      }),
      { params: Promise.resolve({ id: project.id }) },
    );
    const created = await createResponse.json();
    assert.equal(createResponse.status, 201);

    const listResponse = await getEngagementExports(
      new Request("http://127.0.0.1/api/engagements/id/exports"),
      { params: Promise.resolve({ id: project.id }) },
    );
    const listBody = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(Array.isArray(listBody), true);

    const detailResponse = await getEngagementExportDetail(
      new Request("http://127.0.0.1/api/engagements/id/exports/exportId"),
      { params: Promise.resolve({ id: project.id, exportId: created.id }) },
    );
    const detailBody = await detailResponse.json();
    assert.equal(detailResponse.status, 200);
    assert.equal(detailBody.id, created.id);

    const downloadResponse = await getEngagementExportDownload(
      new Request("http://127.0.0.1/api/engagements/id/exports/exportId/download"),
      { params: Promise.resolve({ id: project.id, exportId: created.id }) },
    );
    assert.equal(downloadResponse.status, 200);
    assert.match(downloadResponse.headers.get("Content-Disposition") || "", /attachment;/i);
  } finally {
    await cleanupProject(project.id);
  }
});
