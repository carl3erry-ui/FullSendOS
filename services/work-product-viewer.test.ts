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
    deckOutline: [{ slide: 1, title: "Situation", purpose: "Set context", keyPoints: ["Context", "Problem"] }],
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
  assert.match(html, /Executive Deliverables/);
  assert.match(html, /Structured executive report/);
  assert.match(html, /One-page decision brief/);
});

test("department navigation renders configured departments", () => {
  const html = renderViewer();
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
  assert.match(html, /Key message: Set context/);
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
