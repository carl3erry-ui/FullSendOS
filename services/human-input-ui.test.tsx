import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HumanInputCenter } from "../app/components/human-input-center";
import { EngagementHumanInputPanel } from "../app/components/engagement-human-input-panel";
import { HumanInputRequestList } from "../app/components/human-input-list";

test("Global Action Center renders its empty state message", () => {
  const html = renderToStaticMarkup(React.createElement(HumanInputCenter));
  assert.match(html, /Human Input Center/);
  assert.match(html, /Loading human input requests/i);
});

test("Engagement human input panel renders its heading", () => {
  const html = renderToStaticMarkup(React.createElement(EngagementHumanInputPanel, { engagementId: "eng-1" }));
  assert.match(html, /Engagement human input/);
  assert.match(html, /Open questions and confirmations/);
});

test("Human input list renders open requests and empty state", () => {
  const empty = renderToStaticMarkup(
    React.createElement(HumanInputRequestList, {
      requests: [],
      emptyMessage: "No human input is needed right now.",
      onAnswer: async () => {},
      onConfirm: async () => {},
      onReject: async () => {},
      onSkip: async () => {},
    }),
  );
  assert.match(empty, /No human input is needed right now/);

  const html = renderToStaticMarkup(
    React.createElement(HumanInputRequestList, {
      requests: [
        {
          id: "hir-1",
          type: "missing_information",
          title: "Confirm address",
          prompt: "Please confirm the business address.",
          status: "open",
          priority: "high",
          requestedBy: "system",
          requestedAt: new Date().toISOString(),
          options: [
            { label: "Confirm", value: "confirm" },
            { label: "Reject", value: "reject" },
          ],
          evidence: [],
          sourceReferences: [],
          requiredToContinue: true,
          metadata: {},
        },
      ],
      emptyMessage: "No human input is needed right now.",
      onAnswer: async () => {},
      onConfirm: async () => {},
      onReject: async () => {},
      onSkip: async () => {},
    }),
  );
  assert.match(html, /Confirm address/);
  assert.match(html, /Please confirm the business address/);
  assert.match(html, /blocking/);
});
