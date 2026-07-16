import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getDefaultClientPortalVisibility,
  isClientSafeField,
  filterClientSafeEngagement,
  filterClientSafeDeliverable,
} from "../lib/client-portal/client-portal-access";

// ----- Default visibility -----

test("default client portal visibility denies internal trace access", () => {
  const visibility = getDefaultClientPortalVisibility("CLIENT-001");
  assert.equal(visibility.canViewInternalTrace, false);
});

test("default client portal visibility denies agent notes access", () => {
  const visibility = getDefaultClientPortalVisibility("CLIENT-001");
  assert.equal(visibility.canViewAgentNotes, false);
});

test("default client portal visibility denies raw provider output", () => {
  const visibility = getDefaultClientPortalVisibility("CLIENT-001");
  assert.equal(visibility.canViewRawProviderOutput, false);
});

test("default client portal visibility allows status and deliverable viewing", () => {
  const visibility = getDefaultClientPortalVisibility("CLIENT-001");
  assert.equal(visibility.canViewStatus, true);
  assert.equal(visibility.canViewDeliverables, true);
  assert.equal(visibility.canDownloadDeliverables, true);
  assert.equal(visibility.canViewReviewStatus, true);
});

test("default visibility includes correct clientId", () => {
  const visibility = getDefaultClientPortalVisibility("MY-CLIENT-123", "ENG-456");
  assert.equal(visibility.clientId, "MY-CLIENT-123");
  assert.equal(visibility.engagementId, "ENG-456");
});

test("file upload is not enabled by default in v1", () => {
  const visibility = getDefaultClientPortalVisibility("CLIENT-001");
  assert.equal(visibility.canUploadFiles, false);
});

// ----- isClientSafeField -----

test("isClientSafeField blocks internal field names", () => {
  assert.equal(isClientSafeField("audit"), false);
  assert.equal(isClientSafeField("rawOutput"), false);
  assert.equal(isClientSafeField("systemPrompt"), false);
  assert.equal(isClientSafeField("apiKey"), false);
  assert.equal(isClientSafeField("secret"), false);
  assert.equal(isClientSafeField("storagePath"), false);
  assert.equal(isClientSafeField("textExtracted"), false);
  assert.equal(isClientSafeField("collaborationTrace"), false);
  assert.equal(isClientSafeField("agentNotes"), false);
  assert.equal(isClientSafeField("providerPayload"), false);
});

test("isClientSafeField allows safe field names", () => {
  assert.equal(isClientSafeField("title"), true);
  assert.equal(isClientSafeField("status"), true);
  assert.equal(isClientSafeField("summary"), true);
  assert.equal(isClientSafeField("recommendation"), true);
  assert.equal(isClientSafeField("updatedAt"), true);
  assert.equal(isClientSafeField("clientId"), true);
});

// ----- filterClientSafeEngagement -----

test("client-safe engagement filter preserves readable status", () => {
  const result = filterClientSafeEngagement({
    id: "ENG-001",
    companyName: "Apex Brewing Co.",
    objective: "California market entry",
    status: "needs-review",
    completedDepartments: 7,
    totalDepartments: 7,
  });
  assert.equal(result.status, "needs-review");
  assert.equal(result.readableStatus, "Ready for review");
  assert.equal(result.completedDepartments, 7);
  assert.equal(result.totalDepartments, 7);
});

test("client-safe engagement filter marks as has-deliverables when executive report exists", () => {
  const result = filterClientSafeEngagement({
    id: "ENG-001",
    companyName: "Apex Brewing",
    objective: "Test",
    status: "needs-review",
    completedDepartments: 7,
    totalDepartments: 7,
    deliverables: { executiveReport: "Report body", onePageSummary: "Summary" },
  });
  assert.equal(result.hasDeliverables, true);
  assert.equal(result.deliverableReadiness, "needs-human-review");
});

test("client-safe engagement filter marks draft as internal-draft", () => {
  const result = filterClientSafeEngagement({
    id: "ENG-001",
    companyName: "Co",
    objective: "Test",
    status: "draft",
    completedDepartments: 0,
    totalDepartments: 7,
  });
  assert.equal(result.deliverableReadiness, "internal-draft");
});

// ----- filterClientSafeDeliverable -----

test("client-safe deliverable preserves readiness label", () => {
  const result = filterClientSafeDeliverable({
    engagementId: "ENG-001",
    engagementTitle: "Apex Brewing",
    status: "needs-review",
    deliverables: {
      executiveReport: "Report",
      onePageSummary: "Summary",
      deckOutline: [{ slide: 1, title: "Situation" }],
    },
    exportCount: 2,
  });
  assert.equal(result.readinessLabel, "Needs Human Review");
  assert.equal(result.isClientApproved, false);
  assert.equal(result.hasExecutiveReport, true);
  assert.equal(result.hasOnePageSummary, true);
  assert.equal(result.hasDeckOutline, true);
  assert.equal(result.exportCount, 2);
});

test("client-safe deliverable provides safe preview text for review-ready engagements", () => {
  const result = filterClientSafeDeliverable({
    engagementId: "ENG-001",
    engagementTitle: "Apex Brewing",
    status: "needs-review",
    deliverables: {
      onePageSummary: "A".repeat(500),
    },
    exportCount: 0,
  });
  assert.ok(result.safePreviewText);
  assert.ok(result.safePreviewText.length <= 210, "Preview text should be capped");
  assert.match(result.safePreviewText, /\.\.\.$/);
});

test("client-safe deliverable shows internal-draft for draft engagements", () => {
  const result = filterClientSafeDeliverable({
    engagementId: "ENG-002",
    engagementTitle: "Test Co",
    status: "draft",
    exportCount: 0,
  });
  assert.equal(result.readinessLabel, "Internal Draft");
  assert.equal(result.isClientApproved, false);
  assert.equal(result.safePreviewText, undefined);
});

test("client-safe deliverable does not expose raw provider fields", () => {
  const result = filterClientSafeDeliverable({
    engagementId: "ENG-001",
    engagementTitle: "Apex Brewing",
    status: "needs-review",
    deliverables: { executiveReport: "Report" },
    exportCount: 0,
  });

  // Result should not contain any internal field
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /rawOutput|systemPrompt|apiKey|storagePath|textExtracted|agentNotes|providerPayload/i);
});

test("no live xAI calls in client portal tests", () => {
  // All client portal access functions are synchronous and local.
  const visibility = getDefaultClientPortalVisibility("TEST-CLIENT");
  assert.ok(!(visibility instanceof Promise), "getDefaultClientPortalVisibility must be synchronous");
});
