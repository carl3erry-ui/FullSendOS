import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliverableExportPanel } from "../app/components/deliverable-export-panel";
import { WorkProductViewer } from "../app/components/work-product-viewer";

test("deliverable export panel renders controls and empty state", () => {
  const html = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXPORT-1",
      disableAutoLoad: true,
      initialExports: [],
    }),
  );

  assert.match(html, /Export Deliverables/);
  assert.match(html, /Export MARKDOWN/);
  assert.match(html, /Export HTML/);
  assert.match(html, /Export TEXT/);
  assert.match(html, /Export JSON/);
  assert.match(html, /No exports have been generated yet\./);
});

test("work product viewer exposes export deliverables tab", () => {
  const html = renderToStaticMarkup(
    React.createElement(WorkProductViewer, {
      project: {
        id: "ENG-EXPORT-2",
        companyName: "Export Co",
        objective: "Validate export tab",
        status: "needs-review",
        updatedAt: new Date().toISOString(),
        completedDepartments: 7,
        totalDepartments: 7,
      },
      detail: {
        id: "ENG-EXPORT-2",
        status: "needs-review",
        departments: {},
        deliverables: {
          executiveReport: "Report",
          onePageSummary: "Summary",
          deckOutline: [],
        },
        audit: { runs: [], warnings: [] },
      },
      isLoading: false,
      loadError: null,
      activeSection: "exports",
      onSectionChange: () => {},
      runningProjectId: null,
      onRun: () => {},
    }),
  );

  assert.match(html, /Export Deliverables/);
  assert.match(html, /No exports have been generated yet\./);
  assert.match(html, /Data Room/);
  assert.match(html, /Human Input \/ Action Center/);
});
