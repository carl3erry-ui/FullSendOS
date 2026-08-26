# ALPHA-052 B3B Workflow Resume Transaction-Boundary Design

Date: 2026-08-26
Status: DESIGN RESOLUTION COMPLETE; B3B IMPLEMENTED / TESTED — AWAITING REVIEW
Starting main commit: `a5b4ef1ad0b9628ddffcbadd054b94225e5eddd5`
Route: `POST /api/engagements/[id]/workflow/resume`

PMO deployment/persistence resolution (2026-08-26):

- ADR-004 in `docs/DECISIONS.md` approves the current file-backed Alpha only as one serving instance using a persistent durable filesystem.
- Multi-instance serving is prohibited while filesystem-backed state and claims are used.
- B3B design is APPROVED; replacement implementation evidence is recorded below as IMPLEMENTED / TESTED — AWAITING REVIEW.
- PR #48 (`feature/alpha-052-b3b-workflow-resume-security`, head `a172070bbbe58dd3acc12e1fdd2b93c1a53659dc`) is SUPERSEDED — UNMERGED and must not merge.
- Replacement B3B implementation must start from clean `main` and implement this durable resume-operation lifecycle.
- Automatic lease expiry, takeover, ambiguous retry, task/provider/tool re-execution, continuation replay, new public pause states, and mutating recovery endpoints remain not approved.

Replacement implementation evidence (2026-08-26):

- Branch: `feature/alpha-052-b3b-workflow-resume-security-v2`, built fresh from governed `main` commit `38e0f5811ca40757ffb633df28d544862c1b1a4b`; no PR #48 commits were cherry-picked.
- Durable records are retained under `data/workflow-resume-operations` in the ADR-004 persistent file-backed state model; test-only overrides use isolated directories.
- Implemented phases: `claimed`, `execution_committed`, `task_completed`, `pause_finalized`, `continuation_committed`, `completed`, `failed`, and `recovery_required`.
- External execution is entered only after durable `execution_committed`; pre-execution release is claim-fenced and only valid from `claimed`; post-commit exceptions retain recovery evidence and never auto-replay task/provider/tool/continuation work.
- Pause finalization and every operation phase update verify claim ID and expected phase. Completed, failed, and recovery-required records are retained; no deletion/retention subsystem is introduced. Retention policy is follow-up technical debt.
- Production execution-capable caller review: the secured resume API route is the only non-test caller of `resumeWorkflowAfterApproval`; all execution-capable production entry is bounded by authn/authz/linkage checks.
- Validation: TypeScript 0 errors; focused B3B 82/82; claim/concurrency 7/7; security 73/73; full 663/663; build PASS with 10 warnings.
- This evidence is awaiting focused security/transaction review. It is not accepted, merged, released, or production-ready. B3C remains NOT STARTED.

## 1. Executive Summary

The merged resume path is not safe against concurrent replay. Two requests can both read the same pause as `waiting_for_approval`, both read the linked task as approved and queued, and both enter `AgentExecutor.execute`. The executor's duplicate check is also read-before-write, so both requests can pass it before either persists `running`. Both may create execution records, invoke providers or tools, persist output, and, in the worst interleaving, launch continuation.

B3B must establish a durable, cross-process claim before any task execution, provider call, tool call, data-room retrieval, cost-incurring work, or workflow continuation. A process-local mutex is insufficient.

Persistence decision: **CURRENT PAUSE STORE REQUIRES NARROW EXTENSION**.

The recommended Alpha design is a durable resume-operation sidecar record created with filesystem exclusive-create semantics (`open(..., "wx")` or equivalent) on the same shared volume as pause data. The operation contains a random `claimId` and recovery phases. The pause's existing public status model remains unchanged; no `resuming` or `resume_failed` pause status is required.

Core recovery rule:

- Before external execution starts, a failed claim owner may safely release the operation and leave the pause waiting.
- After execution may have started, never roll back to waiting and never automatically re-execute. Recover forward from persisted task/execution/project evidence or require controlled manual resolution.
- Continuation intent must be durably committed before launch and associated with the same claim. An ambiguous post-launch crash must not trigger automatic continuation replay.

This is the smallest design that provides cross-request and cross-process exclusion without introducing a database or distributed transaction system. It is safe across multiple processes only when they share the same filesystem and the filesystem honors atomic exclusive creation. Deployments with instance-local data directories cannot safely support B3B.

## 2. Current Resume Transaction

Current execution order on `main`:

1. Route extracts path `engagementId`.
2. Route parses JSON body before authentication; accepts optional `pauseStateId` and caller-controlled `resumedBy`.
3. Route loads a project by path engagement ID.
4. If `pauseStateId` is supplied, route loads that pause. Otherwise it scans pause files and chooses the newest waiting pause for the project.
5. Route applies a weak linkage check: it rejects only when both `pause.projectId !== project.id` and `pause.engagementId !== engagementId`. One matching link is currently sufficient.
6. Route calls `resumeWorkflowAfterApproval(pauseStateId, { resumedBy })`.
7. Service loads the pause again.
8. Service requires pause status `waiting_for_approval`.
9. Service requires `agentTaskId`.
10. Service loads the linked task.
11. Service requires task `approvalStatus === "approved"`.
12. Service constructs `AgentExecutor` and calls `execute(task.id)`.
13. Executor loads the task, resolves agent definition/instance, validates input and approval, and performs non-atomic duplicate checks against task status.
14. Executor resolves the provider and lists prior execution files to calculate the next attempt.
15. Executor persists a `running` execution record.
16. Executor persists task status `running`.
17. If configured, executor performs data-room retrieval and may persist retrieval audit/context.
18. Executor calls `agent.execute(task, provider)`, which may invoke a provider and permitted tools.
19. Executor persists completed or failed execution and task state.
20. Resume service builds an internal audit entry object.
21. On executor failure, service marks the pause `cancelled`, writes task failure, and returns an error result.
22. On success, service writes task status/output `completed` again.
23. Service calls `markPauseResumed`, which reloads the pause, verifies it is still waiting, and overwrites the pause file as `resumed`.
24. If pending steps exist, service invokes continuation synchronously in tests or launches it fire-and-forget in production.
25. Continuation reloads the pause, requires `resumed`, loads the project, may create an active project run, invokes remaining department providers, persists outputs/deliverables, and completes or fails the project.
26. Route maps service result codes to 404/409/422/500.
27. Route returns engagement ID, pause ID, task status, resumed timestamp, rich audit entry, and continuation details/reason.
28. Unexpected route errors return raw `error.message`.
29. No canonical security audit event is currently recorded.

First durable mutation: `AgentExecutor.execute` saves the running execution record before the pause is claimed.

First possible external/data access side effect: `retrieveDataRoomContext` when task retrieval is enabled.

First provider/tool side effect: `agent.execute(executionTask, provider)`. Tool invocation may occur inside the agent/provider execution boundary.

## 3. Race and Replay Timeline

Concrete two-request race:

| Time | Request A | Request B |
| --- | --- | --- |
| T1 | Reads pause as waiting | |
| T2 | | Reads same pause as waiting |
| T3 | Loads approved queued task | |
| T4 | | Loads same approved queued task |
| T5 | Executor duplicate check sees queued | |
| T6 | | Executor duplicate check can still see queued |
| T7 | Lists zero prior executions; chooses attempt 1 | |
| T8 | | May list zero prior executions; also chooses attempt 1 |
| T9 | Writes a running execution and task state | |
| T10 | | Writes another running execution/task state; IDs include time and can differ |
| T11 | Calls data retrieval/provider/tools | |
| T12 | | Calls data retrieval/provider/tools independently |
| T13 | Persists output/completion | |
| T14 | | Persists its output/completion, potentially overwriting task output |
| T15 | Reloads pause as waiting | |
| T16 | | May reload pause as waiting before A writes |
| T17 | Writes pause resumed | |
| T18 | | Can also write pause resumed if it read before T17 |
| T19 | Launches continuation | |
| T20 | | Can launch continuation too in the worst interleaving |

A less favorable interleaving for B causes `markPauseResumed` to observe A's resumed state and throw. B has still already executed the task/provider/tools and persisted output; the route then returns a raw 500. Therefore the current 409 replay guard occurs too late to prevent duplicate external work.

Possible final states include:

- two execution records for one task;
- task output from whichever request writes last;
- pause resumed once or overwritten twice;
- one request returning 200 and another returning 500 after duplicate execution;
- two continuations if both `markPauseResumed` calls read waiting before either write;
- partial project output from competing continuations;
- provider/tool cost incurred more than once.

## 4. Pause-Store Capability

Current backend: JSON files under `data/workflow-pauses`.

Current properties:

| Capability | Current state |
| --- | --- |
| Durable persistence | File-backed, subject to underlying volume durability |
| Read atomicity | A complete file is read, but concurrent plain writes may expose partial data |
| Write atomicity | No; pause writes call `writeFile` directly on the target path |
| Compare-and-set | None |
| Conditional status transition | Read then write only; race-prone |
| Locking | None |
| Transactions | None |
| Cross-resource transaction | None across pause/task/execution/project files |
| Process-local exclusion | None |
| Multi-process exclusion | None |
| Multi-instance exclusion | None unless a new shared-filesystem primitive is added |
| Crash recovery metadata | None |

JavaScript's event loop does not provide safety: filesystem awaits allow interleaving, Next.js may process requests concurrently, and multiple processes or instances do not share process memory.

The underlying Node filesystem API can provide atomic exclusive file creation. On a shared filesystem that honors `O_CREAT | O_EXCL`, creating a claim sidecar with `fs.open(path, "wx")` gives one winner across processes. This capability is not exposed by the current pause store and must be added narrowly.

Current pause `savePauseState` should also adopt temp-file-plus-rename for whole-file atomic replacement when B3B writes pause state. That improves write integrity but does not itself provide compare-and-set.

Deployment constraint: every instance that can serve resume must use the same durable pause/task/execution/project volume. Instance-local filesystems make any file-based claim unsafe across instances and block B3B deployment.

## 5. Proposed Claim Lifecycle

Do not add public pause statuses for B3B. Keep existing pause status values:

- `waiting_for_approval`
- `resumed`
- `expired`
- `cancelled`

Add a durable sidecar resume-operation record per pause:

```text
<pauseId>.resume-operation.json
```

Minimum metadata:

- schema version;
- `claimId` (random, unguessable operation/fencing token);
- pause ID;
- project ID;
- engagement ID;
- workflow run ID;
- agent task ID;
- authenticated actor ID and role;
- phase;
- claimed/updated timestamps;
- execution ID when known;
- non-sensitive failure/recovery code when needed.

Recommended internal phases:

1. `claimed`
2. `execution_committed`
3. `task_completed`
4. `pause_finalized`
5. `continuation_committed`
6. `completed`
7. `failed`
8. `recovery_required`

These are recovery metadata, not product workflow states.

Transition classifications:

| Transition | Classification |
| --- | --- |
| waiting pause + no operation -> operation `claimed` | SECURITY/RELIABILITY IMPLEMENTATION DETAIL |
| `claimed` -> `execution_committed` before executor call | SECURITY/RELIABILITY IMPLEMENTATION DETAIL |
| `execution_committed` -> `task_completed` | EXISTING SEMANTICS REPRESENTED EXPLICITLY |
| pause waiting -> resumed | EXISTING CONTRACT |
| `pause_finalized` -> `continuation_committed` | RELIABILITY IMPLEMENTATION DETAIL |
| operation -> `recovery_required` | RELIABILITY IMPLEMENTATION DETAIL |
| new pause status `resuming` or `resume_failed` | PRODUCT BEHAVIOR CHANGE; NOT REQUIRED |

Only the claim owner presenting the matching `claimId` may advance, complete, fail, or release the operation. Updates must validate an expected current phase and write atomically with temp-file-plus-rename.

A losing claimant receives the existing 409 conflict semantics and performs no lookup-dependent external work.

## 6. Authorization and Ownership Chain

Required chain:

1. Authenticate actor before body parsing or resource lookup.
2. Extract route engagement ID.
3. Load stored project by route ID.
4. Require non-empty stored `project.clientId`; it is the sole tenant authority.
5. Enforce `internal_admin` only.
6. Parse request body.
7. Load explicit stored pause or auto-discover the active pause for the stored project.
8. Require `pause.projectId === project.id`.
9. Require `pause.engagementId === project.id` under the existing project/engagement alias contract.
10. Require pause linked task ID and `requiredApprovalTarget === agent_task:<taskId>`.
11. Load stored task.
12. Require `task.projectId === project.id` and `task.engagementId === project.id`.
13. If task workflow run ID exists, require it to equal `pause.workflowRunId`.
14. Treat workflow run ID only as linkage evidence, never ownership proof.
15. Require pause waiting and task approved before claiming.
16. Re-read and revalidate pause/task after the atomic claim succeeds.

Fail closed with concealed 404 for missing or inconsistent resource linkage. Missing project ownership or prohibited roles return 403. Caller-supplied project, engagement, client, workflow-run, task, human-input, or attribution fields are never authoritative.

The current route is agent-task resume only. Do not invent a human-input fallback. A future human-input resume path must separately load and validate stored human-input client/engagement/run/task linkage.

## 7. Exact Transaction Ordering

The proposed order differs from the candidate order by validating safe preconditions before claim, then revalidating under claim, and by finalizing the pause before continuation because continuation currently requires pause status `resumed`.

1. Authenticate actor.
2. Extract route engagement ID.
3. Load stored project.
4. Resolve and require stored `project.clientId`.
5. Authorize admin-only `resume` action.
6. Parse/validate body.
7. Load or auto-discover stored pause.
8. Load stored task.
9. Validate all stored project/pause/task/run/approval-target linkage.
10. Validate pause waiting and task approved.
11. Atomically create the resume-operation claim. If it exists, return safe 409.
12. Re-read pause and task while holding the claim.
13. Revalidate linkage, waiting state, approval, and task state.
14. Persist operation phase `execution_committed` before calling executor.
15. Execute the approved task.
16. Persist/confirm task and execution result.
17. Persist operation phase `task_completed` with execution ID.
18. Finalize pause as resumed using claim ID ownership and expected waiting state.
19. Persist operation phase `pause_finalized`.
20. If pending steps exist, persist `continuation_committed` before invoking continuation.
21. Launch continuation at most once under the same claim/operation.
22. Persist `completed`, `failed`, or `recovery_required` metadata as appropriate.
23. Record best-effort security audit result.
24. Return a safe response.

The claim must remain effective through continuation handoff. It may not be deleted immediately after task execution.

Pre-execution validation failures can release the claim safely. Once phase `execution_committed` is durable, the operation must never be reset automatically to waiting.

## 8. Side-Effect Boundary

Resume can cause:

- execution-record creation;
- task status/output/error persistence;
- data-room retrieval and retrieval audit writes;
- provider calls;
- tool calls permitted to the agent;
- token/cost use;
- pause mutation;
- project active-run creation;
- department output and audit persistence;
- deliverable generation;
- workflow continuation and terminal project state.

No direct export generation or notification call is present in the current path. New agent tasks are not created by resume itself; it executes the already-linked task.

Central invariant:

> No external execution or irreversible side effect may occur until authentication, stored ownership resolution, authorization, strict linkage validation, resumability/approval checks, and durable atomic claim have all succeeded.

The invariant is achievable with a narrow shared-filesystem claim extension. It is not achievable with current pause-store methods or a process-local lock.

## 9. Failure Matrix

| Failure point | Stored pause | Task/execution | Workflow/project | External work | Retry/recovery |
| --- | --- | --- | --- | --- | --- |
| Claim creation loses race | waiting or later owner-controlled state | unchanged | unchanged | none | Return 409; no retry execution |
| Crash immediately after `claimed` | waiting + durable claim | unchanged | unchanged | none | Controlled release may be safe after evidence check; no blind timeout |
| Crash after `execution_committed`, before executor call | waiting + committed claim | possibly unchanged | unchanged | uncertain from metadata alone | No automatic re-execution; inspect task/execution evidence |
| Execution record write fails | waiting + claim | partial/none | unchanged | none yet | Mark recovery required; manual/forward resolution |
| Task `running` write fails after execution record | waiting + claim | running execution, old task | unchanged | none yet | Forward repair task state; do not invoke provider until repaired |
| Data-room retrieval fails | waiting + claim | task/execution may remain running | retrieval audit may exist | retrieval may have occurred | Mark failed/recovery required; no automatic provider retry |
| Provider/tool throws | waiting + claim | executor normally persists failed execution/task | unchanged | may have partial external effects | Preserve current failure/cancel semantics; no auto retry |
| Crash during provider/tool call | waiting + committed claim | running execution/task | unchanged | unknown/possibly complete | Recovery required; never auto re-execute |
| Provider succeeds, completion persistence fails | waiting + claim | running/partial despite external success | unchanged | completed externally | Recovery required; reuse evidence if available, never repeat call |
| Task completes, pause finalization fails | waiting + claim | completed task/execution | unchanged | task completed | Deterministic forward recovery: mark pause resumed, no re-execution |
| Pause resumed, continuation intent write fails | resumed + claim | completed | unchanged | task completed | Recovery required before continuation |
| Crash after `continuation_committed`, before launch | resumed + claim | completed | unchanged | continuation may not have started | Ambiguous; no automatic launch; controlled resolution |
| Continuation provider/tool fails | resumed + operation | completed | project normally failed/partial | partial continuation work | Preserve project failure; no automatic continuation retry |
| Pause/operation completion write fails after continuation | resumed or completed | completed | partial/terminal | continuation may be complete | Forward finalize from project/task evidence |
| Audit sink fails | normal business state | normal | normal | unchanged | Ignore for outcome; best-effort audit only |
| Network disconnect after successful execution | resumed/operation continuing | completed | continuation may run | completed | Client retry receives 409; server continues/recovery inspects operation |
| Server restart | depends on durable phase | persisted evidence survives | persisted evidence survives | phase-dependent | Recovery scanner/report identifies nonterminal operations; no blind replay |

## 10. Recovery Strategy

Use forward recovery, not general rollback.

Safe release to waiting is allowed only when all are true:

- operation phase is `claimed`;
- no execution record exists for the operation/task;
- task remains queued/waiting and unchanged;
- no continuation intent exists;
- an authorized recovery action verifies the original claimant is no longer active.

After `execution_committed`, rollback is prohibited because provider/tool effects may be irreversible or unknowable.

Forward-recovery rules:

- Completed execution/task + waiting pause: finalize pause resumed with the same claim ID.
- Failed execution/task: preserve current failure/cancel behavior and record safe failure code.
- Resumed pause + no pending continuation: mark operation completed.
- Resumed pause + committed continuation: inspect project run/departments and finish metadata without automatically invoking continuation again.
- Running/ambiguous execution: mark `recovery_required`; manual operator review is required.

Do not implement automatic lease expiration in B3B. A timeout cannot prove that a provider/tool action did not happen. Lease-based automatic takeover is future hardening and requires PMO approval plus external idempotency support.

A small read-only recovery report/list operation is recommended for operators. Any mutation/retry recovery endpoint is a separate governed change.

## 11. Idempotency Analysis

| Operation | Currently idempotent? | B3B treatment |
| --- | --- | --- |
| Agent task execution | No | Atomic claim prevents concurrent/retry invocation |
| Provider call | No guarantee | Never invoke before claim; never auto replay ambiguous operation |
| Tool call | No guarantee | Same as provider; future idempotency key where supported |
| Execution persistence | File overwrite per ID, but attempt creation is race-prone | Associate execution ID with claim; one claim owner creates it |
| Task result persistence | Last-write-wins, not transactionally idempotent | One claim owner; recover from completed task rather than re-execute |
| Pause finalization | Repeating resumed write is logically idempotent but current method rejects non-waiting | Claim-aware complete API returns existing completion to owner/recovery |
| Workflow continuation | Not fully idempotent; skips completed departments but can race | Commit one continuation intent under claim; at-most-once automatic launch |
| Project run creation | Duplicate guard exists but is not a cross-resource transaction | Invoke only under continuation operation; inspect project on recovery |

A resume operation/claim ID is required for fencing, phase updates, observability, and safe completion. It is not sufficient to make external providers/tools idempotent unless propagated and honored by those systems.

Provider/tool idempotency keys are future hardening. B3B safety must not depend on them.

## 12. Existing 409 Contract

Current 409 condition: `resumeWorkflowAfterApproval` returns `already_resumed` when the loaded pause status is not `waiting_for_approval`. The route maps that code to HTTP 409 and currently returns a raw reason containing pause ID and status.

Required outward contract:

- Already resumed pause: 409.
- Currently claimed/resuming pause: 409.
- Concurrent losing caller: 409.
- Cancelled/expired/non-resumable pause: 409 where existing semantics classify it as state conflict.
- Recoverable pre-execution claim failure after safe release: a later request may try again.
- `recovery_required`/ambiguous operation: 409 until controlled recovery resolves it.

Preserve status and conflict meaning. Standardize the body to a fixed safe message such as:

```json
{ "error": "Workflow cannot be resumed from its current state." }
```

This is a security redaction, not a product behavior change. The current UI only consumes an error message and does not depend on pause status internals.

Existing 409 preserved: **YES**.

## 13. Role Policy

| Role | Policy |
| --- | --- |
| `internal_admin` | Allow after stored ownership and linkage validation |
| `internal_operator` | Deny with 403; no reliable assignment model exists |
| `client_user` | Deny; human-input response rights do not imply orchestration rights |

Do not create an operator assignment model in B3B. Do not authorize from caller-provided `resumedBy`. Persist authenticated actor ID as resume attribution; accept the body field only for compatibility and ignore it as authority.

## 14. Response-Safety Requirements

Current exposure:

- success returns an internal `auditEntry` with agent/task/pause/run/step identifiers;
- continuation failures may return raw `reason` values containing IDs, pending steps, validation details, or provider errors;
- generic 500 returns raw `error.message`;
- 404 and 409 reasons expose pause/engagement identifiers and internal statuses;
- caller-controlled `resumedBy` is reflected in internal data.

Current UI requires only:

- `engagementId`;
- `pauseStateId`;
- `taskStatus`;
- `resumedAt`.

A continuation status is safe and useful but not required by the current typed UI result.

Recommended success:

```json
{
  "engagementId": "...",
  "pauseStateId": "...",
  "taskStatus": "completed",
  "resumedAt": "...",
  "continuation": { "status": "started_in_background" }
}
```

Recommended failures:

- 401 `{ "error": "Unauthorized." }`
- 403 `{ "error": "Forbidden." }`
- concealed 404 `{ "error": "Not found." }`
- 409 fixed state-conflict message
- 422 fixed approval-required message
- 400 fixed invalid-body message
- 500 fixed unexpected-resume message

Exclude task/provider output, prompts, workflow graph, pause record, human-input content, tool details, raw errors, stack traces, diagnostics, token/cost details, and secrets.

## 15. Audit and Recovery Observability

Security audit event:

- actor ID;
- actor role;
- action `workflow_resume`;
- resource type `workflow_pause`;
- pause/resource ID only after safe resolution;
- allow/deny;
- non-sensitive reason code.

Security audit must exclude headers, bearer tokens, body, prompts, human-input content, task/project payloads, provider/tool output, diagnostics, and secrets. Sink failure must not change 401, 403, 404, 409, 422, 400, successful 200, or execution/failure outcomes.

Recovery operation metadata is separate from security audit. Minimum durable evidence:

- claim ID and phase;
- pause/project/engagement/run/task IDs;
- actor ID/role;
- claimed/updated/completed timestamps;
- execution ID when known;
- continuation intent status;
- safe failure/recovery code.

Do not store prompts, task input/output, provider response, tool arguments/results, human-input content, tokens, cost details, headers, or raw exceptions in the operation record.

## 16. Test Matrix

Estimated focused B3B additions: 28-36 tests, preferably table-driven.

Authentication and roles:

- missing identity -> 401 before body/lookup;
- malformed identity -> 401;
- admin allowed;
- operator -> 403;
- client user -> 403.

Ownership and linkage:

- unknown project/pause/task;
- project without `clientId`;
- pause project mismatch;
- pause engagement mismatch;
- approval target/task mismatch;
- task project/engagement mismatch;
- task/pause workflow-run mismatch;
- caller project/engagement/client/run/task/resumedBy overrides ignored;
- auto-discovery still selects only the stored project's waiting pause.

Claim and concurrency:

- first request atomically claims;
- concurrent loser receives 409;
- exactly one execution record/provider invocation/tool invocation;
- sequential replay after success -> 409;
- active claim -> 409;
- non-owner cannot advance/release claim;
- claim revalidates pause/task after acquisition;
- pre-execution validation failure releases safely;
- no claim permits no execution.

Ordering and failure recovery:

- denied/linkage failure causes zero pause/task/execution/project mutation;
- execution starts only after claim phase is durable;
- task/provider/tool failure records safe failure and no continuation;
- simulated crash after claim leaves recoverable operation and no execution;
- simulated crash after execution intent never auto re-executes;
- completed task + waiting pause forward-finalizes without provider call;
- pause finalization failure preserves claim/recovery metadata;
- continuation failure preserves resumed pause and project failure evidence;
- ambiguous continuation never auto relaunches;
- client timeout/retry returns 409 and does not duplicate.

Audit and responses:

- allow/deny/conflict events;
- sink failure invariance for 401/403/404/409/422/400/200;
- sensitive marker exclusion;
- minimal success;
- sanitized 500;
- safe fixed 409/422.

Existing service, continuation, UI, executor, and full workflow tests must remain green.

## 17. Persistence Decision

**CURRENT PAUSE STORE REQUIRES NARROW EXTENSION**

Proposed APIs:

```ts
claimPauseForResume(input: {
  pauseId: string;
  actorId: string;
  actorRole: "internal_admin";
  expectedProjectId: string;
  expectedEngagementId: string;
  expectedWorkflowRunId: string;
  expectedTaskId: string;
}): Promise<
  | { ok: true; operation: ResumeOperation }
  | { ok: false; code: "not_found" | "not_resumable" | "already_claimed" }
>

advancePauseResumeClaim(input: {
  pauseId: string;
  claimId: string;
  expectedPhase: ResumeOperationPhase;
  nextPhase: ResumeOperationPhase;
  executionId?: string;
  reasonCode?: string;
}): Promise<ResumeOperation>

completePauseResume(input: {
  pauseId: string;
  claimId: string;
  resumedBy: string;
}): Promise<PausedWorkflowState>

releasePauseResumeClaim(input: {
  pauseId: string;
  claimId: string;
  reasonCode: string;
}): Promise<void>

loadPauseResumeOperation(pauseId: string): Promise<ResumeOperation | null>
```

Implementation constraints:

- claim operation file created with exclusive-create semantics;
- claim input revalidated against stored pause before success;
- claim ID required for every mutation;
- operation updates written atomically;
- pause updates written with temp+rename;
- `release` allowed only before `execution_committed`;
- no automatic lease expiry;
- shared durable filesystem required across serving instances.

## 18. Proposed Implementation Scope

Expected runtime files:

- `app/api/engagements/[id]/workflow/resume/route.ts`
- `services/workflow-resume.ts`
- `services/workflow-pause-store.ts`
- `services/workflow-step-schema.ts` only if a separate resume-operation schema is colocated there; a dedicated schema module is preferable
- `lib/security/workflow-authorization.ts`

Expected tests:

- new focused `services/workflow-resume-security.test.ts`
- existing `services/workflow-slice7.test.ts`
- existing `services/workflow-slice8.test.ts`
- existing `services/workflow-resume-ui.test.ts`
- security regression suite as needed

Expected documentation:

- route coverage matrix;
- route hardening plan;
- B3 readiness/design evidence;
- execution backlog/progress;
- traceability matrix after successful implementation gates.

Out of scope:

- abort/B3C;
- workflow run/start behavior;
- agent executor redesign;
- provider/tool implementation changes;
- distributed database/lock service;
- operator assignment model;
- client workflow control;
- human-input resume implementation;
- automatic lease takeover;
- automatic task re-execution;
- general continuation retry;
- production identity-provider integration;
- Issue #43 warnings.

## 19. PMO Decision Points

| Proposal | Classification | PMO decision |
| --- | --- | --- |
| Durable sidecar claim + claim ID | REQUIRED FOR SECURITY | Covered by approved B3B constraint; no product change |
| Internal resume-operation phases | REQUIRED FOR RELIABILITY | Governance review required, not user-facing |
| New pause status `resuming` | NOT REQUIRED / PRODUCT BEHAVIOR CHANGE | Do not implement without PMO approval |
| New pause status `resume_failed` | NOT REQUIRED / PRODUCT BEHAVIOR CHANGE | Do not implement without PMO approval |
| Safe fixed 409 body with same status/meaning | REQUIRED FOR SECURITY | No material product change; UI compatible |
| Actor-derived `resumedBy` | REQUIRED FOR SECURITY/AUDIT INTEGRITY | No product permission change |
| Automatic claim lease expiration | FUTURE HARDENING / PRODUCT BEHAVIOR CHANGE | PMO approval required |
| Automatic takeover/retry after ambiguous crash | PRODUCT BEHAVIOR CHANGE | PMO approval required; not B3B |
| Automatic task re-execution | PRODUCT BEHAVIOR CHANGE | Prohibited without PMO approval |
| Automatic continuation replay | PRODUCT BEHAVIOR CHANGE | Prohibited without PMO approval |
| Resume operation/idempotency key | REQUIRED FOR RELIABILITY | Required internally; external propagation future hardening |
| Provider/tool idempotency keys | FUTURE HARDENING | Not required for Alpha claim gate |
| Read-only stranded-operation report | REQUIRED FOR RELIABILITY | Can be implementation/support scope if metadata-only |
| Mutating recovery endpoint | PRODUCT BEHAVIOR CHANGE | Separate PMO-governed work |

No PMO product decision is required to implement the narrow claim, claim-aware forward completion, actor attribution, strict linkage, safe responses, and existing 409 semantics. PMO approval is required before leases, automatic takeover, automatic re-execution, new public pause statuses, or new retry behavior.

## 20. Final Recommendation

B3B implementation readiness: **READY**.

Proceed only with the narrow durable resume-operation extension described here. The implementation must demonstrate:

- one atomic winner across processes sharing the data volume;
- authorization and linkage before claim;
- revalidation under claim;
- no external side effect before durable execution intent;
- one provider/tool/task execution under concurrent requests;
- no automatic rollback/replay after execution may have started;
- deterministic forward completion from persisted task/execution evidence;
- controlled recovery-required handling for ambiguous crashes;
- existing 409/422/continuation product semantics;
- safe response/audit boundaries;
- complete concurrency and failure-injection tests.

Do not begin B3C. Do not merge an implementation until focused security review confirms the claim and crash-recovery boundaries.
