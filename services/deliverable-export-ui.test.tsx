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
  assert.match(html, /Template/);
  assert.match(html, /Generate MARKDOWN/);
  assert.match(html, /Generate HTML/);
  assert.match(html, /Generate TEXT/);
  assert.match(html, /Generate JSON/);
  assert.match(html, /Generate PDF/);
  assert.match(html, /PDF generates a client-ready downloadable file|PDF exports generate a downloadable client-ready file/i);
  assert.match(html, /No exports generated yet\.|No exports have been generated yet\./i);
  assert.doesNotMatch(html, /storagePath|rawProviderResponse|systemPrompt|apiKey|hidden reasoning|diagnosticTrace|textExtracted/i);
});

test("deliverable export panel shows loading state when auto-load is enabled", () => {
  const html = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXPORT-LOADING",
    }),
  );

  assert.match(html, /Loading exports\.\.\./);
  assert.match(html, /Refreshing\.\.\./);
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
  assert.match(html, /Loading exports\.\.\./);
  assert.match(html, /Data Room/);
  assert.match(html, /Human Input \/ Action Center/);
  assert.match(html, /Generate MARKDOWN/);
  assert.match(html, /Generate HTML/);
  assert.match(html, /Generate TEXT/);
  assert.match(html, /Generate JSON/);
  assert.match(html, /Generate PDF/);
  assert.doesNotMatch(html, /storagePath|rawProviderResponse|systemPrompt|apiKey|hidden reasoning|diagnosticTrace|textExtracted/i);
});

test("deliverable export panel shows download action", () => {
  const html = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXPORT-3",
      disableAutoLoad: true,
      initialExports: [
        {
          id: "exp-1",
          format: "markdown",
          templateId: "executive-standard",
          templateName: "Executive Standard",
          filename: "hardware-brewery-deliverable-markdown-2026-07-14.md",
          generatedAt: new Date().toISOString(),
          byteSize: 1024,
          status: "created",
          contentType: "text/markdown; charset=utf-8",
        },
      ],
    }),
  );

  assert.match(html, /Export History/);
  assert.match(html, /Executive Standard/);
  assert.match(html, /Download/);
});

test("deliverable export panel shows PDF entry and clear preview behavior", () => {
  const html = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXPORT-4",
      disableAutoLoad: true,
      initialExports: [
        {
          id: "exp-pdf-1",
          format: "pdf",
          templateId: "client-ready",
          templateName: "Client Ready",
          filename: "hardware-brewery-deliverable-pdf-2026-07-14.pdf",
          generatedAt: new Date().toISOString(),
          byteSize: 4096,
          status: "created",
          contentType: "application/pdf",
        },
      ],
    }),
  );

  assert.match(html, /hardware-brewery-deliverable-pdf-2026-07-14\.pdf/);
  assert.match(html, /PDF \| Client Ready/);
  assert.match(html, /Preview unavailable/);
  assert.match(html, /Download/);
  assert.doesNotMatch(html, /storagePath|rawProviderResponse|systemPrompt|apiKey|hidden reasoning|diagnosticTrace|textExtracted/i);
});
