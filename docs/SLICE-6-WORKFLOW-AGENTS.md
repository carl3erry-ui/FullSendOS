# Slice 6: Workflow Agent Step Integration

## Overview

Slice 6 enables the existing FullSendOS workflow engine to create and run agent tasks as workflow steps while keeping the workflow engine in control. This slice bridges the Agent Framework (Slices 1-4) with the Workflow Engine, allowing agents to participate in engagement workflows without replacing the deterministic department-based execution model.

## Status

**Completed**: Steps 1-3 of 10-step implementation plan
- ✅ Workflow agent executor service created (`services/workflow-agent-executor.ts`)
- ✅ Comprehensive test suite (`services/workflow-agent-executor.test.ts`)
- ✅ Audit recording utilities (`services/workflow-audit-recorder.ts`)
- ✅ Orchestrator integration examples (`services/orchestrator-agent-integration-example.ts`)
- ✅ Extended test suite for audit and orchestration (`services/workflow-audit-and-orchestration.test.ts`)
- ✅ 183 total tests passing (8 new executor + 11 audit/orchestration tests)
- ✅ Build and TypeScript validation passing

**Pending**: Steps 4-10 (approval workflow documentation, orchestrator.js integration)

## Architecture

### Workflow Agent Step Execution

```typescript
// Define an agent step in workflow
const step: WorkflowAgentStepConfig = {
  agentId: "researcher",
  title: "Market Research",
  objective: "Analyze market opportunities",
  requiresApproval: false,
  provider: "mock", // or "xai"
};

// Execute within workflow
const entry = await executeWorkflowAgentStep({
  project,
  step,
  workflowRunId: "run-123", // Link to workflow run
  departmentId: "research", // Link to department context
});

// Record in audit trail
const updated = recordAgentStepInAudit(project, entry);
```

### Workflow Step Types

Three types of workflow steps are supported:

1. **Automation Steps** (`requiresApproval: false`)
   - Execute immediately when called
   - Return completion status or failure
   - Suitable for advisory/analysis tasks

2. **Approval Gate Steps** (`requiresApproval: true`)
   - Create task with `approvalStatus: "pending"`
   - Return `status: "waiting-for-approval"`
   - Workflow pauses until human approval
   - Task executes after approval completes

3. **Human Approval Steps**
   - Triggered via existing approval workflow in `/api/agent-tasks/[id]/approve` route
   - Completes task execution
   - Workflow resumes after completion

### Approval Gate Behavior

```typescript
// Check if workflow should pause
if (shouldPauseWorkflow(project)) {
  console.log("Workflow paused - awaiting approval");
  // Save project state, return 202 Accepted
  return { status: 202, message: "Workflow paused pending approval" };
}
```

### Audit Trail Recording

Agent steps are recorded in `project.audit.runs[]` alongside department execution:

```typescript
// Audit entry for agent step
{
  type: "agent",
  department: "agent-step",
  agentId: "researcher",
  taskId: "task-researcher-1234567890",
  title: "Market Research",
  status: "completed",  // or "waiting-for-approval", "failed", "running"
  startedAt: "2024-01-01T12:00:00Z",
  completedAt: "2024-01-01T12:05:00Z",
  provider: "mock",
  model: "mock-1.0",
  // error field populated only on failure
}
```

### Engagement Panel Integration

Agent tasks created by workflow steps automatically appear in the **Engagement Agent Tasks Panel** because:

1. `executeWorkflowAgentStep()` creates AgentTask with:
   - `engagementId = project.id` (same as current engagement)
   - `projectId = project.id` (links to project)

2. Engagement panel filters tasks by `engagementId`:
   - Query: `GET /api/agent-tasks?engagementId={projectId}`
   - Automatically includes workflow-created tasks
   - No additional UI changes needed

### Output Safety

All agent step outputs are sanitized before audit recording:

- Unsafe keys removed: `apiKey`, `authorization`, `password`, `secret`, `token`, `rawProviderPayload`, `systemPrompt`, `diagnosticTrace`, `stackTrace`
- JSON stringified for storage in `AgentTask.output` field
- Used for compliance and audit trail purposes

## Usage Examples

### Example 1: Optional Research Advisor Step

```typescript
import { tryResearchAdvisorStep } from "./services/orchestrator-agent-integration-example";

// In orchestrator.js main loop, before strategy department:
const { project: updated, stepExecuted } = await tryResearchAdvisorStep(project, {
  enabled: features.researchAdvisor,
  requiresApproval: false,
});

project = updated;

if (shouldPauseWorkflow(project)) {
  // Workflow paused - wait for human approval
  return { status: 202, message: "Awaiting approval" };
}
```

### Example 2: QC Review After Research

```typescript
import { tryQualityControlReviewStep } from "./services/orchestrator-agent-integration-example";

// After research department completes:
const { project: updated } = await tryQualityControlReviewStep(project, {
  enabled: config.enableQCReview,
  requiresApproval: config.requireQCApproval,
});

project = updated;

// Check for approval gates before continuing
if (shouldPauseWorkflow(project)) {
  console.log("workflow-progress awaiting-approval-gate");
  break; // Pause workflow
}
```

### Example 3: Checking Approval Status

```typescript
import { getAgentStepsByStatus, getAgentStepsFromAudit } from "./services/workflow-audit-recorder";

// Get all agent steps in workflow
const allSteps = getAgentStepsFromAudit(project);
console.log(`Executed ${allSteps.length} agent steps`);

// Get steps awaiting approval
const pending = getAgentStepsByStatus(project, "waiting-for-approval");
if (pending.length > 0) {
  console.log(`${pending.length} steps awaiting approval`);
}

// Get failed steps
const failed = getAgentStepsByStatus(project, "failed");
if (failed.length > 0) {
  failed.forEach(step => console.log(`Failed: ${step.title} - ${step.error}`));
}
```

## Integration Points

### Not Yet Integrated

The following integration points require implementation:

1. **Orchestrator.js Main Loop** (`src/orchestrator/orchestrator.js`)
   - Add conditional agent steps before/after departments
   - Check approval gates before continuing

2. **Workflow Run Routes** (`app/api/engagements/[id]/run/route.ts`)
   - Handle 202 response for approval-pending workflows
   - Pause polling until approval completes

3. **Approval Workflow** (existing `/api/agent-tasks/[id]/approve` route)
   - After task approval, resume paused workflow
   - Trigger via webhook or background task

### Already Integrated

- ✅ Agent Task Execution (`AgentExecutor` with full registry support)
- ✅ Engagement Panel Display (via `engagementId` linking)
- ✅ Approval Gates (via `AgentTask.approvalStatus` field)
- ✅ Audit Trail (via `project.audit.runs` extension)
- ✅ Output Safety (sanitization before storage)

## API Reference

### executeWorkflowAgentStep

Executes an agent as a workflow step.

```typescript
interface WorkflowAgentStepConfig {
  agentId: string;           // Must be registered and enabled
  title: string;             // Display name for workflow audit
  objective: string;         // Agent task objective
  instructions?: string;     // Optional additional context
  requiresApproval?: boolean; // If true, pauses workflow
  provider?: string;         // "xai" or "mock", defaults to agent default
  model?: string;            // Model name, defaults to agent default
}

interface WorkflowAgentAuditEntry {
  type: "agent";
  agentId: string;
  taskId: string;
  title: string;
  status: "running" | "completed" | "failed" | "waiting-for-approval";
  startedAt: string;
  completedAt?: string;
  provider?: string;
  model?: string;
  error?: string;
}

async function executeWorkflowAgentStep(options: {
  project: Project;
  step: WorkflowAgentStepConfig;
  workflowRunId?: string;   // Optional: links to workflow run
  departmentId?: string;    // Optional: links to department context
}): Promise<WorkflowAgentAuditEntry>
```

### recordAgentStepInAudit

Records agent step execution in project audit trail.

```typescript
function recordAgentStepInAudit(
  project: Project,
  entry: WorkflowAgentAuditEntry,
): Project
// Returns: project with entry added to project.audit.runs[]
```

### Audit Utilities

```typescript
// Get all agent steps from audit trail
function getAgentStepsFromAudit(project: Project): AgentAuditRunEntry[]

// Get agent steps by status
function getAgentStepsByStatus(
  project: Project,
  status: "running" | "completed" | "failed" | "waiting-for-approval",
): AgentAuditRunEntry[]

// Should workflow pause for approval gates?
function shouldPauseWorkflow(project: Project): boolean

// Are there approval gates in audit trail?
function hasApprovalGates(project: Project): boolean
```

## Test Coverage

### Workflow Agent Executor Tests
- ✅ Task creation with project linking
- ✅ Approval gate behavior (creates pending status)
- ✅ Disabled agent error handling
- ✅ Unknown agent error clarity
- ✅ Mock provider execution
- ✅ WorkflowRunId linking
- ✅ DepartmentId linking
- ✅ Unsafe data filtering in audit entries

### Audit Recording Tests
- ✅ Recording entries to audit trail
- ✅ Filtering by type and status
- ✅ Pause gate detection

### Orchestration Pattern Tests
- ✅ Research advisor step execution
- ✅ QC review step execution
- ✅ Multiple steps in sequence
- ✅ Approval gate detection

**Total: 183 tests passing** (164 original + 19 new for Slice 6)

## Limitations & Future Work

### Current Limitations

1. **No workflow suspension** - Approval gates return status but don't natively suspend workflow
   - Workaround: Check `shouldPauseWorkflow()` and return early
   - Future: Implement checkpoint-based suspension in orchestrator

2. **Linear execution only** - Steps execute sequentially
   - No parallel agent steps yet
   - Future: Add task dependencies and execution graph

3. **No automatic retry** - Failed steps don't automatically retry
   - Workaround: Manually re-run workflow
   - Future: Add exponential backoff retry logic

### Next Steps (Slice 7+)

1. Integrate into orchestrator.js main loop
2. Add workflow suspension/resume capability
3. Implement approval workflow completion triggers
4. Add agent-driven workflow branching (agents suggest next steps)
5. Create workflow visualization showing agent steps
6. Add cost tracking for workflow agent usage

## Migration Guide

For existing workflows, agent steps are **opt-in**:

1. No changes to existing department workflow
2. Add agent steps conditionally via feature flags
3. Existing workflows continue working unchanged
4. Can gradually introduce agent steps to existing engagements

Example safe migration:

```typescript
// Existing workflow continues unchanged
for (const dept of PIPELINE) {
  await runDepartment(project, dept);
}

// Optionally add new research advisor step (feature-flagged)
if (config.features.researchAdvisor) {
  const { project: updated } = await tryResearchAdvisorStep(project, {
    enabled: true,
  });
  project = updated;
}

// All other workflow continues unchanged
```

## See Also

- [Agent Framework Documentation](./agent-framework.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design overview
- [Services Workflow Agent Executor](../services/workflow-agent-executor.ts)
- [Services Workflow Audit Recorder](../services/workflow-audit-recorder.ts)
- [Services Orchestrator Integration Example](../services/orchestrator-agent-integration-example.ts)
