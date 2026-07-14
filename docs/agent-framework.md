# FullSendOS Agent Framework — Foundation Slice

## What is an agent in FullSendOS?

An agent is an AI-powered specialist that performs a specific type of thinking work
inside a consulting engagement. Agents analyze context, produce structured outputs,
and declare what they need from humans before proceeding with consequential actions.

Agents do **not** replace workflows. They operate inside them.

---

## Concepts

### Agent vs Workflow vs Automation vs Approval

| Concept | What it is | Controls |
|---------|-----------|---------|
| **Agent** | AI specialist that reasons and produces structured output | Thinking work |
| **Workflow** | Ordered pipeline of departments (research → strategy → brand → ...) | Process sequencing |
| **Automation** | Deterministic rule-based operation with no AI reasoning | Mechanical tasks |
| **Approval** | Human authorization gate before a consequential action executes | Human-in-the-loop |

Agents work within workflows. Automations are workflow steps that don't need AI.
Approvals are required when an agent wants to perform a high-risk action.

---

## Provider Abstraction

All agents communicate with AI providers through the `AIProvider` interface:

```typescript
interface AIProvider {
  generateText(request: AIProviderRequest): Promise<NormalizedAIResponse>;
  generateStructuredResult<T>(request: AIProviderRequest, schema: ZodType<T>): Promise<T>;
}
```

Agents never import provider clients directly. This means you can:
- Swap xAI for another provider without touching agent logic
- Run all agents in mock mode for tests and demos
- Route specific agents to different providers

---

## AIProviderRegistry

The `AIProviderRegistry` maps provider names to `AIProvider` instances:

```typescript
import { AIProviderRegistry } from "./ai/provider-registry";
import { createMockProvider } from "./ai/mock-provider";

const registry = new AIProviderRegistry();
registry.register("mock", createMockProvider());

const provider = registry.resolve("mock"); // throws if name unknown
```

The `globalProviderRegistry` is the shared instance for the application.

---

## AgentRegistry

The `AgentRegistry` stores agent definitions and exposes public-safe metadata:

```typescript
import { AgentRegistry, registerAllAgents } from "./agents";

const registry = new AgentRegistry();
registerAllAgents(registry); // registers full workforce roster

const meta = registry.getPublicMetadata("orchestrator");
// meta omits systemPrompt — safe to serialize to clients

const enabled = registry.listEnabled();
```

Rules:
- Duplicate IDs are rejected with an error.
- `systemPrompt` is never included in public metadata.
- Definitions are read-only after registration.

---

## Registered Agents (Foundation Slice)

### Orchestrator (`orchestrator`)
Plans consulting engagements. Breaks client objectives into structured tasks with
dependencies, priorities, and agent assignments. Identifies risks and approval gates.

Output schema: `OrchestratorOutputSchema`

### Research Agent (`researcher`)
Conducts structured research from available context. Always discloses when live
research tools are unavailable. Produces findings with confidence scores and evidence.

Output schema: `ResearchOutputSchema`

### Quality Control Agent (`quality-control`)
Reviews work products for accuracy, completeness, and logical consistency.
Issues verdicts: `approved`, `approved_with_notes`, `revision_required`, `rejected`.

Output schema: `QualityControlOutputSchema`

### Slice 11 Workforce Foundation

The workforce now includes additional department specialists registered through the
existing `AgentRegistry` and `AgentInstanceRegistry` layers (no framework rebuild):

- `project-manager`
- `market-research`
- `finance`
- `strategy`
- `brand-strategy`
- `creative-director`
- `website-digital`
- `operations`
- `legal-review`
- `sales-revenue`
- `investor-relations`
- `executive-review`

Safety boundaries remain unchanged:

- Public metadata omits `systemPrompt` and runtime schemas.
- Task templates and department mappings are exposed as safe config only.
- Dangerous permissions (publishing, spending, secret access, external actions)
  remain blocked by contract and tests.
- Finance and legal outputs include explicit non-advisory disclaimers.

---

## Mock Mode

To run all agents without live xAI calls:

1. Set `AI_PROVIDER_MODE=mock` in your environment, **or**
2. Register the mock provider directly:

```typescript
import { createMockProvider } from "./ai/mock-provider";
import { globalProviderRegistry } from "./ai/provider-registry";

globalProviderRegistry.register("mock", createMockProvider());
```

The mock provider returns deterministic, schema-conformant outputs for all three
foundation agents. Outputs are meaningful (not lorem ipsum) and validate against
the real output schemas. Tests must never depend on live xAI calls.

---

## xAI Configuration

```
XAI_API_KEY=xai-...         # Required for live calls (server-side only)
XAI_DEFAULT_MODEL=grok-4.5  # Optional — defaults to grok-4.5
XAI_BASE_URL=               # Optional — defaults to https://api.x.ai/v1
```

Use `createXAIProvider()` to get a configured provider:

```typescript
import { createXAIProvider } from "./ai/xai-provider";

const result = createXAIProvider(); // reads from process.env
if (!result.ok) {
  // result.error is a GrokProviderError with kind: "authentication"
  throw result.error;
}
const provider = result.provider;
```

**Security rules:**
- Never import `xai-provider.ts` in client-side code.
- The API key is never logged, serialized, or included in responses.
- A missing key returns a typed error rather than throwing or silently failing.

---

## Security Boundaries

Permission vocabulary (see `agents/permissions.ts`):

| Permission | Risk Level | Slice |
|-----------|-----------|-------|
| `read_project` | Low | ✅ Slice 1 |
| `read_engagement` | Low | ✅ Slice 1 |
| `read_documents` | Low | ✅ Slice 1 |
| `search_internal_knowledge` | Low | ✅ Slice 1 |
| `search_web` | Low | ✅ Slice 1 |
| `create_task` | Low | ✅ Slice 1 |
| `update_task` | Low | ✅ Slice 1 |
| `draft_email` | Low | ✅ Slice 1 |
| `send_email` | **High** | ⛔ Requires approval gate |
| `publish_content` | **High** | ⛔ Requires approval gate |
| `spend_money` | **High** | ⛔ Requires approval gate |
| `modify_production` | **High** | ⛔ Requires approval gate |
| `delete_record` | **High** | ⛔ Requires approval gate |

Agents in this slice hold only low-risk permissions.

---

## Current Limitations (Slices 1-4)

This covers foundation (Slice 1), execution (Slice 2), API routes (Slice 3), and approval UI (Slice 4). The following are **not yet implemented**:

- Engagement workspace agent panel (Slice 5)
- Workflow integration (agents cannot yet be triggered by workflow steps) (Slice 6)
- Tool permission enforcement at runtime (permissions are modelled, not enforced at the tool call level) (Slice 7)
- Live usage tracking from provider responses (captured in AgentExecution but not yet extracted from NormalizedAIResponse)
- Exact cost accounting (estimatedCost is always null — pricing data not configured)
- Background/async task execution queue (Slice 8)
- Task retry policy (each task runs once; rerun = new task)

---

## Task Persistence (Slice 2)

### AgentTaskStore

File-based persistence for `AgentTask` records at `data/agent-tasks/<task-id>.json`.

```typescript
import { AgentTaskStore } from "./agents/task-store";

const store = new AgentTaskStore(); // uses data/agent-tasks/ by default
// or: new AgentTaskStore("/custom/path") for test isolation

await store.saveTask(task);           // create or update
const task = await store.loadTask(id); // throws task_not_found if missing
const tasks = await store.listTasks({ agentId: "researcher", status: "queued" });
```

Supported filters: `projectId`, `engagementId`, `workflowRunId`, `agentId`, `status`.

### AgentExecutionStore

File-based persistence for `AgentExecution` records at `data/agent-executions/<execution-id>.json`.

```typescript
import { AgentExecutionStore } from "./agents/execution-store";

const store = new AgentExecutionStore();
await store.saveExecution(execution);
const exec = await store.loadExecution(id);
const all = await store.listByTaskId(taskId); // ordered by attempt
```

Security: the execution record must never contain authorization headers or API keys. The `sanitizeRawResponse` utility in the executor strips any field whose key matches authorization/api-key patterns before storage.

---

## AgentExecutor (Slice 2)

The `AgentExecutor` is the coordination service that runs a queued task end-to-end.

### Construction

```typescript
import { AgentExecutor } from "./agents/executor";

const executor = new AgentExecutor({
  taskStore,
  executionStore,
  agentRegistry,       // AgentRegistry (definitions)
  instanceRegistry,    // AgentInstanceRegistry (instances)
  providerRegistry,    // AIProviderRegistry
});

const result = await executor.execute(taskId);
if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else {
  console.log(result.task.status, result.output);
}
```

### Executor lifecycle

```
loadTask → resolve definition → resolve instance → check enabled
  → validate task → check approval → check duplicate
  → check high-risk permissions → resolve provider
  → create execution record → update task to running
  → call agent.execute(task, provider)
  → on success: persist output, mark completed
  → on failure: persist error, mark failed
  → return ExecutorResult
```

### Error codes

| Code | Meaning |
|------|---------|
| `agent_not_found` | No agent definition or instance registered for the id |
| `agent_disabled` | Agent definition has `enabled: false` |
| `task_not_found` | No task file found for the given id |
| `invalid_task_input` | Agent's `validateTask()` returned errors |
| `provider_not_found` | Provider name not registered in AIProviderRegistry |
| `missing_api_key` | Provider rejected with authentication error |
| `approval_required` | Task needs human approval before execution |
| `task_already_running` | Duplicate execution rejected |
| `task_already_completed` | Completed task rerun rejected |
| `provider_request_failed` | Provider threw an unexpected error |
| `provider_timeout` | Provider timed out |
| `output_parsing_failed` | Could not parse provider text as JSON |
| `output_validation_failed` | Output did not pass the agent's Zod schema |
| `permission_denied` | Agent holds high-risk tools without approval |

---

## Approval Enforcement (Slice 2)

Current behavior:
- `task.approvalStatus === "pending"` → executor returns `approval_required` immediately
- `definition.requiresApproval === true` AND `approvalStatus` is not `"approved"` or `"not_required"` → task is moved to `"waiting_for_approval"` status, executor returns `approval_required`

The ApprovalGate schema is defined (`agents/types.ts`) but ApprovalGate creation, storage, and review API are not yet implemented.

---

## Duplicate-Run Protection (Slice 2)

- Task with `status: "running"` → executor returns `task_already_running`
- Task with `status: "completed"` → executor returns `task_already_completed`

To rerun a completed task, create a new `AgentTask` record.

---

## Mock Execution

Use the mock provider for tests and demos:

```typescript
import { createMockProvider } from "./ai/mock-provider";
import { AIProviderRegistry } from "./ai/provider-registry";

const providerRegistry = new AIProviderRegistry();
providerRegistry.register("mock", createMockProvider());
// Set task.provider = "mock" and task.model = "mock-1.0"
```

The mock provider returns deterministic, schema-conformant outputs for all three agents without network calls. Tests must use mock mode only.

---

## REST API Routes (Slice 3)

Agent tasks can be created, listed, and executed through REST API endpoints.

### GET /api/agents

Returns public-safe metadata for all enabled agents.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "orchestrator",
      "name": "Orchestrator",
      "description": "Plans consulting engagements...",
      "role": "engagement-planner",
      "version": "1.0.0",
      "capabilities": ["engagement-planning"],
      "allowedTools": ["read_project", "read_engagement"],
      "defaultProvider": "mock",
      "defaultModel": "mock-1.0",
      "requiresApproval": false,
      "maximumIterations": 3,
      "timeoutMs": 30000,
      "enabled": true,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Security:** `systemPrompt` is never included. System prompts are internal implementation details.

---

### POST /api/agent-tasks

Create a new agent task.

**Request:**
```json
{
  "agentId": "orchestrator",
  "title": "Plan engagement",
  "objective": "Develop consulting plan for RP Motors",
  "projectId": "project-123",
  "engagementId": "eng-456",
  "instructions": "Focus on market dynamics",
  "input": {},
  "context": {},
  "provider": "mock",
  "model": "mock-1.0"
}
```

**Required fields:** `agentId`, `title`, `objective`

**Optional fields:** `projectId`, `engagementId`, `workflowRunId`, `departmentId`, `instructions`, `input`, `context`, `priority`, `provider`, `model`, `requestedBy`, `approvalStatus`

**Defaults:**
- `provider`: agent's defaultProvider
- `model`: agent's defaultModel
- `priority`: "medium"
- `approvalStatus`: "pending" if agent.requiresApproval, else "not_required"
- `status`: "queued"

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "task-orchestrator-1721345678",
    "agentId": "orchestrator",
    "title": "Plan engagement",
    "objective": "Develop consulting plan for RP Motors",
    "status": "queued",
    "approvalStatus": "not_required",
    "provider": "mock",
    "model": "mock-1.0",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

**Error Response (422 - Validation):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Agent task validation failed.",
    "fieldErrors": [
      { "path": "agentId", "message": "agentId is required" }
    ]
  }
}
```

**Error Response (404 - Agent Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent \"unknown\" not found.",
    "fieldErrors": []
  }
}
```

---

### GET /api/agent-tasks

List agent tasks with optional filtering.

**Query Parameters:**
- `projectId`: Filter by project
- `engagementId`: Filter by engagement
- `workflowRunId`: Filter by workflow run
- `agentId`: Filter by agent
- `status`: Filter by status (queued, running, waiting_for_approval, completed, failed, cancelled)

**Example:** `GET /api/agent-tasks?agentId=orchestrator&status=queued`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "task-orchestrator-1721345678",
      "agentId": "orchestrator",
      "status": "queued",
      ...
    }
  ]
}
```

---

### GET /api/agent-tasks/[id]

Retrieve a specific task with executions and output.

**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "task-orchestrator-1721345678",
      "agentId": "orchestrator",
      "title": "Plan engagement",
      "status": "completed",
      "approvalStatus": "approved",
      "output": "Strategic plan document...",
      "structuredOutput": {
        "tasks": [...],
        "risks": [...]
      }
    },
    "executions": [
      {
        "id": "exec-task-orchestrator-1721345678-1-1721345679",
        "agentTaskId": "task-orchestrator-1721345678",
        "status": "completed",
        "attempt": 1,
        "usage": { "inputTokens": 150, "outputTokens": 200 },
        "estimatedCost": null,
        "completedAt": "2025-01-01T00:01:00Z"
      }
    ],
    "approvalStatus": "approved",
    "evidence": [],
    "usage": { "inputTokens": 150, "outputTokens": 200 },
    "cost": null
  }
}
```

**Security:** `rawResponse` is omitted from execution records to prevent leaking provider logs or other sensitive data.

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Agent task not found.",
    "fieldErrors": []
  }
}
```

---

### POST /api/agent-tasks/[id]/run

Execute the task synchronously through AgentExecutor.

**Request:** (empty body accepted)

**Response (200 - Success):**
```json
{
  "success": true,
  "data": {
    "task": { ... },
    "execution": { ... },
    "output": { "tasks": [...], "risks": [...] }
  }
}
```

**Error Responses:**

| Error Code | HTTP Status | Meaning |
|-----------|-----------|---------|
| AGENT_NOT_FOUND | 404 | Agent not registered |
| TASK_NOT_FOUND | 404 | Task not found |
| PROVIDER_NOT_FOUND | 404 | Provider not registered |
| PROVIDER_NOT_CONFIGURED | 503 | Provider missing (e.g., no API key) |
| MISSING_API_KEY | 503 | xAI API key missing |
| APPROVAL_REQUIRED | 403 | Task pending approval |
| AGENT_DISABLED | 403 | Agent is disabled |
| PERMISSION_DENIED | 403 | Agent lacks required permissions |
| TASK_ALREADY_RUNNING | 409 | Duplicate execution attempt |
| TASK_ALREADY_COMPLETED | 409 | Task already completed |
| INVALID_TASK_INPUT | 422 | Task input failed validation |
| OUTPUT_PARSING_FAILED | 422 | Output could not be parsed |
| OUTPUT_VALIDATION_FAILED | 422 | Output failed schema validation |
| PROVIDER_REQUEST_FAILED | 502 | Provider error |
| PROVIDER_TIMEOUT | 504 | Provider timeout |

---

### POST /api/agent-tasks/[id]/approve

Mark a task as approved.

**Request:**
```json
{
  "reviewerNotes": "Looks good"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-orchestrator-1721345678",
    "approvalStatus": "approved",
    ...
  }
}
```

---

### POST /api/agent-tasks/[id]/reject

Mark a task as rejected.

**Request:**
```json
{
  "reviewerNotes": "Need more detail"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-orchestrator-1721345678",
    "approvalStatus": "rejected",
    ...
  }
}
```

---

### POST /api/agent-tasks/[id]/request-revision

Request revision of a task.

**Request:**
```json
{
  "reviewerNotes": "Please revise and resubmit"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "task-orchestrator-1721345678",
    "approvalStatus": "revision_requested",
    ...
  }
}
```

---

## Slice 3 API Response Format

All API responses follow a consistent success/error shape:

**Success:**
```json
{
  "success": true,
  "data": {}
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "fieldErrors": [
      { "path": "field", "message": "Validation error" }
    ]
  }
}
```

---

## Slice 4: Approval UI

Approval UI is implemented in the AI Workforce dashboard. Users can:
- Review pending agent tasks
- Approve tasks
- Reject tasks with feedback
- Request revisions

Approval actions are available through the task detail panel when `approvalStatus === "pending"`.

---

## Slice 5: Engagement Workspace Agent Panel

The Agent Tasks panel appears inside the engagement workspace alongside executive brief,
supporting analysis, department work product, and evidence sections.

### Engagement-Linked Task Creation

From the engagement workspace, users can create agent tasks that are automatically linked
to the current engagement by `engagementId`. The task creation form:
- Pre-populates the engagement context (name, objective)
- Requires agent selection
- Requires task title and objective
- Supports optional instructions and priority
- Uses the engagement's default provider (mock or xAI)

### Engagement Task List

Tasks linked to an engagement via `engagementId` appear in the panel. The list shows:
- Task title
- Agent name and role
- Status (queued, running, completed, failed)
- Approval status (pending, approved, rejected, revision_requested, not_required)
- Created timestamp
- Completed timestamp (when present)

### Task Detail and Output Rendering

When a task is selected, the detail panel shows:
- Full task metadata (title, objective, instructions, provider, model)
- Token usage and estimated cost (when available)
- Status and approval state
- Structured output (rendered by agent type)
- Error messages (without stack traces or diagnostics)
- Run button (when status === "queued")
- Approval actions (when approvalStatus === "pending")

### Global and Engagement-Specific Compatibility

Tasks created inside an engagement appear in:
- The engagement workspace Agent Tasks panel
- The global AI Workforce dashboard
- Task listing API when filtered by engagementId

Tasks created globally with an `engagementId` appear in:
- The matching engagement workspace Agent Tasks panel
- The global AI Workforce dashboard

There is one shared task store (no duplication).

### Empty State Handling

When an engagement has no agent tasks:
- Display message: "No agent tasks have been created for this engagement yet."
- Display action button: "Create Agent Task"
- Clicking the button opens the task creation modal

### Unsafe Data Filtering

The engagement panel does not display:
- API keys or authorization headers
- Private system prompts
- Raw provider payloads or responses
- Stack traces or diagnostics
- Secrets or sensitive fields

All output is sanitized before rendering.

### Current Limitation

Workflow continuation after agent step approval is fully functional for configured
agent-step workflows. Automatic insertion of agent steps into every department
run is not yet implemented; departments remain deterministic. See "Workflow Pipeline
Continuation After Resume" below.

---

## Workflow Agent Step Support (Slice 6)

Agent steps can be executed as part of an engagement workflow, alongside existing
department execution.

### How It Works

An agent step is created via `executeWorkflowAgentStep()`:

```typescript
const entry = await executeWorkflowAgentStep({
  project,
  step: {
    agentId: "researcher",
    title: "Pre-workflow Research",
    objective: "Analyze market context",
    requiresApproval: true,
  },
  workflowRunId: "run-xxx",
  departmentId: "research",
});
```

The returned `WorkflowAgentAuditEntry` contains:
- `type: "agent"` — identifies it as an agent step in the audit trail
- `status` — `"waiting-for-approval"` | `"completed"` | `"failed"`
- `pauseStateId` — set when `status === "waiting-for-approval"`
- `agentId`, `taskId`, `title`, `startedAt`, `completedAt`, `provider`, `model`, `error`

### Engagement Linking

All workflow-created agent tasks have:
- `projectId = project.id`
- `engagementId = project.id`

This ensures they automatically appear in:
- The Engagement Agent Tasks panel (filtered by `engagementId`)
- The Global AI Workforce dashboard

No additional UI is required.

### Audit Trail

Agent steps are recorded in `project.audit.runs[]` alongside department runs:

```json
{
  "type": "agent",
  "department": "agent-step",
  "agentId": "researcher",
  "taskId": "task-researcher-1234567890",
  "title": "Pre-workflow Research",
  "status": "completed",
  "pauseStateId": null,
  "startedAt": "...",
  "completedAt": "..."
}
```

Unsafe fields are never written to the audit trail.

---

## Formal Workflow Step Model (Slice 7)

Three formal step types are defined in `services/workflow-step-schema.ts`:

| Type | Purpose |
|------|---------|
| `automation` | Deterministic department execution (existing PIPELINE) |
| `agent` | AI agent task with optional pre-execution approval gate |
| `human_approval` | Explicit human decision gate (defined but not yet wired) |

### Approval Pause Behavior

When `requiresApproval: true`:
1. `AgentTask` is created with `approvalStatus: "pending"`
2. Task is saved to `data/agent-tasks/`
3. A `PausedWorkflowState` record is saved to `data/workflow-pauses/`
4. `status: "waiting-for-approval"` is returned — **task does not execute**
5. Workflow must check `shouldPauseWorkflow(project)` and stop if gates exist

### Pause State Persistence

`PausedWorkflowState` persisted to `data/workflow-pauses/{pauseId}.json`:

```json
{
  "id": "pause-task-researcher-xxx",
  "workflowRunId": "run-xxx",
  "projectId": "ACME-123",
  "engagementId": "ACME-123",
  "currentStepId": "step-researcher",
  "pausedAt": "...",
  "agentTaskId": "task-researcher-xxx",
  "requiredApprovalTarget": "agent_task:task-researcher-xxx",
  "status": "waiting_for_approval",
  "pendingStepIds": ["publishing"],
  "completedStepIds": ["research"],
  "failedStepIds": []
}
```

### Resume After Approval

After the human approves via `POST /api/agent-tasks/[id]/approve`:

1. Call `POST /api/engagements/[id]/workflow/resume`
2. Route validates engagement + pause state + approval status
3. `resumeWorkflowAfterApproval()` executes the agent task
4. Task status → `"completed"`, `output` stored as JSON string
5. Pause state → `"resumed"`
6. If `pendingStepIds` non-empty, pipeline continuation is triggered (Slice 8)

### Resume UI

The **Resume Workflow** button appears in the Task Detail Panel when:
- `task.approvalStatus === "approved"`
- `task.hasPausedWorkflow === true`
- `task.engagementId` is present

Hidden for: `rejected`, `revision_requested`, `pending`, non-workflow tasks.

### Rejected/Revision Safety

- `rejected` → `resumeWorkflowAfterApproval()` returns `{ code: "approval_not_granted" }`
- `revision_requested` → same result
- Workflow does not continue, no fake success

---

## Workflow Pipeline Continuation After Resume (Slice 8)

After a paused agent step is approved and executed, the remaining workflow PIPELINE
departments can automatically continue.

### How It Works

1. `PausedWorkflowState.pendingStepIds` contains remaining PIPELINE department names
   (e.g., `["publishing"]`)
2. `resumeWorkflowAfterApproval()` calls `continueWorkflowAfterResume()` after marking
   the pause as resumed
3. `continueWorkflowAfterResume()` loads the project and calls `runExistingProject()`
   with `departmentsToRun` set to the remaining departments
4. Completed departments are skipped (checked via department output status)
5. Publishing deliverables are set when the `publishing` department runs
6. Workflow reaches `"needs-review"` or `"complete"` when all steps finish

### Continuation Modes

| Context | Behavior |
|---------|---------|
| Test path (invokeModel provided) | Synchronous, controllable by mock |
| Production path (no invokeModel) | Background fire-and-forget |

### PIPELINE Override

`runExistingProject()` now accepts `departmentsToRun: string[]`. When provided,
only those departments execute. Full PIPELINE runs by default (backward compatible).

```javascript
await runExistingProject(project, {
  skipRunStart: true,
  departmentsToRun: ["publishing"],
  invokeModel: mockFn,
});
```

### Failure Behavior

- If agent task execution fails → continuation does not start
- If a continued department fails → `failWorkflowRun()` sets `project.status = "failed"`
- If publishing validation fails → error thrown, project fails closed
- All failures return clear error codes (`continuation_failed`, etc.)

### Current Limitations

1. **`pendingStepIds` must be pre-populated**: When creating a pause state, callers must
   pass remaining PIPELINE departments. Nothing auto-detects them yet.
2. **No agent steps inside the PIPELINE loop**: Departments remain deterministic. Agent
   steps run before/after the PIPELINE, not as pipeline stages.
3. **No live progress streaming**: Continuation fires in background; no WebSocket/SSE
   update to the client when individual departments complete.

---

## What Is Implemented (Release Candidate)

| Capability | Status |
|-----------|--------|
| Agent definitions (researcher, QC, orchestrator) | ✅ Complete |
| Provider abstraction (xAI/Grok + mock) | ✅ Complete |
| Agent registry (definitions + instances) | ✅ Complete |
| Task persistence (file-based JSON) | ✅ Complete |
| Execution persistence + redaction | ✅ Complete |
| Executor lifecycle (execute, validate, persist) | ✅ Complete |
| Approval gates (pending/approved/rejected/revision) | ✅ Complete |
| Agent task API routes (CRUD + run + approve/reject/revision) | ✅ Complete |
| Global AI Workforce dashboard | ✅ Complete |
| Engagement Agent Tasks panel | ✅ Complete |
| Workflow agent step support | ✅ Complete |
| Formal workflow step model (automation/agent/human_approval) | ✅ Complete |
| Paused workflow state persistence | ✅ Complete |
| Resume-after-approval backend | ✅ Complete |
| Resume Workflow UI button | ✅ Complete |
| Pipeline continuation after resume | ✅ Complete |
| Unsafe data filtering (API, UI, audit) | ✅ Complete |
| Alpha workflow preserved (all 7 departments) | ✅ Complete |

## What Is Not Implemented

| Capability | Status | Notes |
|-----------|--------|-------|
| Agent steps inside the PIPELINE loop | ❌ Not yet | Departments remain deterministic |
| `human_approval` step type wired to workflow | ❌ Not yet | Schema defined; not wired |
| `post_execution` approval mode | ❌ Not yet | Only `pre_execution` is active |
| Parallel agent step execution | ❌ Not yet | All steps are sequential |
| Automatic `pendingStepIds` detection | ❌ Not yet | Callers must pass them |
| Live continuation progress (SSE/WebSocket) | ❌ Not yet | Fire-and-forget only |
| Pause state TTL / expiry enforcement | ❌ Not yet | Schema supports `"expired"` |
| Agent tool permissions enforcement | ❌ Not yet | `allowedTools` defined but unenforced |
| Agent cost accounting | ❌ Not yet | `estimatedCost` tracked but not enforced |
| Client portal / data room | ❌ Out of scope | Not planned for this branch |
| QuickBooks/external integrations | ❌ Out of scope | Not planned |
| Rate limiting | ❌ Out of scope | Document future need |

---

## Data Storage

All data is file-based JSON under `data/`:

| Directory | Contents |
|-----------|---------|
| `data/projects/` | Engagement/project JSON (includes `audit` field) |
| `data/clients/` | Client JSON |
| `data/agent-tasks/` | AgentTask JSON |
| `data/agent-executions/` | AgentExecution JSON (rawResponse redacted) |
| `data/workflow-pauses/` | PausedWorkflowState JSON |

No database, no migrations, no external state.

---

## Unsafe Data Filtering

The system enforces multiple layers of filtering:

### Layer 1 — Provider (execution store)
`AgentExecution.rawResponse` is stored but stripped from all API responses.

### Layer 2 — Agent registry
`getPublicMetadata()` and `listPublicMetadata()` omit `systemPrompt` and `outputSchema`.

### Layer 3 — Task detail API
`GET /api/agent-tasks/[id]` strips `systemPromptSnapshot`, `rawResponse`, and
`toolPermissionsSnapshot` from execution records before responding.

### Layer 4 — UI client
`sanitizeOutputForDisplay()` in `agent-task-client.ts` recursively removes:
`apiKey`, `authorization`, `debugPrompt`, `diagnosticTrace`, `password`,
`rawProviderPayload`, `rawProviderResponse`, `rawResponse`, `secret`, `stack`,
`stackTrace`, `systemPrompt`, `systemPromptSnapshot`, `token`

### Layer 5 — Audit trail
`WorkflowAgentAuditEntry` and `AgentAuditRunEntry` types only include safe fields.
No raw provider data, prompts, or secrets are in the type definition.

---

## System Principles

FullSendOS is the **orchestration layer**. It controls:
- state
- permissions
- evidence
- cost
- approval
- accountability

**Grok/xAI** is a provider, not the hosted agent platform. FullSendOS calls Grok as
a tool. Grok does not control FullSendOS.

**Agents** do the thinking work — analysis, structure, recommendations.

**Workflows** govern the process — sequencing, validation, deliverable contracts.

**Humans** authorize consequential actions — approvals, revisions, rejection.

Agents cannot bypass approvals, modify the workflow engine, or access unsafe data.

---

## Future Slices (Roadmap)

| Slice | Capability |
|-------|-----------|
| **Slice 9** | Integrate agent steps directly into the orchestrator PIPELINE |
| **Slice 10** | Live continuation progress (SSE/polling) |
| **Slice 11** | Agent tool permissions enforcement |
| **Slice 12** | Cost accounting and budget gates |
| **Slice 13** | Rate limiting and API security |
| **Slice 14** | Parallel agent step execution |

