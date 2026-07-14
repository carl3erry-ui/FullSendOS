import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeliverableExport,
  buildSafeExportFilename,
} from "./deliverable-export-service";
import { resolveDeliverableTemplate } from "./deliverable-template-service";
import type { EngagementDetail } from "@/app/components/work-product-model";

function requireTemplate(id: "executive-standard" | "client-ready" | "investor-brief" | "internal-review") {
  const template = resolveDeliverableTemplate(id, "markdown");
  assert.ok(template, `Template ${id} should resolve`);
  return template;
}

function makeDetail(overrides: Partial<EngagementDetail> = {}): EngagementDetail {
  return {
    id: "EXPORT-ENG-1",
    status: "needs-review",
    departments: {},
    deliverables: {
      executiveReport: "Executive report content",
      onePageSummary: "One-page summary content",
      deckOutline: [
        {
          slide: 1,
          title: "Overview",
          purpose: "Set context",
          keyPoints: ["Point A", "Point B"],
        },
      ],
      evidenceReferences: [
        {
          id: "ref-1",
          sourceType: "data_room_document",
          citationLabel: "Source A",
          title: "Lease Summary.pdf",
          description: "Lease abstract for underwriting.",
          excerptPreview: "Location appears in lease abstract.",
          verifiedStatus: "retrieved_from_data_room",
          createdAt: new Date().toISOString(),
        },
      ],
      evidenceSummary: {
        evidenceUsed: [
          {
            id: "ref-1",
            sourceType: "data_room_document",
            citationLabel: "Source A",
            title: "Lease Summary.pdf",
            description: "Lease abstract for underwriting.",
            excerptPreview: "Location appears in lease abstract.",
            verifiedStatus: "retrieved_from_data_room",
          },
        ],
        assumptions: [
          {
            id: "assumption-1",
            statement: "Address remains unverified.",
          },
        ],
        openQuestions: [
          {
            id: "question-1",
            question: "What is the confirmed address?",
            verifiedStatus: "open_question",
          },
        ],
        humanConfirmations: [
          {
            id: "confirmation-1",
            citationLabel: "Human Input 1",
            title: "Confirm persona",
            description: "Confirmed by operator.",
            verifiedStatus: "human_confirmed",
          },
        ],
        sourceCoverage: {
          dataRoomDocuments: 1,
          humanConfirmations: 1,
          clientProvidedAnchors: 1,
          agentEvidence: 0,
          openQuestions: 1,
        },
        confidenceSummary: {
          level: "medium",
          score: 0.64,
          rationale: "Address still open.",
        },
        missingEvidence: ["Confirmed address"],
        recommendedNextActions: ["Confirm address with client"],
      },
    },
    ...overrides,
  };
}

test("markdown export includes core deliverable sections", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    clientName: "Hardware Brewery",
    detail: makeDetail(),
    format: "markdown",
    template: requireTemplate("executive-standard"),
  });

  assert.equal(result.format, "markdown");
  assert.match(result.content, /## Executive Report/);
  assert.match(result.content, /## One-Page Summary/);
  assert.match(result.content, /## Deck Outline/);
  assert.match(result.content, /## Sources Used/);
  assert.match(result.content, /## Confidence Summary/);
});

test("html export uses semantic safe markup", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    detail: makeDetail(),
    format: "html",
    template: requireTemplate("executive-standard"),
  });

  assert.equal(result.format, "html");
  assert.match(result.content, /<!doctype html>/i);
  assert.match(result.content, /<section class="card">/);
  assert.doesNotMatch(result.content, /<script/i);
});

test("text export includes all major sections", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    detail: makeDetail(),
    format: "text",
    template: requireTemplate("executive-standard"),
  });

  assert.equal(result.format, "text");
  assert.match(result.content, /EXECUTIVE REPORT/);
  assert.match(result.content, /ONE-PAGE SUMMARY/);
  assert.match(result.content, /SOURCES USED/);
  assert.match(result.content, /OPEN QUESTIONS/);
});

test("json export package is structured and safe", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    detail: makeDetail(),
    format: "json",
    template: requireTemplate("executive-standard"),
  });

  assert.equal(result.format, "json");
  const parsed = JSON.parse(result.content) as { sections?: Array<{ title: string; content: string }> };
  assert.equal(Array.isArray(parsed.sections), true);
  assert.ok(parsed.sections?.some((section) => section.title === "Executive Report"));
});

test("export handles missing optional sections gracefully", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-2",
    engagementTitle: "Sparse Engagement",
    detail: makeDetail({
      deliverables: {
        executiveReport: "",
        onePageSummary: "",
        deckOutline: [],
        evidenceReferences: [],
        evidenceSummary: {
          evidenceUsed: [],
          assumptions: [],
          openQuestions: [],
          humanConfirmations: [],
          sourceCoverage: {
            dataRoomDocuments: 0,
            humanConfirmations: 0,
            clientProvidedAnchors: 0,
            agentEvidence: 0,
            openQuestions: 0,
          },
          confidenceSummary: {
            level: "pending",
            score: null,
            rationale: "No evidence yet.",
          },
          missingEvidence: [],
          recommendedNextActions: [],
        },
      },
    }),
    format: "markdown",
    template: requireTemplate("executive-standard"),
  });

  assert.match(result.content, /No executive report recorded\./);
  assert.match(result.content, /No one-page summary recorded\./);
  assert.match(result.content, /No deck outline recorded\./);
});

test("export safety excludes unsafe fields", async () => {
  const unsafeDetail = makeDetail({
    deliverables: {
      executiveReport: "storagePath should not appear",
      onePageSummary: "rawProviderResponse should not appear",
      deckOutline: [],
      evidenceReferences: [
        {
          id: "ref-unsafe",
          sourceType: "data_room_document",
          citationLabel: "Source X",
          title: "Doc",
          description: "textExtracted should not appear",
          verifiedStatus: "retrieved_from_data_room",
          createdAt: new Date().toISOString(),
        },
      ],
      evidenceSummary: {
        evidenceUsed: [],
        assumptions: [],
        openQuestions: [],
        humanConfirmations: [],
        sourceCoverage: {
          dataRoomDocuments: 0,
          humanConfirmations: 0,
          clientProvidedAnchors: 0,
          agentEvidence: 0,
          openQuestions: 0,
        },
        confidenceSummary: {
          level: "pending",
          score: null,
          rationale: "No evidence",
        },
        missingEvidence: [],
        recommendedNextActions: [],
      },
    },
  });

  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-3",
    engagementTitle: "Unsafe Check",
    detail: unsafeDetail,
    format: "text",
    template: requireTemplate("internal-review"),
  });

  assert.doesNotMatch(result.content, /storagePath/i);
  assert.doesNotMatch(result.content, /rawProviderResponse/i);
  assert.doesNotMatch(result.content, /textExtracted/i);
  assert.equal(result.safetySummary.storagePathExcluded, true);
  assert.equal(result.safetySummary.providerPayloadExcluded, true);
});

test("template metadata is stored on export record", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-TEMPLATE",
    engagementTitle: "Template Co",
    detail: makeDetail(),
    format: "markdown",
    template: requireTemplate("client-ready"),
  });

  assert.equal(result.templateId, "client-ready");
  assert.equal(result.templateName, "Client Ready");
  assert.equal(result.templateVersion, "1.0.0");
});

test("client-ready template renders client-facing section set", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-CLIENT",
    engagementTitle: "Client Co",
    detail: makeDetail(),
    format: "markdown",
    template: requireTemplate("client-ready"),
  });

  assert.match(result.content, /## Executive Summary/);
  assert.match(result.content, /## Recommendations/);
  assert.match(result.content, /## Next Actions/);
  assert.doesNotMatch(result.content, /## Human Confirmations/);
  assert.doesNotMatch(result.content, /## Assumptions/);
});

test("investor-brief template renders investor section set", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-INVESTOR",
    engagementTitle: "Investor Co",
    detail: makeDetail(),
    format: "markdown",
    template: requireTemplate("investor-brief"),
  });

  assert.match(result.content, /## Investment Thesis/);
  assert.match(result.content, /## Opportunity Summary/);
  assert.match(result.content, /## Risks/);
  assert.match(result.content, /## Evidence/);
});

test("filename slug removes unsafe characters and uses correct extension", () => {
  const filename = buildSafeExportFilename({
    engagementTitle: "Hardware Brewery: Test / Engagement #1",
    format: "markdown",
    generatedAtIso: "2026-07-14T15:10:00.000Z",
  });

  assert.match(filename, /^hardware-brewery-test-engagement-1-deliverable-markdown-2026-07-14\.md$/);
  assert.doesNotMatch(filename, /[^a-z0-9._-]/);
});

test("filename length is safely bounded", () => {
  const filename = buildSafeExportFilename({
    engagementTitle: "A".repeat(300),
    format: "json",
    generatedAtIso: "2026-07-14T15:10:00.000Z",
  });

  assert.ok(filename.length <= 100);
  assert.match(filename, /\.json$/);
});

test("pdf export stores base64 content with application/pdf metadata", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-PDF",
    engagementTitle: "Hardware Brewery",
    clientName: "Hardware Brewery",
    detail: makeDetail(),
    format: "pdf",
    template: requireTemplate("client-ready"),
  });

  assert.equal(result.format, "pdf");
  assert.equal(result.contentType, "application/pdf");
  assert.equal(result.contentEncoding, "base64");
  assert.equal(result.isBinary, true);
  assert.match(result.filename, /\.pdf$/);
  assert.equal(result.templateId, "client-ready");
  assert.equal(result.templateName, "Client Ready");
  assert.equal(result.templateVersion, "1.0.0");
  assert.ok(result.byteSize > 0);
  assert.equal(result.exportMetadata.binaryContent?.encoding, "base64");
  assert.equal(result.exportMetadata.binaryContent?.mediaType, "application/pdf");
  assert.equal(result.exportMetadata.binaryContent?.inlineContentExcluded, true);
});

test("pdf export decodes to bytes with %PDF signature and excludes unsafe text", async () => {
  const result = await buildDeliverableExport({
    engagementId: "EXPORT-ENG-PDF-SAFE",
    engagementTitle: "Safety Check",
    detail: makeDetail({
      deliverables: {
        executiveReport: "storagePath and apiKey should be excluded",
        onePageSummary: "rawProviderResponse should be excluded",
        deckOutline: [],
        evidenceReferences: [],
        evidenceSummary: {
          evidenceUsed: [],
          assumptions: [],
          openQuestions: [],
          humanConfirmations: [],
          sourceCoverage: {
            dataRoomDocuments: 0,
            humanConfirmations: 0,
            clientProvidedAnchors: 0,
            agentEvidence: 0,
            openQuestions: 0,
          },
          confidenceSummary: {
            level: "pending",
            score: null,
            rationale: "No evidence",
          },
          missingEvidence: [],
          recommendedNextActions: [],
        },
      },
    }),
    format: "pdf",
    template: requireTemplate("executive-standard"),
  });

  const decoded = Buffer.from(result.content, "base64");
  const header = decoded.subarray(0, 4).toString("utf8");

  assert.ok(decoded.byteLength > 0);
  assert.equal(header, "%PDF");
  assert.equal(result.safetySummary.providerPayloadExcluded, true);
  assert.equal(result.safetySummary.storagePathExcluded, true);
});
