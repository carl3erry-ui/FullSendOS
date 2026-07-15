import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HUMAN_REVIEW_CHECKLIST,
  READINESS_LABELS,
  READINESS_DISCLAIMER,
  inferReadiness,
  isClientSafe,
  DEFAULT_READINESS,
} from "../services/deliverable-readiness";
import { buildDeliverableExport } from "../services/deliverable-export-service";
import { resolveDeliverableTemplate } from "../services/deliverable-template-service";
import WorkProductViewer from "../app/components/work-product-viewer";
import type { EngagementDetail, WorkspaceProjectSummary } from "../app/components/work-product-model";

// ----- Readiness utility tests -----

test("DEFAULT_READINESS is needs-human-review", () => {
  assert.equal(DEFAULT_READINESS, "needs-human-review");
});

test("READINESS_LABELS has all four levels", () => {
  assert.equal(READINESS_LABELS["internal-draft"], "Internal Draft");
  assert.equal(READINESS_LABELS["needs-human-review"], "Needs Human Review");
  assert.equal(READINESS_LABELS["client-ready-draft"], "Client-Ready Draft");
  assert.equal(READINESS_LABELS["approved-for-client"], "Approved for Client");
});

test("READINESS_DISCLAIMER has a disclaimer for each level", () => {
  const levels = ["internal-draft", "needs-human-review", "client-ready-draft", "approved-for-client"] as const;
  for (const level of levels) {
    assert.equal(typeof READINESS_DISCLAIMER[level], "string");
    assert.ok(READINESS_DISCLAIMER[level].length > 10);
  }
});

test("isClientSafe returns false for internal-draft and needs-human-review", () => {
  assert.equal(isClientSafe("internal-draft"), false);
  assert.equal(isClientSafe("needs-human-review"), false);
});

test("isClientSafe returns true for client-ready-draft and approved-for-client", () => {
  assert.equal(isClientSafe("client-ready-draft"), true);
  assert.equal(isClientSafe("approved-for-client"), true);
});

test("inferReadiness returns needs-human-review for completed and needs-review engagements", () => {
  assert.equal(inferReadiness("needs-review"), "needs-human-review");
  assert.equal(inferReadiness("complete"), "needs-human-review");
});

test("inferReadiness returns internal-draft for draft and other statuses", () => {
  assert.equal(inferReadiness("draft"), "internal-draft");
  assert.equal(inferReadiness("running"), "internal-draft");
});

test("HUMAN_REVIEW_CHECKLIST has at least 7 items", () => {
  assert.ok(HUMAN_REVIEW_CHECKLIST.length >= 7);
});

test("HUMAN_REVIEW_CHECKLIST does not contain unsafe keys", () => {
  const combined = HUMAN_REVIEW_CHECKLIST.join(" ");
  assert.doesNotMatch(combined, /XAI_API_KEY|\.env\.local|rawProviderResponse|storagePath|textExtracted|systemPrompt/i);
});

// ----- Work product viewer readiness rendering -----

function makeCompleteDemoDetail(): EngagementDetail {
  return {
    id: "QUALITY-TEST-ENG-1",
    status: "needs-review",
    departments: {
      publishing: {
        summary: "Publishing complete",
        recommendations: [
          {
            priority: "immediate",
            recommendation: "Hire California sales rep",
            rationale: "Distribution relationships are the highest-leverage first move",
            successMeasure: "3 distributor LOIs in 90 days",
          },
        ],
      },
    },
    deliverables: {
      executiveReport: "Executive report body with executive answer and recommendations.",
      onePageSummary: "Decision question: Should we enter California? Recommendation: Yes. Top risks: Distribution bandwidth.",
      deckOutline: [
        {
          slide: 1,
          title: "Situation",
          purpose: "Frame the opportunity",
          keyPoints: ["$4.2B market", "Underserved channel"],
          evidenceNote: "Market size estimate — verify before board.",
        },
      ],
      evidenceSummary: {
        evidenceUsed: [],
        assumptions: [
          { id: "a1", statement: "PNW brand premium of 12% is an inference, not confirmed.", confidence: 0.65 },
        ],
        openQuestions: [
          { id: "q1", question: "What is the distributor margin structure in Northern California?", verifiedStatus: "open_question", whyItMatters: "Determines price viability" },
        ],
        humanConfirmations: [
          { id: "h1", citationLabel: "Client Confirmation 1", title: "IPA award recognition confirmed", description: "Confirmed by client contact.", verifiedStatus: "human_confirmed" },
        ],
        sourceCoverage: { dataRoomDocuments: 1, humanConfirmations: 1, clientProvidedAnchors: 0, agentEvidence: 0, openQuestions: 1 },
        confidenceSummary: { level: "medium", score: 0.68, rationale: "Key assumptions require primary validation." },
        missingEvidence: ["Distributor margin confirmation"],
        recommendedNextActions: ["Primary distributor interviews"],
      },
    },
    audit: { runs: [], warnings: [] },
  };
}

const baseProject: WorkspaceProjectSummary = {
  id: "QUALITY-TEST-ENG-1",
  companyName: "Apex Brewing Co.",
  objective: "California market entry strategy",
  status: "needs-review",
  updatedAt: new Date().toISOString(),
  completedDepartments: 7,
  totalDepartments: 7,
};

test("work product viewer renders readiness badge for needs-review engagement", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkProductViewer, {
      project: baseProject,
      detail: makeCompleteDemoDetail(),
      isLoading: false,
      loadError: null,
      activeSection: "executive",
      onSectionChange: () => {},
      runningProjectId: null,
      onRun: () => {},
    }),
  );

  assert.match(html, /Needs Human Review/);
  assert.match(html, /Verify all facts, estimates, and recommendations before client delivery/i);
});

test("work product viewer renders human review checklist", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkProductViewer, {
      project: baseProject,
      detail: makeCompleteDemoDetail(),
      isLoading: false,
      loadError: null,
      activeSection: "executive",
      onSectionChange: () => {},
      runningProjectId: null,
      onRun: () => {},
    }),
  );

  assert.match(html, /Human Review Checklist/);
  assert.match(html, /Verify all factual claims/i);
  assert.match(html, /Approve before any client delivery/i);
});

test("work product viewer does not expose unsafe fields", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkProductViewer, {
      project: baseProject,
      detail: makeCompleteDemoDetail(),
      isLoading: false,
      loadError: null,
      activeSection: "executive",
      onSectionChange: () => {},
      runningProjectId: null,
      onRun: () => {},
    }),
  );

  assert.doesNotMatch(html, /XAI_API_KEY|rawProviderResponse|storagePath|textExtracted|systemPrompt/i);
});

// ----- Export formatting quality -----

test("markdown export includes human review notice", async () => {
  const template = resolveDeliverableTemplate("executive-standard", "markdown");
  assert.ok(template);

  const result = await buildDeliverableExport({
    engagementId: "QUALITY-TEST-ENG-2",
    engagementTitle: "Apex Brewing California Strategy",
    clientName: "Apex Brewing Co.",
    detail: makeCompleteDemoDetail(),
    format: "markdown",
    template,
  });

  assert.match(result.content, /Needs Human Review/i);
  assert.match(result.content, /Apex Brewing California Strategy/);
  assert.match(result.content, /---/);
  assert.doesNotMatch(result.content, /XAI_API_KEY|rawProviderResponse|storagePath|textExtracted/i);
});

test("HTML export includes review notice banner and paragraph content", async () => {
  const template = resolveDeliverableTemplate("executive-standard", "html");
  assert.ok(template);

  const result = await buildDeliverableExport({
    engagementId: "QUALITY-TEST-ENG-3",
    engagementTitle: "Apex Brewing Demo",
    clientName: "Apex Brewing Co.",
    detail: makeCompleteDemoDetail(),
    format: "html",
    template,
  });

  assert.match(result.content, /review-notice/);
  assert.match(result.content, /Needs Human Review/i);
  assert.match(result.content, /<p>/);
  assert.doesNotMatch(result.content, /<pre>/);
  assert.doesNotMatch(result.content, /XAI_API_KEY|rawProviderResponse|storagePath|textExtracted/i);
});

test("text export includes review notice header", async () => {
  const template = resolveDeliverableTemplate("executive-standard", "text");
  assert.ok(template);

  const result = await buildDeliverableExport({
    engagementId: "QUALITY-TEST-ENG-4",
    engagementTitle: "Apex Brewing Demo",
    detail: makeCompleteDemoDetail(),
    format: "text",
    template,
  });

  assert.match(result.content, /STATUS: NEEDS HUMAN REVIEW/);
  assert.match(result.content, /Verify all facts, estimates, and recommendations/i);
});
