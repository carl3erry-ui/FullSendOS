import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkProductViewer from "../app/components/work-product-viewer";
import {
  getDefaultWorkspaceSection,
  type EngagementDetail,
  type WorkspaceProjectSummary,
  WORKFLOW_DEPARTMENTS,
} from "../app/components/work-product-model";

const baseProject: WorkspaceProjectSummary = {
  id: "VIEWER-TEST-001",
  companyName: "Viewer Test Co",
  objective: "Validate structured work product rendering",
  status: "needs-review",
  updatedAt: new Date().toISOString(),
  completedDepartments: 3,
  totalDepartments: 7,
  lastRunError: null,
};

const completeDetail: EngagementDetail = {
  id: "VIEWER-TEST-001",
  status: "needs-review",
  updatedAt: new Date().toISOString(),
  departments: {
    research: {
      summary: "Research summary",
      trends: [{ name: "Demand shift", direction: "growing", implication: "Adjust offers" }],
      metrics: [{ name: "Source count", value: 0, classification: "estimate", confidence: 0.62, sourceIds: [] }],
      opportunities: ["New segment"],
      risks: ["Evidence gap"],
      unknowns: [{ question: "Who is buyer?", whyItMatters: "Targets messaging", recommendedMethod: "Interview" }],
      claims: [{ statement: "Category is growing", classification: "estimate", confidence: 0.62, sourceIds: [] }],
    },
    publishing: {
      summary: "Publishing summary",
      recommendations: [
        {
          priority: "immediate",
          recommendation: "Launch executive review",
          rationale: "Align leadership",
          successMeasure: "Decision sign-off",
        },
      ],
    },
  },
  deliverables: {
    executiveReport: "Structured executive report",
    onePageSummary: "One-page decision brief",
    deckOutline: [{ slide: 1, title: "Situation", purpose: "Set context", keyPoints: ["Context", "Problem"], evidenceNote: "Sources used: Source A. Open questions: Confirm address." }],
    evidenceReferences: [
      {
        id: "ref-1",
        sourceType: "data_room_document",
        citationLabel: "Source A",
        title: "Lease Summary.pdf",
        description: "Lease abstract used for underwriting context.",
        excerptPreview: "Candidate location appears in the lease abstract.",
        confidence: 0.72,
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
          description: "Lease abstract used for underwriting context.",
          excerptPreview: "Candidate location appears in the lease abstract.",
          confidence: 0.72,
          verifiedStatus: "retrieved_from_data_room",
        },
      ],
      assumptions: [
        {
          id: "assumption-1",
          statement: "Address remains unverified until the client confirms it.",
          departmentId: "research",
          confidence: 0.45,
        },
      ],
      openQuestions: [
        {
          id: "question-1",
          question: "What is the confirmed operating address?",
          whyItMatters: "Real estate underwriting depends on location-specific diligence.",
          recommendedMethod: "Confirm with the client or a vetted document.",
          relatedField: "address",
          humanInputRequestId: "hir-0001",
          verifiedStatus: "open_question",
        },
      ],
      humanConfirmations: [
        {
          id: "confirmation-1",
          citationLabel: "Human Input 000001",
          title: "Confirm buyer persona",
          description: "Confirmed by operator.",
          confidence: 0.95,
          verifiedStatus: "human_confirmed",
        },
      ],
      sourceCoverage: {
        dataRoomDocuments: 1,
        humanConfirmations: 1,
        clientProvidedAnchors: 2,
        agentEvidence: 1,
        openQuestions: 1,
      },
      confidenceSummary: {
        level: "medium",
        score: 0.64,
        rationale: "Evidence is useful, but address confirmation is still outstanding.",
      },
      missingEvidence: ["Confirmed operating address"],
      recommendedNextActions: ["Confirm address with the client"],
    },
  },
  audit: {
    runs: [
      { department: "research", status: "complete" },
      { department: "publishing", status: "complete" },
    ],
    warnings: [],
    activeRun: null,
  },
};

function renderViewer(overrides: {
  project?: WorkspaceProjectSummary;
  detail?: EngagementDetail | null;
  activeSection?: string;
  isLoading?: boolean;
  loadError?: string | null;
  runningProjectId?: string | null;
} = {}) {
  return renderToStaticMarkup(
    React.createElement(WorkProductViewer, {
      project: overrides.project || baseProject,
      detail: overrides.detail === undefined ? completeDetail : overrides.detail,
      isLoading: overrides.isLoading || false,
      loadError: overrides.loadError || null,
      activeSection: overrides.activeSection || "executive",
      runningProjectId: overrides.runningProjectId || null,
      onSectionChange: () => {},
      onRun: () => {},
    }),
  );
}

test("executive deliverables are the default completed view", () => {
  const section = getDefaultWorkspaceSection(completeDetail);
  assert.equal(section, "executive");
});

test("executive deliverables render when present", () => {
  const html = renderViewer({ activeSection: "executive" });
  assert.match(html, /Executive Brief/);
  assert.match(html, /Executive Decision Center/);
  assert.match(html, /Structured executive report/);
  assert.match(html, /One-page decision brief/);
});

test("top-level navigation uses executive, analysis, department, and evidence sections", () => {
  const html = renderViewer();
  assert.match(html, /Executive Brief/);
  assert.match(html, /Supporting Analysis/);
  assert.match(html, /Department Work Product/);
  assert.match(html, /Evidence and Unknowns/);
  assert.match(html, /Human Input \/ Action Center/);
  assert.match(html, /Data Room/);
});

test("archived lifecycle state explains why workflow run is disabled", () => {
  const html = renderViewer({
    project: {
      ...baseProject,
      lifecycleStatus: "archived",
    },
  });

  assert.match(html, /This engagement is archived\./);
  assert.match(html, /Restore it to active before running workflow again\./);
});

test("department selector renders configured departments in department view", () => {
  const html = renderViewer({ activeSection: "department:research" });
  for (const department of WORKFLOW_DEPARTMENTS) {
    const label = department === "publishing" ? "Executive Review" : department.charAt(0).toUpperCase() + department.slice(1);
    assert.match(html, new RegExp(label));
  }
});

test("research structured fields render trends, metrics, risks, opportunities, and unknowns", () => {
  const html = renderViewer({ activeSection: "department:research" });
  assert.match(html, /Research summary/);
  assert.match(html, /Demand shift/);
  assert.match(html, /Adjust offers/);
  assert.match(html, /Source count/);
  assert.match(html, /62% confidence/);
  assert.match(html, /New segment/);
  assert.match(html, /Evidence gap/);
  assert.match(html, /Who is buyer\?/);
  assert.match(html, /Recommended method: Interview/);
});

test("deck outline renders slide structure", () => {
  const html = renderViewer({ activeSection: "executive" });
  assert.match(html, /Slide 1/);
  assert.match(html, /Situation/);
  assert.match(html, /Key Message/);
  assert.match(html, /Set context/);
  assert.match(html, /Evidence Note/);
  assert.match(html, /Sources used: Source A/);
});

test("evidence-backed executive view renders sources, assumptions, open questions, confirmations, and confidence", () => {
  const html = renderViewer({ activeSection: "executive" });
  assert.match(html, /Sources Used/);
  assert.match(html, /Source A/);
  assert.match(html, /Lease Summary\.pdf/);
  assert.match(html, /Assumptions/);
  assert.match(html, /Address remains unverified until the client confirms it\./);
  assert.match(html, /Open Questions/);
  assert.match(html, /What is the confirmed operating address\?/);
  assert.match(html, /Human Input Request: hir-0001/);
  assert.match(html, /Human Confirmations/);
  assert.match(html, /Confirmed by operator\./);
  assert.match(html, /Confidence Summary/);
  assert.match(html, /MEDIUM \(64%\)/);
  assert.match(html, /Confirmed operating address/);
});

test("evidence panel renders safe sources and does not expose full extracted text or storage paths", () => {
  const html = renderViewer({ activeSection: "evidence" });
  assert.match(html, /Sources Used/);
  assert.doesNotMatch(html, /textExtracted/i);
  assert.doesNotMatch(html, /storagePath/i);
});

test("not-started state is explicit", () => {
  const project = { ...baseProject, status: "draft", completedDepartments: 0 };
  const html = renderViewer({ project, detail: { ...completeDetail, deliverables: { deckOutline: [] } } });
  assert.match(html, /No validated work product is available yet/);
});

test("running state is explicit", () => {
  const project = { ...baseProject, status: "running" };
  const html = renderViewer({ project, runningProjectId: project.id });
  assert.match(html, /currently producing work product/);
});

test("failed state shows persisted failure and keeps partial outputs reviewable", () => {
  const project = { ...baseProject, status: "failed", lastRunError: "Validation failed" };
  const detail: EngagementDetail = {
    ...completeDetail,
    status: "failed",
    deliverables: { deckOutline: [] },
    departments: {
      research: completeDetail.departments.research || null,
      publishing: null,
    },
    audit: {
      runs: [{ department: "publishing", status: "failed", error: "Publishing contract mismatch" }],
      warnings: [],
      activeRun: null,
    },
  };

  const html = renderViewer({ project, detail, activeSection: "department:research" });
  assert.match(html, /Engagement did not complete successfully/);
  assert.match(html, /Publishing contract mismatch/);
  assert.match(html, /Research summary/);
});

test("completed and needs-review state shows ready-for-review language", () => {
  const html = renderViewer({ project: { ...baseProject, status: "complete" } });
  assert.match(html, /Ready for review/);
});

test("raw diagnostics and debug fields are not displayed", () => {
  const detail: EngagementDetail = {
    ...completeDetail,
    departments: {
      research: {
        summary: "Research summary",
        debugPrompt: "SHOULD_NOT_RENDER",
        rawProviderResponse: "SHOULD_NOT_RENDER",
        diagnosticTrace: "SHOULD_NOT_RENDER",
      },
    },
  };

  const html = renderViewer({ detail, activeSection: "department:research" });
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER/);
});
