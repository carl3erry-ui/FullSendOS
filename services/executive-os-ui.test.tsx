import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstRunDashboard } from "../app/components/first-run-dashboard";
import { ProjectDashboard } from "../app/components/project-dashboard";
import { DeliverableExportPanel } from "../app/components/deliverable-export-panel";

test("FirstRunDashboard renders hero section with primary CTA", () => {
  const html = renderToStaticMarkup(
    React.createElement(FirstRunDashboard, {
      onCreateClient: () => {},
      onCreateEngagement: () => {},
    }),
  );

  assert.match(html, /Build your first AI-powered consulting engagement/);
  assert.match(html, /Start Client Onboarding/);
  assert.match(html, /View Demo Workspace/);
  assert.doesNotMatch(html, /XAI_API_KEY|\.env\.local|rawProviderResponse|storagePath|textExtracted/i);
});

test("FirstRunDashboard renders four setup steps", () => {
  const html = renderToStaticMarkup(
    React.createElement(FirstRunDashboard, {
      onCreateClient: () => {},
      onCreateEngagement: () => {},
    }),
  );

  assert.match(html, /Onboard Client/);
  assert.match(html, /Build Data Room/);
  assert.match(html, /Create Engagement/);
  assert.match(html, /Deploy AI Workforce/);
});

test("FirstRunDashboard renders capability pills and output cards", () => {
  const html = renderToStaticMarkup(
    React.createElement(FirstRunDashboard, {
      onCreateClient: () => {},
      onCreateEngagement: () => {},
    }),
  );

  assert.match(html, /Executive Reports/);
  assert.match(html, /Executive Report/);
  assert.match(html, /Competitive Map/);
  assert.match(html, /Strategy Memo/);
  assert.match(html, /What The AI Workforce Produces/);
});

test("ProjectDashboard renders executive OS header language", () => {
  const html = renderToStaticMarkup(React.createElement(ProjectDashboard));

  assert.match(html, /Client Command Center/);
  assert.match(html, /FullSendOS Executive OS/);
  assert.match(html, /Onboard Client/);
});

test("ProjectDashboard renders decision queue and AI Workforce pipeline", () => {
  const html = renderToStaticMarkup(React.createElement(ProjectDashboard));

  assert.match(html, /Decision Queue/);
  assert.match(html, /AI Workforce Pipeline/);
  assert.match(html, /Active Engagements/);
});

test("ProjectDashboard empty client state has executive-grade guidance", () => {
  const html = renderToStaticMarkup(React.createElement(ProjectDashboard));

  assert.match(html, /Start your first client command center\.|No active clients yet/i);
});

test("DeliverableExportPanel shows deliverable-ready status when hasDeliverables is true", () => {
  const html = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXEC-1",
      disableAutoLoad: true,
      hasDeliverables: true,
      initialExports: [],
    }),
  );

  assert.match(html, /Executive deliverables are ready/);
  assert.match(html, /Generate MARKDOWN/);
});

test("DeliverableExportPanel shows not-ready guidance when hasDeliverables is false", () => {
  const html = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXEC-2",
      disableAutoLoad: true,
      hasDeliverables: false,
      initialExports: [],
    }),
  );

  assert.match(html, /No deliverables yet/);
  assert.match(html, /Export buttons are unavailable/);
  assert.match(html, /Deploy the AI Workforce first/i);
});

test("DeliverableExportPanel no exports message is context-aware", () => {
  const htmlReady = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXEC-3",
      disableAutoLoad: true,
      hasDeliverables: true,
      initialExports: [],
    }),
  );

  const htmlNotReady = renderToStaticMarkup(
    React.createElement(DeliverableExportPanel, {
      engagementId: "ENG-EXEC-4",
      disableAutoLoad: true,
      hasDeliverables: false,
      initialExports: [],
    }),
  );

  assert.match(htmlReady, /Use the buttons above to generate your first export/);
  assert.match(htmlNotReady, /Run the engagement workflow to produce deliverables/);
});
