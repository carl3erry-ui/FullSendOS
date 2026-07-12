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

This is the foundation slice. The following are **not yet implemented**:

- Agent task persistence (no database or file store for tasks)
- Agent executor service (no background queue or task runner)
- API routes for agent tasks (`/api/agents/...`)
- Approval UI and review workflow
- Workflow integration (agents cannot yet be triggered by workflow steps)
- Tool permission enforcement at runtime
- Cost tracking and budget limits
- Retry and timeout handling in the executor

---

## Future Slices

| Slice | Capability |
|-------|-----------|
| **Slice 2** | Agent task persistence — store and retrieve AgentTask records |
| **Slice 3** | Agent executor — run tasks against providers, store AgentExecution records |
| **Slice 4** | API routes — create, list, and retrieve agent tasks via REST |
| **Slice 5** | Approval UI — review and action ApprovalGate records in the dashboard |
| **Slice 6** | Workflow integration — trigger agents from workflow department steps |
| **Slice 7** | Tool permissions — enforce allowedTools at execution time |
| **Slice 8** | Background queue — async task execution with progress streaming |
