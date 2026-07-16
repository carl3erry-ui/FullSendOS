import assert from "node:assert/strict";
import test from "node:test";
import { runDocumentationReview } from "../services/doc-review/reviewer";
import { renderReviewReportMarkdown } from "../services/doc-review/renderer";
import {
  DOC_INVENTORY,
  IMPLEMENTATION_INVENTORY,
  KNOWN_DEFERRED_DOCS,
  UPCOMING_EPICS,
  IMPLEMENTED_FEATURES,
} from "../services/doc-review/inventory";
import type {
  DocInventoryItem,
  ImplementationInventoryItem,
  DocumentationFinding,
  DocumentationReviewReport,
} from "../services/doc-review/types";

// ----- Type/model tests -----

test("DocInventoryItem can be constructed with required fields", () => {
  const item: DocInventoryItem = {
    path: "docs/TEST.md",
    title: "Test Doc",
    category: "other",
    topics: ["test"],
    statusMarkers: [],
    relatedAreas: [],
    riskLevel: "low",
    notes: "",
  };
  assert.equal(item.path, "docs/TEST.md");
  assert.equal(item.riskLevel, "low");
});

test("ImplementationInventoryItem can be constructed with required fields", () => {
  const item: ImplementationInventoryItem = {
    path: "services/test.ts",
    kind: "service",
    topics: ["test feature"],
    relatedDocs: [],
    notes: "no related docs",
  };
  assert.equal(item.kind, "service");
  assert.equal(item.relatedDocs.length, 0);
});

test("DocumentationFinding humanApprovalRequired is a boolean", () => {
  const finding: DocumentationFinding = {
    id: "DOC-TEST-001",
    severity: "warning",
    type: "missing-doc",
    title: "Test finding",
    description: "Test description",
    evidence: "Test evidence",
    recommendedAction: "Test action",
    relatedFiles: [],
    humanApprovalRequired: true,
  };
  assert.equal(finding.humanApprovalRequired, true);
});

// ----- Inventory integrity -----

test("DOC_INVENTORY has at least 20 entries", () => {
  assert.ok(DOC_INVENTORY.length >= 20, `Expected >= 20, got ${DOC_INVENTORY.length}`);
});

test("IMPLEMENTATION_INVENTORY has at least 8 entries", () => {
  assert.ok(IMPLEMENTATION_INVENTORY.length >= 8);
});

test("KNOWN_DEFERRED_DOCS includes the three consulting deliverable quality docs", () => {
  const deferred = [...KNOWN_DEFERRED_DOCS];
  assert.ok(deferred.includes("CONSULTING_DELIVERABLE_QUALITY_AUDIT.md"));
  assert.ok(deferred.includes("CONSULTING_DELIVERABLE_STANDARD.md"));
  assert.ok(deferred.includes("CONSULTING_DELIVERABLE_QUALITY_RESULTS.md"));
});

test("IMPLEMENTED_FEATURES includes key shipped features", () => {
  const features = [...IMPLEMENTED_FEATURES];
  assert.ok(features.some((f) => f.toLowerCase().includes("grok")));
  assert.ok(features.some((f) => f.toLowerCase().includes("onboarding")));
  assert.ok(features.some((f) => f.toLowerCase().includes("data room")));
  assert.ok(features.some((f) => f.toLowerCase().includes("demo workspace")));
  assert.ok(features.some((f) => f.toLowerCase().includes("guided tour")));
});

test("UPCOMING_EPICS includes production infrastructure (client portal is now implemented)", () => {
  const epics = [...UPCOMING_EPICS];
  assert.ok(epics.some((e) => e.toLowerCase().includes("production")));
  // Client Portal v1 is now implemented — should not appear in upcoming
  assert.ok(!epics.some((e) => e.toLowerCase().includes("client portal")));
});

// ----- Reviewer behavior -----

test("reviewer produces a report with at least one finding", () => {
  const report = runDocumentationReview({ branch: "test" });
  assert.ok(report.findings.length > 0);
});

test("reviewer detects deferred consulting deliverable docs", () => {
  const report = runDocumentationReview({ branch: "test" });
  const deferredFindings = report.findings.filter((f) => f.type === "deferred-doc-needed");
  const titles = deferredFindings.map((f) => f.title);
  assert.ok(
    titles.some((t) => t.includes("CONSULTING_DELIVERABLE_QUALITY_AUDIT")),
    "Expected finding for CONSULTING_DELIVERABLE_QUALITY_AUDIT.md",
  );
  assert.ok(
    titles.some((t) => t.includes("CONSULTING_DELIVERABLE_STANDARD")),
    "Expected finding for CONSULTING_DELIVERABLE_STANDARD.md",
  );
});

test("reviewer flags high-risk docs like ROADMAP.md", () => {
  const report = runDocumentationReview({ branch: "test" });
  const staleFindings = report.findings.filter((f) => f.type === "stale-doc");
  assert.ok(
    staleFindings.some((f) => f.relatedFiles.some((path) => path.includes("ROADMAP"))),
    "Expected a stale-doc finding for ROADMAP.md",
  );
});

test("reviewer sets humanApprovalRequired on all findings", () => {
  const report = runDocumentationReview({ branch: "test" });
  for (const finding of report.findings) {
    assert.equal(finding.humanApprovalRequired, true, `Finding ${finding.id} should require human approval`);
  }
});

test("reviewer report includes guardrail message", () => {
  const report = runDocumentationReview({ branch: "test" });
  assert.ok(report.guardrail.length > 20);
  assert.ok(report.humanApprovalRequired === true);
  assert.match(report.guardrail, /human approval/i);
});

test("reviewer report includes recommendedDocUpdates for deferred consulting docs", () => {
  const report = runDocumentationReview({ branch: "test" });
  const paths = report.recommendedDocUpdates.map((u) => u.targetPath);
  assert.ok(
    paths.some((p) => p.includes("CONSULTING_DELIVERABLE")),
    "Expected a recommended update for CONSULTING_DELIVERABLE docs",
  );
});

test("reviewer report has docCount and implementationAreaCount", () => {
  const report = runDocumentationReview({ branch: "test" });
  assert.ok(report.docCount > 0);
  assert.ok(report.implementationAreaCount > 0);
});

test("reviewer does not make live AI calls", () => {
  // The reviewer is synchronous and produces output without any async provider calls.
  // This test simply confirms runDocumentationReview is a sync function.
  const result = runDocumentationReview({ branch: "test" });
  assert.equal(typeof result, "object");
  assert.ok(result.findings);
  // If it were async it would return a Promise, not an object
  assert.ok(!(result instanceof Promise));
});

// ----- Renderer behavior -----

test("rendered report includes summary", () => {
  const report = runDocumentationReview({ branch: "test" });
  const markdown = renderReviewReportMarkdown(report);
  assert.match(markdown, /## Summary/);
  assert.match(markdown, /Documentation review complete/);
});

test("rendered report includes human approval checklist", () => {
  const report = runDocumentationReview({ branch: "test" });
  const markdown = renderReviewReportMarkdown(report);
  assert.match(markdown, /Human Approval Checklist/);
  assert.match(markdown, /Before committing any recommended documentation changes/i);
});

test("rendered report includes guardrail notice", () => {
  const report = runDocumentationReview({ branch: "test" });
  const markdown = renderReviewReportMarkdown(report);
  assert.match(markdown, /Human Approval Required/);
  assert.match(markdown, /advisory only/i);
});

test("rendered report does not include unsafe fields", () => {
  const report = runDocumentationReview({ branch: "test" });
  const markdown = renderReviewReportMarkdown(report);
  assert.doesNotMatch(
    markdown,
    /XAI_API_KEY|\.env\.local|rawProviderResponse|storagePath|textExtracted|systemPrompt/i,
  );
});

test("rendered report includes recommended doc updates section", () => {
  const report = runDocumentationReview({ branch: "test" });
  const markdown = renderReviewReportMarkdown(report);
  assert.match(markdown, /Recommended Documentation Updates/);
  assert.match(markdown, /\*\*Human Approval Required:\*\* YES/);
});
