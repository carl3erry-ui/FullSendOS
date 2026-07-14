import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliverableExport } from "./deliverable-export-service";
import type { EngagementDetail } from "@/app/components/work-product-model";

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

test("markdown export includes core deliverable sections", () => {
  const result = buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    clientName: "Hardware Brewery",
    detail: makeDetail(),
    format: "markdown",
  });

  assert.equal(result.format, "markdown");
  assert.match(result.content, /## Executive Report/);
  assert.match(result.content, /## One-Page Summary/);
  assert.match(result.content, /## Deck Outline/);
  assert.match(result.content, /## Sources Used/);
  assert.match(result.content, /## Confidence Summary/);
});

test("html export uses semantic safe markup", () => {
  const result = buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    detail: makeDetail(),
    format: "html",
  });

  assert.equal(result.format, "html");
  assert.match(result.content, /<!doctype html>/i);
  assert.match(result.content, /<section>/);
  assert.doesNotMatch(result.content, /<script/i);
});

test("text export includes all major sections", () => {
  const result = buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    detail: makeDetail(),
    format: "text",
  });

  assert.equal(result.format, "text");
  assert.match(result.content, /EXECUTIVE REPORT/);
  assert.match(result.content, /ONE-PAGE SUMMARY/);
  assert.match(result.content, /SOURCES USED/);
  assert.match(result.content, /OPEN QUESTIONS/);
});

test("json export package is structured and safe", () => {
  const result = buildDeliverableExport({
    engagementId: "EXPORT-ENG-1",
    engagementTitle: "Hardware Brewery",
    detail: makeDetail(),
    format: "json",
  });

  assert.equal(result.format, "json");
  const parsed = JSON.parse(result.content) as { executiveReport?: string; exportMetadata?: string };
  assert.equal(typeof parsed.executiveReport, "string");
  assert.equal(typeof parsed.exportMetadata, "string");
});

test("export handles missing optional sections gracefully", () => {
  const result = buildDeliverableExport({
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
  });

  assert.match(result.content, /No executive report recorded\./);
  assert.match(result.content, /No one-page summary recorded\./);
  assert.match(result.content, /No deck outline recorded\./);
});

test("export safety excludes unsafe fields", () => {
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

  const result = buildDeliverableExport({
    engagementId: "EXPORT-ENG-3",
    engagementTitle: "Unsafe Check",
    detail: unsafeDetail,
    format: "text",
  });

  assert.doesNotMatch(result.content, /storagePath/i);
  assert.doesNotMatch(result.content, /rawProviderResponse/i);
  assert.doesNotMatch(result.content, /textExtracted/i);
  assert.equal(result.safetySummary.storagePathExcluded, true);
  assert.equal(result.safetySummary.providerPayloadExcluded, true);
});
