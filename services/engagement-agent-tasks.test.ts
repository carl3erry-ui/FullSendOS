import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EngagementAgentTasksPanel } from "../app/components/engagement-agent-tasks-panel";
import { EngagementTaskCreationModal } from "../app/components/engagement-task-creation-modal";
import type { PublicAgentMetadata, AgentTaskSummary } from "../app/components/agent-task-client";

const mockAgents: PublicAgentMetadata[] = [
  {
    id: "researcher-1",
    name: "Research Agent",
    description: "Conducts research",
    role: "researcher",
    version: "1.0",
    capabilities: ["research"],
    defaultProvider: "mock",
    defaultModel: "mock-model",
    requiresApproval: false,
    enabled: true,
  },
];

const mockTasks: AgentTaskSummary[] = [
  {
    id: "task-1",
    agentId: "researcher-1",
    title: "Market Research",
    objective: "Research the market",
    projectId: null,
    engagementId: "eng-123",
    status: "completed",
    approvalStatus: "not_required",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T01:00:00Z",
  },
];

test("EngagementAgentTasksPanel renders without errors", () => {
  // Note: This is a client component, so we test via static rendering
  // In a real scenario, this would be tested with integration tests
  const html = renderToStaticMarkup(
    React.createElement(EngagementAgentTasksPanel, {
      engagementId: "eng-123",
      engagementName: "Acme Corp",
      engagementObjective: "Market analysis",
    }),
  );
  
  assert.ok(html.length > 0);
});

test("EngagementTaskCreationModal renders with engagement context", () => {
  const html = renderToStaticMarkup(
    React.createElement(EngagementTaskCreationModal, {
      agents: mockAgents,
      engagementId: "eng-123",
      engagementName: "Acme Corp",
      engagementObjective: "Market analysis",
      onClose: () => {},
      onTaskCreated: () => {},
    }),
  );

  assert.match(html, /Create Agent Task/);
  assert.match(html, /Acme Corp/);
  // Engagement objective should be visible
  assert.ok(html.includes("Market analysis"));
});
