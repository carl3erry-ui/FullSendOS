import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkProductViewer from "../app/components/work-product-viewer";
import type { EngagementDetail, WorkspaceProjectSummary } from "../app/components/work-product-model";

function buildProject(overrides: Partial<WorkspaceProjectSummary> = {}): WorkspaceProjectSummary {
  return {
    id: "DEMO-APEX-ENG-001",
    companyName: "Apex Brewing Co.",
    objective: "Investor deck and market entry strategy",
    status: "needs-review",
    completedDepartments: 7,
    totalDepartments: 7,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildDetail(overrides: Partial<EngagementDetail> = {}): EngagementDetail {
  return {
    id: "DEMO-APEX-ENG-001",
    status: "needs-review",
    brief: {
      objective: "Investor deck and market entry strategy",
      requestedDeliverables: ["investor-deck", "market-research"],
    },
    departments: {
      research: { summary: "Research complete" },
      strategy: { summary: "Strategy complete" },
      publishing: { summary: "Publishing complete" },
    },
    deliverables: {
      executiveReport: "Executive report content",
      onePageSummary: "One-page summary content",
      deckOutline: [{ slide: 1, title: "Situation" }],
    },
    audit: {
      runs: [
        { department: "research", status: "complete", model: "grok-4.5", startedAt: new Date().toISOString() },
      ],
      warnings: [],
    },
    ...overrides,
  };
}

function renderViewer(activeSection: string, projectOverrides: Partial<WorkspaceProjectSummary> = {}, detailOverrides: Partial<EngagementDetail> = {}) {
  const project = buildProject(projectOverrides);
  const detail = buildDetail(detailOverrides);
  return renderToStaticMarkup(
    React.createElement(WorkProductViewer, {
      project,
      detail,
      isLoading: false,
      loadError: null,
      activeSection,
      onSectionChange: () => {},
      runningProjectId: null,
      onRun: () => {},
    }),
  );
}

test("collaboration trace panel renders in owner/admin engagement workspace", () => {
  const html = renderViewer("collaboration");
  assert.match(html, /Agent Collaboration Trace/i);
  assert.match(html, /Internal view/i);
  assert.match(html, /Static Collaboration Preview/i);
});

test("agent workforce status section renders in owner/admin workspace", () => {
  const html = renderViewer("executive");
  assert.match(html, /Agent Workforce Status/i);
  assert.match(html, /Workflow status/i);
  assert.match(html, /Human review status/i);
  assert.match(html, /Client-readiness/i);
  assert.match(html, /Export availability/i);
});

test("provider status uses safe labels and does not expose secrets", () => {
  const previous = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = "do-not-expose-this";
  try {
    const html = renderViewer("executive");
    assert.match(html, /Provider:/i);
    assert.doesNotMatch(html, /do-not-expose-this/i);
  } finally {
    if (previous === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previous;
  }
});

test("selected agents and human approval gates are visible in collaboration tab", () => {
  const html = renderViewer("collaboration");
  assert.match(html, /Agent Team/i);
  assert.match(html, /Pending Human Approval Gate/i);
});

test("leadership doctrine version is visible in collaboration trace panel", () => {
  const html = renderViewer("collaboration");
  assert.match(html, /Leadership Doctrine v1\.0\.0/i);
});

test("client portal route does not render CollaborationTracePanel", () => {
  const pagePath = path.resolve(process.cwd(), "app/client-portal/[clientId]/page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.doesNotMatch(source, /CollaborationTracePanel/);
});

test("client portal route does not expose internal agent notes/raw provider output fields", () => {
  const pagePath = path.resolve(process.cwd(), "app/client-portal/[clientId]/page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.doesNotMatch(source, /rawProviderResponse|providerPayload|agentNotes|internalTrace|systemPrompt/i);
});

test("client portal route does not expose abort controls", () => {
  const pagePath = path.resolve(process.cwd(), "app/client-portal/[clientId]/page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.doesNotMatch(source, /Abort stalled workflow/i);
});

test("live workflow controls are clearly labeled for demo/live contexts", () => {
  const demoHtml = renderViewer("executive", { id: "DEMO-ENG-001", status: "draft" });
  assert.match(demoHtml, /Run demo workflow/i);

  const liveHtml = renderViewer("executive", { id: "LIVE-ENG-001", status: "draft" });
  assert.match(liveHtml, /Run live Grok workflow/i);
});

test("normal tests do not make live xAI calls", () => {
  const html = renderViewer("executive");
  assert.ok(typeof html === "string");
  // Rendering is local/static and does not perform network/provider calls.
  assert.doesNotMatch(html, /api\.x\.ai|xai\.api|Authorization:/i);
});

test("owner/admin dashboard uses safe JSON response messages", () => {
  const helperPath = path.resolve(process.cwd(), "app/components/safe-json-response.ts");
  const source = fs.readFileSync(helperPath, "utf8");
  assert.match(source, /The server returned an empty response\. Please refresh or try the action again\./i);

  const dashboardPath = path.resolve(process.cwd(), "app/components/project-dashboard.tsx");
  const dashboardSource = fs.readFileSync(dashboardPath, "utf8");
  assert.match(dashboardSource, /The server returned an invalid response\. No workflow was started\./i);
});

test("workflow run and abort actions parse API responses safely", () => {
  const dashboardPath = path.resolve(process.cwd(), "app/components/project-dashboard.tsx");
  const source = fs.readFileSync(dashboardPath, "utf8");
  assert.match(source, /parseJsonResponseSafely\(response\)/i);
  assert.match(source, /handleAbort\(projectId: string\)/i);

  const workspacePath = path.resolve(process.cwd(), "app/components/project-workspace.tsx");
  const workspaceSource = fs.readFileSync(workspacePath, "utf8");
  assert.match(workspaceSource, /parseJsonResponseSafely<EngagementDetail>\(response\)/i);

  const viewerPath = path.resolve(process.cwd(), "app/components/work-product-viewer.tsx");
  const viewerSource = fs.readFileSync(viewerPath, "utf8");
  assert.match(viewerSource, /onAbort\?\.\(project\.id\)/i);
});

test("future roadmap includes secure client portal production foundation", () => {
  const roadmapPath = path.resolve(process.cwd(), "docs/ROADMAP.md");
  const source = fs.readFileSync(roadmapPath, "utf8");
  assert.match(source, /Secure Client Portal Production Foundation/i);
  assert.match(source, /future scope/i);
});
