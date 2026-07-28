# ALPHA-052-03 Agent-Task Mutation and Execution Controls Readiness Review

Date: 2026-07-28
Status: READINESS REVIEW COMPLETE (03A AND 03B IMPLEMENTED)
Scope: Planning and readiness analysis only for ALPHA-052-03

Update note:
- ALPHA-052-03A implementation is complete for POST /api/agent-tasks/[id]/run.
- ALPHA-052-03B implementation is complete for POST /api/agent-tasks/[id]/approve, /reject, and /request-revision.

## 1) Executive Summary

This readiness review covers exactly four candidate routes:
- POST /api/agent-tasks/[id]/run
- POST /api/agent-tasks/[id]/approve
- POST /api/agent-tasks/[id]/reject
- POST /api/agent-tasks/[id]/request-revision

Historical baseline at readiness-review time (before ALPHA-052-03A implementation):
- All four mutation and execution routes were unprotected in ALPHA-052 terms.
- None of the four routes enforced authenticated actor boundaries.
- Route behavior allowed direct or indirect workflow-impacting control without tenant authorization checks.

Current state (after ALPHA-052-03A / PR #45):
- `POST /api/agent-tasks/[id]/run` is implemented and protected.
- `POST /api/agent-tasks/[id]/approve`, `/reject`, and `/request-revision` are implemented and protected.

Primary readiness conclusion:
- ALPHA-052-03 is ready to implement as a governed hardening batch.
- Runtime hardening should be split into two PRs for safest rollout:
  1) execution control hardening for run
  2) review and approval control hardening for approve/reject/request-revision

## 2) Route Inventory

### POST /api/agent-tasks/[id]/run

- Full repository path:
  - app/api/agent-tasks/[id]/run/route.ts
- Historical protection status at readiness-review time:
  - NONE
- Historical handler flow before ALPHA-052-03A:
  1. Read task id from route params.
  2. Build provider registry (mock plus xai if configured).
  3. Construct AgentExecutor with global stores and registries.
  4. Execute task by id.
  5. Return mapped executor error or success payload.
- Historical request-body contract:
  - No route-level body schema. Request body is ignored.
- Resource lookup source:
  - AgentTaskStore via AgentExecutor.loadTask(id).
- Mutation or execution call:
  - executor.execute(id).
- Historical success responses:
  - HTTP 200 with success true and data containing task, execution, and output.
- Historical failure responses:
  - Executor-mapped statuses:
    - 404: agent_not_found, task_not_found, provider_not_found
    - 403: agent_disabled, approval_required, permission_denied
    - 409: task_already_running, task_already_completed
    - 422: invalid_task_input, output_parsing_failed, output_validation_failed
    - 503: provider_not_configured, missing_api_key
    - 502: provider_request_failed
    - 504: provider_timeout
  - Catch-all 500 included raw error.message via errorResponse.
- Historical tests:
  - services/agent-task-execution.test.ts validates executor-level duplicate-run, approval gating, and status behavior.
  - services/agent-api-routes.test.ts includes broad route-family coverage notes but mostly store and shape checks.
  - services/ai-workforce-ui.test.tsx verifies client endpoint invocation.
- Whether mutation or execution can occur more than once:
  - Yes, rerun is blocked only for status running and completed.
  - Failed and cancelled tasks can be executed again.
- Whether task state transitions were enforced at readiness-review time:
  - Partially in AgentExecutor only.
  - No route-level actor/state authorization.
- Whether workflow execution can be triggered indirectly:
  - Yes. This route directly executes tasks.
- Whether raw AI/provider output could be returned at readiness-review time:
  - Raw provider response field is not returned directly.
  - Route returns output object and execution internals.
- Whether diagnostic data was exposed at readiness-review time:
  - Yes. execution payload included systemPromptSnapshot and toolPermissionsSnapshot from executor record.
  - 500 path returned raw message text.

### POST /api/agent-tasks/[id]/approve

- Full repository path:
  - app/api/agent-tasks/[id]/approve/route.ts
- Current protection status:
  - NONE
- Current handler flow:
  1. Read task id from params.
  2. Parse body with optional reviewerNotes and reviewedBy.
  3. Load task by id.
  4. Overwrite approvalStatus to approved.
  5. Save task and return updated task.
- Current request-body contract:
  - reviewerNotes optional string.
  - reviewedBy optional string.
  - Unknown fields are ignored by default object parsing.
- Resource lookup source:
  - globalTaskStore.loadTask(id).
- Mutation call:
  - globalTaskStore.saveTask(updated).
- Current success responses:
  - HTTP 200 with full updated task object.
- Current failure responses:
  - 404 TASK_NOT_FOUND for missing task.
  - 422 VALIDATION_FAILED for schema failure.
  - 500 INTERNAL_ERROR with raw error.message.
- Current tests:
  - services/agent-api-routes.test.ts covers approvalStatus overwrite behavior at store level.
  - services/ai-workforce-ui.test.tsx and services/workflow-resume-ui.test.ts cover client endpoint wiring.
- Whether mutation can occur more than once:
  - Yes. Repeated approval simply rewrites approved with new updatedAt.
- Whether task state transitions are currently enforced:
  - No route-level transition guard. Approval can be set regardless of task status.
- Whether workflow execution can be triggered indirectly:
  - Yes. Setting approvalStatus to approved satisfies resume precondition in services/workflow-resume.ts.
- Whether raw AI/provider output can be returned:
  - Route returns full task object, which may contain output and structuredOutput from prior execution.
- Whether diagnostic data is exposed:
  - Potentially yes through returned task fields such as context, instructions, evidence, and error.

### POST /api/agent-tasks/[id]/reject

- Full repository path:
  - app/api/agent-tasks/[id]/reject/route.ts
- Current protection status:
  - NONE
- Current handler flow:
  1. Read id.
  2. Parse optional reviewerNotes and reviewedBy.
  3. Load task.
  4. Overwrite approvalStatus to rejected.
  5. Save and return full task.
- Current request-body contract:
  - reviewerNotes optional string.
  - reviewedBy optional string.
- Resource lookup source:
  - globalTaskStore.loadTask(id).
- Mutation call:
  - globalTaskStore.saveTask(updated).
- Current success responses:
  - HTTP 200 with full updated task object.
- Current failure responses:
  - 404 TASK_NOT_FOUND.
  - 422 VALIDATION_FAILED.
  - 500 INTERNAL_ERROR with raw error.message.
- Current tests:
  - services/agent-api-routes.test.ts store-level overwrite behavior.
  - services/ai-workforce-ui.test.tsx endpoint wiring.
- Whether mutation can occur more than once:
  - Yes. Repeated reject rewrites same state.
- Whether task state transitions are currently enforced:
  - No.
- Whether workflow execution can be triggered indirectly:
  - Indirectly blocks resume path because resume requires approved.
- Whether raw AI/provider output can be returned:
  - Yes, full task object may include existing outputs.
- Whether diagnostic data is exposed:
  - Potentially yes via task fields and 500 message.

### POST /api/agent-tasks/[id]/request-revision

- Full repository path:
  - app/api/agent-tasks/[id]/request-revision/route.ts
- Current protection status:
  - NONE
- Current handler flow:
  1. Read id.
  2. Parse optional reviewerNotes and reviewedBy.
  3. Load task.
  4. Overwrite approvalStatus to revision_requested.
  5. Save and return full task.
- Current request-body contract:
  - reviewerNotes optional string.
  - reviewedBy optional string.
- Resource lookup source:
  - globalTaskStore.loadTask(id).
- Mutation call:
  - globalTaskStore.saveTask(updated).
- Current success responses:
  - HTTP 200 with full updated task object.
- Current failure responses:
  - 404 TASK_NOT_FOUND.
  - 422 VALIDATION_FAILED.
  - 500 INTERNAL_ERROR with raw error.message.
- Current tests:
  - services/agent-api-routes.test.ts store-level overwrite behavior.
  - services/ai-workforce-ui.test.tsx endpoint wiring.
- Whether mutation can occur more than once:
  - Yes. Repeated revision request rewrites same state.
- Whether task state transitions are currently enforced:
  - No.
- Whether workflow execution can be triggered indirectly:
  - Indirectly blocks resume path because resume requires approved.
- Whether raw AI/provider output can be returned:
  - Yes, full task object may include existing outputs.
- Whether diagnostic data is exposed:
  - Potentially yes via task fields and 500 message.

## 3) Task Ownership Model

Canonical task shape comes from agents/types.ts AgentTaskSchema.

Field presence analysis:
- task ID: yes (id)
- projectId: optional nullable
- engagementId: optional nullable
- workflowRunId: optional nullable
- clientId: no first-class field on AgentTask
- assigned agent: yes (agentId)
- requesting agent: no dedicated field; only requestedBy optional string exists
- status: yes (status)
- approval state: yes (approvalStatus)
- execution state: yes via status and linked AgentExecution records
- createdBy or actor assignment: no dedicated createdBy or assignee field
- tenant ownership fields: indirect only via projectId or engagementId linking to projectStore clientId

Authoritative tenant relationship:
- Authoritative tenant should be resolved from stored project clientId in src/storage/projectStore.js.
- workflowRunId alone is not an authoritative tenant key in current repository model.
- dataRoomRetrieval.clientId exists, but it is task payload/config data and should not be treated as authoritative auth ownership.

Current repository-supported ownership resolution chain:
1. task.projectId if present -> load project -> use project.clientId.
2. else task.engagementId if present -> load project by engagement id pattern currently used in repo -> use project.clientId.
3. if both present -> load both and require same clientId.
4. if neither present and no trustworthy linked ownership -> treat as internal-only task with no client delegation.

## 4) Role Policy

### Operator assignment model determination

Result: OPERATOR ASSIGNMENT MODEL IS PARTIAL

Evidence summary:
- operator-to-client assignment: partial via actor.clientId claim semantics in existing security helpers.
- operator-to-project assignment: not present.
- operator-to-engagement assignment: not present.
- operator-to-task assignment: not present.
- execution permission field: not present on task, actor, or route.
- approval permission field: not present on task, actor, or route.

Risk interpretation:
- Current model does not reliably express task-scoped operator execution rights.
- Recommend deny-by-default for internal_operator in ALPHA-052-03 until explicit assignment and permission model exists.

### Recommended per-route role policy

POST /api/agent-tasks/[id]/run
- internal_admin: allow.
- internal_operator: deny by default in this batch unless robust assignment model is added in a separate approved requirement.
- client_user: deny.

POST /api/agent-tasks/[id]/approve
- internal_admin: allow.
- internal_operator: deny by default in this batch.
- client_user: deny.

POST /api/agent-tasks/[id]/reject
- internal_admin: allow.
- internal_operator: deny by default in this batch.
- client_user: deny.

POST /api/agent-tasks/[id]/request-revision
- internal_admin: allow.
- internal_operator: deny by default in this batch.
- client_user: deny.

Policy rationale:
- These are internal execution and orchestration controls, not client-facing review controls.
- Client user control of internal agent execution is out of scope for ALPHA-052-03 and unsafe without dedicated product policy.

## 5) Stored Ownership Chain

Target authorization chain for all four routes:
1. Authenticate actor with requireAuthenticatedActor.
2. Load task by id from store.
3. Resolve linked ownership from stored references only:
   - projectId and or engagementId -> projectStore -> clientId.
4. Validate ownership integrity:
   - if both projectId and engagementId exist, require resolved clientIds to match.
   - if linked project missing or clientId missing, fail closed.
5. Apply route action role policy.
6. Apply state-transition guard that preserves existing product behavior where explicitly defined.
7. Execute mutation or execution action.
8. Record allow or deny audit event.
9. Return safe response body with generic security errors.

Hidden-resource behavior recommendation:
- client_user is denied for these routes; client-facing concealment is optional by policy and can remain strict forbidden since routes are internal-only controls.
- unknown task ids should not leak tenant context; return generic not found shape.

## 6) State-Transition Findings

### Current explicit rules in repository

run action:
- Enforced in AgentExecutor.
- Denies when task status is running (409) or completed (409).
- Denies when approvalStatus is pending (403).
- If agent definition requires approval and approvalStatus is rejected or revision_requested, sets status waiting_for_approval and returns approval_required.
- Does not block rerun for failed or cancelled statuses.

approve action:
- No status precondition checks.
- Always writes approvalStatus approved.

reject action:
- No status precondition checks.
- Always writes approvalStatus rejected.

request-revision action:
- No status precondition checks.
- Always writes approvalStatus revision_requested.

### Repeated action and conflicting transition behavior

- Repeated approve, reject, and request-revision calls are accepted.
- Conflicting transitions are possible because any action can overwrite prior approvalStatus.
- Approval can be written before or after execution completion because there are no state guards.

### Batch boundary recommendation

- ALPHA-052-03 should avoid introducing a new product state machine unless there is explicit approved product requirement.
- Security batch should enforce actor and ownership before existing mutations.
- If transition tightening is needed beyond current behavior, track as separate product-contract requirement.

## 7) Threat Model

Evaluated scenarios and findings:

1. Client A acts on Client B task
- Current: possible due to no auth.
- Required hardening: deny client users globally for these controls.

2. Caller guesses task id
- Current: task can be loaded and mutated or executed.
- Required hardening: authenticated actor gate plus ownership policy and safe not-found handling.

3. Client user triggers internal task execution
- Current: possible.
- Required hardening: client_user deny.

4. Client user approves internal-only output
- Current: possible.
- Required hardening: client_user deny.

5. Internal operator acts across clients
- Current: possible due to no auth gate.
- Required hardening: deny by default pending assignment model.

6. Body-supplied projectId or clientId overrides stored ownership
- Current: no ownership fields consumed in these bodies, so override is not currently applied.
- Required hardening: keep ownership derived strictly from stored task and linked project records.

7. Task links to missing project or engagement
- Current: run may still execute depending on path; approval routes do not verify links.
- Required hardening: fail closed before action when ownership cannot be resolved for tenant-scoped access decisions.

8. Task links to mismatched project and engagement
- Current: no mismatch validation.
- Required hardening: validate both references resolve to same client when both present.

9. Replayed run request triggers duplicate execution
- Current: blocked only for running and completed by executor.
- Residual: failed or cancelled can rerun.

10. Approval or rejection occurs before task completion
- Current: allowed by design today.
- Recommendation: preserve unless changed by explicit product requirement.

11. Request-revision exposes raw prompts or provider output
- Current: route returns full task object and may expose stored outputs or context.
- Required hardening: return route-specific safe payload shape.

12. Audit sink failure changes execution result
- Current for these routes: no security audit integration yet.
- Required hardening: use best-effort audit pattern from route-guards.

13. Raw diagnostics leak in error responses
- Current: 500 paths include raw error.message and run success returns execution internals.
- Required hardening: generic security errors and minimized success payload.

## 8) Shared Helper Design

Narrow helper is justified.

Proposed new helper path:
- lib/security/agent-task-authorization.ts

Proposed signatures:

- resolveAgentTaskOwnership(input: { task: AgentTask }): Promise<{
    ownerClientId: string | null;
    ownershipSource: "project" | "engagement" | "project_and_engagement" | "none";
    projectId: string | null;
    engagementId: string | null;
  }>;

- requireAgentTaskActionAccess(input: {
    actor: AuthenticatedActor;
    action: "agent_task_run" | "agent_task_approve" | "agent_task_reject" | "agent_task_request_revision";
    task: AgentTask;
    ownership: {
      ownerClientId: string | null;
      ownershipSource: "project" | "engagement" | "project_and_engagement" | "none";
    };
  }): void;

- optional façade for route use:
  - authorizeAgentTaskAction(input): Promise<{ task: AgentTask; ownership: ... }>;

Design requirements:
- reuse canonical actor types.
- reuse security-response throw helpers.
- resolve ownership from stored links only.
- fail closed if ownership cannot be resolved for non-admin paths.
- distinguish action type for future policy extensions.
- avoid embedding new workflow state rules.
- avoid logging sensitive payloads.

## 9) Test Matrix

Required route tests for each of run, approve, reject, request-revision.

### Authentication
- Missing identity -> 401.
- Malformed identity -> 401.

### Role policy
- internal_admin allowed where action is permitted.
- internal_operator denied by default in ALPHA-052-03.
- client_user denied.

### Ownership
- Own-client task case for internal-admin path (allowed, no regression).
- Cross-client task (deny for non-admin future paths; concealed behavior as policy dictates).
- Unscoped internal-only task (deny for client_user and operator; admin behavior explicit).
- Unknown task id (safe 404 style response).
- Missing linked project or engagement (fail closed).
- Mismatched project and engagement ownership (fail closed).

### Mutation safety
- Denied action causes no mutation.
- Repeated action preserves current behavior unless explicitly forbidden by existing contract.
- Invalid body behavior preserved.
- Execution does not start before authorization on run.
- Approval, rejection, revision do not occur before authorization.

### Audit and leakage
- Allow and deny events recorded.
- Audit sink failure preserves route outcome.
- Tokens, headers, task payloads, prompts, provider output, and revision text are absent from audit events.
- Error responses remain generic.

### Route-specific
- run:
  - existing duplicate-run protections preserved.
  - approval_required and task_already_completed/running semantics preserved.
- approve:
  - approvalStatus overwrite behavior preserved.
- reject:
  - rejection overwrite behavior preserved.
- request-revision:
  - revision overwrite behavior preserved.

## 10) PR-Splitting Recommendation

Recommended structure: split into two PRs.

PR A: Execution control hardening
- Route: POST /api/agent-tasks/[id]/run
- Scope:
  - authentication and authorization
  - ownership resolution
  - security audit integration
  - safe response redaction for execution payload
- Reason:
  - highest runtime risk and direct execution impact.

PR B: Review and approval control hardening
- Routes: approve, reject, request-revision
- Scope:
  - authentication and authorization
  - ownership resolution
  - security audit integration
  - safe response shapes and generic errors
  - preserve current approvalStatus overwrite semantics unless product changes are separately approved
- Reason:
  - shared mutation shape and lower execution complexity than run.

If governance requires a single batch PR, keep the same internal sequencing and land run safeguards first within the PR.

## 11) Acceptance Criteria

ALPHA-052-03 implementation may be accepted only when all are true:
1. All four candidate routes enforce authenticated actor boundaries.
2. Route access is deny-by-default for client_user on internal agent-task controls.
3. internal_operator policy is deny-by-default unless and until approved assignment model is implemented.
4. Ownership resolution uses stored task links and stored project clientId, never body-supplied ownership claims.
5. Missing or mismatched ownership links fail closed.
6. Existing run state protections remain intact unless explicitly changed by approved product requirement.
7. Approval, reject, and revision endpoints preserve current business behavior where not explicitly changed.
8. Audit events are best-effort and do not alter route outcomes.
9. Responses do not expose raw provider output, prompts, tokens, or diagnostic internals.
10. Security regression tests for all matrix categories pass.

## 12) Open Questions

1. Should operator scope evolve to explicit assignment records (client, project, engagement, task), and which table or store is the source of truth?
2. Should approval actions require task status waiting_for_approval only, or should current overwrite behavior remain as product contract?
3. Should workflowRunId be treated as ownership-resolvable in this batch, and if so what authoritative resolver should be used?
4. Should approve, reject, and request-revision responses return reduced safe task projection rather than full task objects?
5. Should unknown or unauthorized task ids be concealed as 404 uniformly for all non-admin actors?

## 13) Recommended Implementation Scope

ALPHA-052-03 is READY for implementation with the following boundaries:
- Implement only route authn/authz hardening, ownership resolution, audit hooks, and safe response shaping.
- Do not introduce new product state-machine transitions without explicit approved requirement.
- Keep runtime behavior compatible for existing transition semantics unless security policy requires deny-before-mutate ordering.

Recommended complexity:
- Medium overall.
- Run route has highest risk and should be implemented first.

Expected net-new test volume:
- Approximately 20 to 32 targeted security and behavior tests across four routes, plus helper-focused regressions.
