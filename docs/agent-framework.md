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
registerAllAgents(registry); // registers orchestrator, researcher, quality-control

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

## Current Limitations

This covers foundation (Slice 1) and execution (Slice 2). The following are **not yet implemented**:

- API routes for agent tasks (`/api/agents/...`)
- Approval UI and review workflow
- Workflow integration (agents cannot yet be triggered by workflow steps)
- Tool permission enforcement at runtime (permissions are modelled, not enforced at the tool call level)
- Live usage tracking from provider responses (captured in AgentExecution but not yet extracted from NormalizedAIResponse)
- Exact cost accounting (estimatedCost is always null — pricing data not configured)
- Background/async task execution queue
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

## Future Slices

| Slice | Capability |
|-------|-----------|
| **Slice 3** | API routes — create, list, and retrieve agent tasks via REST (`/api/agents/tasks`) |
| **Slice 4** | Approval UI — review and action ApprovalGate records in the dashboard |
| **Slice 5** | Workflow integration — trigger agents from workflow department steps |
| **Slice 6** | Tool permissions — enforce allowedTools at execution time |
| **Slice 7** | Background queue — async task execution with progress streaming |
