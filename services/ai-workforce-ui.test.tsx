import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentsList } from "../app/components/agents-list";
import { ProjectDashboard } from "../app/components/project-dashboard";
import { TaskCreationForm } from "../app/components/task-creation-form";
import { TaskDetailPanel } from "../app/components/task-detail-panel";
import { TasksList } from "../app/components/tasks-list";
import {
  GenericOutputRenderer,
  OrchestratorOutputRenderer,
} from "../app/components/output-renderers";
import {
  buildTaskCreatePayload,
  createTask,
  fetchTaskDetail,
  getApprovalRequestConfig,
  mapFieldErrors,
  runTask,
  sanitizeOutputForDisplay,
  submitTaskApproval,
  type PublicAgentMetadata,
} from "../app/components/agent-task-client";

const agents: PublicAgentMetadata[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    description: "Plans work for an engagement.",
    role: "engagement-planner",
    version: "1.0.0",
    capabilities: ["planning", "coordination"],
    defaultProvider: "mock",
    defaultModel: "mock-1.0",
    requiresApproval: false,
    enabled: true,
  },
];

const tasks = [
  {
    id: "task-1",
    agentId: "orchestrator",
    title: "Plan launch",
    objective: "Create a go-to-market plan",
    projectId: null,
    engagementId: "ENG-1",
    status: "queued",
    approvalStatus: "pending",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  },
];

test("AI Workforce tab renders in the dashboard", () => {
  const html = renderToStaticMarkup(React.createElement(ProjectDashboard));
  assert.match(html, /AI Workforce/);
  assert.match(html, /Engagements/);
  assert.match(html, /Human Input \/ Action Center/);
  assert.match(html, /Client Command Center/);
});

test("Agent list renders and hides private prompts", () => {
  const html = renderToStaticMarkup(
    React.createElement(AgentsList, {
      agents: [{ ...agents[0], systemPrompt: "SHOULD_NOT_RENDER" } as PublicAgentMetadata],
      isLoading: false,
    }),
  );

  assert.match(html, /Orchestrator/);
  assert.match(html, /planning/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER/);
});

test("Task creation payload submits valid data", () => {
  const payload = buildTaskCreatePayload({
    agentId: "orchestrator",
    title: "Plan launch",
    objective: "Create a go-to-market plan",
    instructions: "Use the mock provider",
    context: "Current pipeline is warm inbound only.",
    engagementId: "ENG-1",
    priority: "high",
    provider: "mock",
  });

  assert.deepEqual(payload, {
    agentId: "orchestrator",
    title: "Plan launch",
    objective: "Create a go-to-market plan",
    instructions: "Use the mock provider",
    context: { raw: "Current pipeline is warm inbound only." },
    engagementId: "ENG-1",
    priority: "high",
    provider: "mock",
  });
});

test("API field errors map to displayable field errors", () => {
  assert.deepEqual(mapFieldErrors(["title: Required", "objective: Too short"]), {
    title: "Required",
    objective: "Too short",
  });
});

test("Task creation form renders the available agent selector", () => {
  const html = renderToStaticMarkup(
    React.createElement(TaskCreationForm, {
      agents,
      onTaskCreated: () => {},
    }),
  );

  assert.match(html, /Create Task/);
  assert.match(html, /Orchestrator/);
  assert.match(html, /Mock/);
});

test("Task list renders tasks", () => {
  const html = renderToStaticMarkup(
    React.createElement(TasksList, {
      tasks,
      isLoading: false,
      selectedTaskId: null,
      onSelectTask: () => {},
    }),
  );

  assert.match(html, /Plan launch/);
  assert.match(html, /Create a go-to-market plan/);
});

test("Task detail renderer markup includes loading state anchor", () => {
  const html = renderToStaticMarkup(
    React.createElement(TaskDetailPanel, {
      taskId: "task-1",
      onTaskCompleted: () => {},
    }),
  );

  assert.match(html, /Loading task details/);
});

test("Structured output renders readably", () => {
  const html = renderToStaticMarkup(
    React.createElement(OrchestratorOutputRenderer, {
      data: {
        summary: "Engagement plan ready",
        assumptions: ["Budget approved"],
        planned_tasks: [{ title: "Research buyers", owner: "researcher" }],
        risks: ["Unclear ICP"],
        success_criteria: ["First customer interviews booked"],
      },
    }),
  );

  assert.match(html, /Engagement plan ready/);
  assert.match(html, /Research buyers/);
  assert.match(html, /First customer interviews booked/);
});

test("Unsafe raw data is not displayed in generic output", () => {
  const html = renderToStaticMarkup(
    React.createElement(GenericOutputRenderer, {
      data: {
        safe: "Visible",
        rawResponse: "SHOULD_NOT_RENDER",
        systemPromptSnapshot: "SHOULD_NOT_RENDER",
        diagnosticTrace: "SHOULD_NOT_RENDER",
      },
    }),
  );

  assert.match(html, /Visible/);
  assert.doesNotMatch(html, /SHOULD_NOT_RENDER/);
});

test("Run button client calls the run endpoint", async () => {
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  await runTask("task-1", async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });

  assert.equal(calls[0]?.url, "/api/agent-tasks/task-1/run");
  assert.equal(calls[0]?.options?.method, "POST");
  assert.equal(calls[0]?.options?.body, "{}");
});

test("Approve calls the approve endpoint", async () => {
  const calls: Array<{ url: string; body: string | undefined }> = [];
  await submitTaskApproval("task-1", "approve", "", async (url, options) => {
    calls.push({ url: String(url), body: options?.body as string | undefined });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });

  assert.equal(calls[0]?.url, "/api/agent-tasks/task-1/approve");
  assert.equal(calls[0]?.body, "{}");
});

test("Reject calls the reject endpoint", async () => {
  const calls: Array<{ url: string; body: string | undefined }> = [];
  await submitTaskApproval("task-1", "reject", "Needs stronger evidence", async (url, options) => {
    calls.push({ url: String(url), body: options?.body as string | undefined });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });

  assert.equal(calls[0]?.url, "/api/agent-tasks/task-1/reject");
  assert.equal(calls[0]?.body, JSON.stringify({ reviewerNotes: "Needs stronger evidence" }));
});

test("Request revision calls the request-revision endpoint with notes", async () => {
  const calls: Array<{ url: string; body: string | undefined }> = [];
  await submitTaskApproval("task-1", "revision", "Clarify assumptions", async (url, options) => {
    calls.push({ url: String(url), body: options?.body as string | undefined });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });

  assert.equal(calls[0]?.url, "/api/agent-tasks/task-1/request-revision");
  assert.equal(calls[0]?.body, JSON.stringify({ reviewerNotes: "Clarify assumptions" }));
});

test("Approval request config maps actions to routes", () => {
  assert.deepEqual(getApprovalRequestConfig("approve", ""), {
    endpoint: "approve",
    payload: {},
  });
  assert.deepEqual(getApprovalRequestConfig("reject", "Need more proof"), {
    endpoint: "reject",
    payload: { reviewerNotes: "Need more proof" },
  });
  assert.deepEqual(getApprovalRequestConfig("revision", "Revise scope"), {
    endpoint: "request-revision",
    payload: { reviewerNotes: "Revise scope" },
  });
});

test("Task detail client sanitizes unsafe nested output data", async () => {
  const detail = await fetchTaskDetail("task-1", async () =>
    new Response(
      JSON.stringify({
        data: {
          task: {
            id: "task-1",
            agentId: "orchestrator",
            title: "Plan launch",
            objective: "Create a go-to-market plan",
            status: "completed",
            approvalStatus: "approved",
            priority: "high",
            provider: "mock",
            model: "mock-1.0",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            output: {
              summary: "Visible",
              rawResponse: "SHOULD_NOT_RENDER",
            },
          },
          agent: {
            name: "Orchestrator",
            role: "engagement-planner",
          },
        },
      }),
      { status: 200 },
    ),
  );

  assert.deepEqual(detail.task.output, { summary: "Visible" });
});

test("Sanitize helper removes unsafe fields recursively", () => {
  assert.deepEqual(sanitizeOutputForDisplay({
    safe: "ok",
    nested: { diagnosticTrace: "drop", safeNested: "keep" },
    list: [{ rawProviderResponse: "drop", safeList: true }],
  }), {
    safe: "ok",
    nested: { safeNested: "keep" },
    list: [{ safeList: true }],
  });
});

test("Create task client surfaces API field errors through thrown payload", async () => {
  await assert.rejects(
    () =>
      createTask(
        {
          agentId: "",
          title: "",
          objective: "",
          instructions: "",
          context: "",
          engagementId: "",
          priority: "medium",
          provider: "mock",
        },
        async () =>
          new Response(
            JSON.stringify({
              error: "Agent task validation failed.",
              fieldErrors: [{ path: "agentId", message: "agentId is required" }],
            }),
            { status: 400 },
          ),
      ),
    (error: Error & { payload?: unknown }) => {
      assert.equal(error.message, "Agent task validation failed.");
      assert.deepEqual(error.payload, {
        error: "Agent task validation failed.",
        fieldErrors: [{ path: "agentId", message: "agentId is required" }],
      });
      return true;
    },
  );
});