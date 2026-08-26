# ALPHA-052 B3 Workflow Control Readiness Review

Date: 2026-08-15
Status: READINESS REVIEW COMPLETE; B3A COMPLETE; B3B AND B3C NOT STARTED
Starting main commit: `6de324773b1ffd5187ed81f343f217983e17b748`
Scope: ALPHA-052-04 / B3 workflow mutation and execution controls

B3B design resolution (2026-08-26):
- Workflow resume transaction-boundary design is complete in `docs/alpha/security/ALPHA_052_B3B_RESUME_TRANSACTION_DESIGN.md`.
- Persistence decision: CURRENT PAUSE STORE REQUIRES NARROW EXTENSION.
- The approved design uses a durable exclusive resume-operation claim, revalidation under claim, no external execution before claim, and forward recovery after execution may have started.
- Automatic lease expiry, automatic task re-execution, automatic continuation replay, and new public pause states are not approved.
- B3B implementation remains NOT STARTED. Protected handlers remain 12 and remaining handlers remain 34.

Implementation update (2026-08-15):
- B3A protects `POST /api/projects/[id]/run` and its exact `POST /api/engagements/[id]/run` alias; PR #47 merged to `main` at `aab56e39f6905771f147494470418b72c36ce4f9`.
- Authentication, stored project `clientId` ownership, admin-only policy, concealed missing-resource handling, metadata-only audit, zero-side-effect denial, blocking-input redaction, and sanitized generic errors are implemented.
- Existing lifecycle, blocking-input, duplicate-run, stale recovery, asynchronous 202, and terminal/failed rerun semantics are preserved.
- Validation after focused-review remediation: TypeScript 0 errors; targeted workflow run tests 32/32; security tests 73/73; full tests 638/638; build pass with 10 warnings.
- Protected handlers: 12. Remaining handlers: 34. B3B resume and B3C abort remain untouched and NOT STARTED.

## 1. Executive Summary

B3 contains four public `POST` handlers backed by three materially different control paths:

1. `POST /api/projects/[id]/run` starts or restarts project workflow execution.
2. `POST /api/engagements/[id]/run` is an exact alias of the project run handler.
3. `POST /api/engagements/[id]/workflow/resume` executes an approved agent task and may continue provider-backed workflow work.
4. `POST /api/engagements/[id]/abort` records a failed run state but does not cancel in-flight provider or background work.

No public pause, retry, restart, cancel, or generic continue route exists. Restart and retry behavior currently occurs by calling a run route again. Agent-task approval and human-input mutations are not B3 routes: they were hardened in earlier batches and do not themselves invoke workflow continuation.

B3A now protects both run aliases. Abort still loads a stored project without authn/authz. Resume still parses caller input first, loads a project by the path engagement ID, and accepts a caller-supplied `pauseStateId`; its current linkage check uses an unsafe OR condition. B3B and B3C must address those separate paths without changing B3A behavior.

The authoritative tenant source is the stored project's non-empty `clientId`. There is no independent workflow-run store: the active run is embedded at `project.audit.activeRun`, while pause records, tasks, and human-input requests are separate stored resources. A `workflowRunId` is correlation data, not proof of ownership.

The repository has no reliable operator-to-project, operator-to-engagement, operator-to-workflow, or action-permission assignment model. The optional actor `clientId` alone is insufficient for critical execution controls. B3 should therefore allow `internal_admin` only and deny `internal_operator` and `client_user` by default.

Recommended delivery is three PRs: B3A for both run aliases, B3B for resume, and B3C for abort. This separates background execution, linked pause/task integrity, and status-only abort semantics.

## 2. Exact Route Inventory

| Method | Public API path | Repository file | Current protection | Risk | Mutates workflow state | Triggers execution | Agents/tools/providers | Resumes paused work |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/api/projects/[id]/run` | `app/api/projects/[id]/run/route.ts` | FULL in B3A: authn, stored ownership, admin-only authz, audit, redaction, safe errors | CRITICAL | Yes: stale failure, active run, department results, deliverables, terminal status | Yes, background | Provider calls directly; downstream department execution and persistence; no formal agent-step invocation in this route | No |
| `POST` | `/api/engagements/[id]/run` | `app/api/engagements/[id]/run/route.ts` | FULL in B3A: delegates exactly to protected project run | CRITICAL | Same as project run | Yes, background | Same as project run | No |
| `POST` | `/api/engagements/[id]/workflow/resume` | `app/api/engagements/[id]/workflow/resume/route.ts` | PARTIAL: stored project/pause checks and approval-state checks; no authn/authz | CRITICAL | Yes: task, execution, pause, project run, departments, deliverables | Yes, agent execution followed by optional background continuation | Agent executor, provider, task/execution stores, and continuation provider calls | Yes |
| `POST` | `/api/engagements/[id]/abort` | `app/api/engagements/[id]/abort/route.ts` | PARTIAL: stored project and active-state check; no authn/authz | CRITICAL | Yes: project status, active run, running audit entries, warnings | No; it does not stop already-running work | No new calls, but existing background work may continue | No |

### Investigated but excluded

- No public `/pause`, `/retry`, `/restart`, `/cancel`, or `/continue` workflow endpoint exists.
- `POST /api/agent-tasks/[id]/approve` changes task approval only; B2B already protects it.
- Human-input answer/confirm/reject/skip routes change stored request state but do not directly execute or resume a workflow; earlier ALPHA-052 batches own them.
- `POST /api/agent-tasks/[id]/run` is an agent-task execution control already protected by B2A.

### Exact proposed B3 scope

- B3A: COMPLETE for both public run aliases through their one shared handler.
- B3B: workflow resume only.
- B3C: abort only, retaining its status-recording contract and explicit limitations.

Protected handlers are 12 and remaining handlers are 34 on `main` after PR #47.

## 3. Current Protection State and Handler Flow

### Run/start flow

Both public paths use the project run implementation.

1. Extract path `id`.
2. No body is parsed.
3. Load project by path `id`; the run is embedded in that project.
4. Treat the project ID as the engagement ID.
5. Require active lifecycle, reject blocking human input, mark a stale active run failed, reject a still-active run, and require production xAI configuration.
6. `markRunStaleAsFailed` may persist a failure before duplicate evaluation; `beginWorkflowRun` persists `status: running` and a new `audit.activeRun`.
7. Start `runExistingProject` fire-and-forget.
8. The orchestrator persists per-department running/completed state, outputs, deliverables, heartbeats, and terminal status.
9. Return `202` with project ID, `running`, and active run ID.
10. Map missing project to 404, schema errors to 422, lifecycle/duplicate/input conflicts to 409, configuration to 503, and other raw messages to 500.

Current ordering issue: no authentication exists. Once auth is added, it must occur before project lookup, human-input lookup, stale-run mutation, run creation, or background execution. Stale cleanup is a mutation and must remain after successful authorization.

Partial failure is an existing contract: run state is persisted before asynchronous work starts. Later provider or validation failure is recovered by the orchestrator setting project status to `failed`; the initial response remains 202.

### Resume flow

1. Extract path engagement ID.
2. Parse caller body before authentication; accepts optional `pauseStateId` and `resumedBy`.
3. Load project by path engagement ID.
4. Load the explicit pause by caller ID, or discover the most recent waiting pause for the project.
5. Check pause ownership using the current OR condition, then in the service require pause status `waiting_for_approval`, an `agentTaskId`, a stored task, and task approval `approved`.
6. Execute the task before marking the pause resumed.
7. On success, persist completed task output, mark the pause resumed, and optionally start continuation. On execution failure, cancel the pause and persist task failure.
8. Task, execution, pause, project, department, and deliverable stores may be written.
9. Return engagement ID, pause ID, task status, resumed time, a rich audit entry, and continuation details.
10. Return 400 validation, 404 missing resource, 409 replay/state, 422 approval, or raw service/error messages in 500-class responses.

Current ordering issues: body parsing and all work occur without authentication. Caller-supplied pause and `resumedBy` values influence lookup and persisted attribution. The task can execute before the pause is atomically claimed as resumed, so concurrent resume requests can race and execute more than once. Authorization and complete stored linkage validation must finish before task execution or persistence.

Partial failure is explicit: task execution may complete before task output is saved or pause status is changed. Continuation may also start in the background after a 200 response and fail later.

### Abort flow

1. Extract path engagement ID.
2. No body is parsed.
3. Load project by path ID.
4. No separate engagement or run resource is loaded.
5. Require project status `running` or a non-null `audit.activeRun`.
6. `failWorkflowRun` sets project status `failed`, clears active run, appends a warning, and marks running audit entries failed.
7. No execution cancellation call exists.
8. Save the project.
9. Return a small success or conflict response.
10. Map missing project to 404 and otherwise return raw `error.message` as 500.

Current ordering issue: project mutation occurs without authentication. The route changes persisted status only; any background orchestration or provider request can continue and later write more project state.

## 4. Canonical Workflow Ownership Model

There is no canonical standalone workflow-run type or store. The persisted project is the owning aggregate.

| Requested field | Actual storage |
| --- | --- |
| workflowRunId | `project.audit.activeRun.id`; also copied into pause/task/human-input correlation fields |
| workflow definition ID | Not stored |
| projectId | The owning project record's `id` |
| engagementId | Same identifier as project ID in current workflow paths; pause/task/request records may copy it |
| clientId | Stored on project; authoritative tenant source |
| current status | `project.status` (`draft`, `running`, `needs-review`, `complete`, `failed`) |
| pause state | Separate `PausedWorkflowState` record |
| resume token/context | No token; caller may submit pause ID; context is stored pause state |
| human-input linkage | Separate request can store client, engagement, workflow-run, and task IDs; run checks blocking requests by engagement |
| agent-task linkage | Pause stores `agentTaskId`; task stores project, engagement, and optional workflow-run IDs |
| createdBy / updatedBy | Not stored on project run or pause except optional caller-controlled `resumedBy` |
| execution timestamps | Active run has started/updated; audit entries have started/completed; pause has paused/resumed/cancelled timestamps |
| retry counters | Not stored |
| error state | Project status, audit run errors, and warnings; no active-run error field |
| current node/step | Pause `currentStepId`; no current node on active project run |
| parent/child runs | Not stored |
| tenant ownership fields | Project `clientId`; copied links elsewhere are not authoritative |

The pause record stores `id`, `workflowRunId`, `projectId`, `engagementId`, `currentStepId`, pause reason, optional agent task, required approval target, status, completed/failed/pending step IDs, and lifecycle timestamps. It has no `clientId`.

`workflowRunId` cannot prove ownership. Pause creation can fall back to `run-${project.id}`, and no independent run lookup validates that value. B3 must derive ownership from the stored project and use workflow-run IDs only for linkage consistency where repository evidence exists.

## 5. Role Policy

Result: **OPERATOR ASSIGNMENT MODEL DOES NOT EXIST**.

The actor token may contain a `clientId`, and generic helpers compare it with a stored client ID. The repository has no durable operator-to-client assignment, project assignment, engagement assignment, workflow assignment, workflow execution permission, resume permission, or abort permission. Agent permissions describe agent capabilities, not human operator authority.

| Action | internal_admin | internal_operator | client_user |
| --- | --- | --- | --- |
| run/start/restart | Allow after stored ownership and state checks | Deny by default | Deny |
| resume | Allow after project/pause/task linkage and state checks | Deny by default | Deny |
| abort | Allow after stored ownership and active-state checks | Deny by default | Deny |

Client human-input responses and client-facing approvals do not grant internal orchestration authority. Those surfaces remain separate from B3 execution controls.

## 6. Authorization Chain

The repository supports the preferred chain with action-specific resource loading:

1. Authenticate the actor before body parsing, lookup, mutation, or execution.
2. For run/abort, load the stored project from the path ID. For resume, load the path project and then the stored pause.
3. Resolve the stored project/engagement identity; current canonical engagement is the project ID.
4. Require a non-empty stored `project.clientId`.
5. Validate all available stored linkage with equality, never OR/fallback logic.
6. Enforce action policy: admin only for Alpha.
7. Apply existing lifecycle, duplicate, pause, approval, and active-state contracts.
8. Mutate or execute.
9. Record a best-effort security decision event.
10. Return a minimal safe response.

### Fail-closed requirements

- Missing project: concealed 404 after authentication.
- Missing `project.clientId`: 403 and no side effects.
- Resume pause missing: concealed 404.
- Pause `projectId` or `engagementId` differs from the path project: concealed 404; require both links to match.
- Pause task missing: concealed 404.
- Task `projectId` or `engagementId` differs from the pause/project: deny or conceal with no execution.
- If task and pause both contain `workflowRunId`, require equality. Do not treat an absent or synthetic run ID as ownership.
- If a future resume path uses human input, load it and require its stored client, engagement, workflow-run, and task links to agree. The current route is agent-task-only and must not invent a human-input fallback.
- Caller-supplied `projectId`, `engagementId`, `clientId`, `workflowRunId`, task ID, human-input ID, or attribution must not redirect ownership, authorization, or mutation.

## 7. State-Transition Analysis

| Action | Existing allowed state | Result | Replay/current behavior | Contract classification |
| --- | --- | --- | --- | --- |
| run/start | Active lifecycle; no unresolved blocking input; no fresh active run | Persist `running` + active run; async terminal `complete`, `needs-review`, or `failed` | Fresh duplicate returns 409; stale active run is failed then a new run starts; terminal/failed projects can run again | Lifecycle, blocking input, duplicate lock, stale recovery, and rerun behavior are **EXISTING CONTRACT** |
| resume | Pause `waiting_for_approval`; linked task exists and is `approved` | Task completed, pause `resumed`; optional project continuation | Non-waiting pause returns 409; unapproved task returns 422; completed/failed task behavior is governed by executor plus approval state | Existing 409/422 and successful continuation are **EXISTING CONTRACT**; atomic replay protection is a **SECURITY REQUIREMENT** |
| abort | Project `running` or active run exists | Project `failed`, active run cleared, running audit entries failed | Non-running returns 409; repeated abort returns 409; completed/failed returns 409 | Existing failed-state mapping and 409 are **EXISTING CONTRACT** |

No separate retry endpoint or retry counter exists. Calling run after terminal or failed status is the existing restart behavior. Adding a terminal-run prohibition, new retry limit, new status, or new 409 rule would be a **PRODUCT BEHAVIOR CHANGE** and is out of scope.

Requiring authorization before stale cleanup, requiring stored links to agree, preventing concurrent replay of an already-defined one-time resume, and guaranteeing denial has zero side effects are **SECURITY REQUIREMENTS**.

Changing abort to terminate provider requests, changing `failed` to `aborted`, or preventing current reruns are **PRODUCT BEHAVIOR CHANGES** and require separate approval.

## 8. Execution Side Effects

| Side effect | Route(s) | Before current authorization | Repeatable/idempotent | Recovery |
| --- | --- | --- | --- | --- |
| Active-run creation and project persistence | run, resume continuation | Yes; no auth exists | Not idempotent; duplicate lock reduces sequential replay | Terminal failure and stale recovery exist |
| Seven department provider calls, including repair calls | run; resume continuation | Yes | Expensive and not idempotent | Project marked failed; partial outputs/audit remain |
| Department and deliverable writes | run; resume continuation | Yes | Can overwrite/recompute | Persisted partial state remains reviewable |
| Agent task execution and execution-store write | resume | Yes | Executor protections apply, but concurrent resume race remains | Failure cancels pause and marks task failed |
| Task output/status persistence | resume | Yes | Rewrites task | Partial execution can precede this write |
| Pause resumed/cancelled persistence | resume | Yes | Sequential replay rejected; concurrent claim is not atomic | Stored status supports later diagnosis |
| Blocking human-input reads | run | Yes | Read-only | Not applicable |
| Project status-only abort | abort | Yes | Repeated call returns 409 | Does not stop in-flight execution |
| Security audit event | none currently | Not applicable | Best effort by design | Failure must be isolated |

Current orchestrator paths do not directly generate exports or notifications. They can create deliverable content, record provider usage indirectly through agent execution, and read project evidence included in prompts. The resume agent may invoke permissions/tools supported by `AgentExecutor`, including data-room retrieval when configured.

Highest-risk irreversible or expensive effect: provider/tool execution beginning from unauthenticated run or resume requests. Denial after B3 must guarantee zero provider calls, agent executions, project writes, task writes, pause writes, and continuation starts.

## 9. Pause/Resume Integrity

Current resume context is a stored pause ID, not a secret token. The route may auto-discover a pause when the body omits it. The UI uses only engagement ID and pause ID and requires the response fields `engagementId`, `pauseStateId`, `taskStatus`, and `resumedAt`; it ignores the current rich audit and continuation objects.

Current exposure:

- A guessed pause ID can be submitted without identity.
- The OR linkage check can accept a record when only one of project or engagement linkage matches.
- The linked task is checked for approval but not for complete equality with pause project/engagement/workflow linkage.
- Caller-controlled `resumedBy` is persisted as attribution.
- Two concurrent resumes can pass `waiting_for_approval` before either marks the pause resumed.
- Task execution happens before the pause is claimed, so replay can cause duplicate provider/tool effects.
- Continuation can create a new active run when none exists; no independent workflow-run store validates the pause's run ID.

Required fail-closed rules without product changes:

1. Authenticate first.
2. Load path project, require stored client ownership, then authorize admin.
3. Load or discover a stored waiting pause only after authorization.
4. Require pause project and engagement IDs both equal the stored project ID.
5. Load the stored task and require task project/engagement links equal the same project.
6. Require pause `requiredApprovalTarget` to equal `agent_task:${task.id}` and task approval to be `approved`.
7. Where both task and pause run IDs exist, require equality; never authorize from the run ID.
8. Ignore body ownership/linkage fields. Derive attribution from authenticated actor rather than `resumedBy`.
9. Atomically claim the waiting pause before external execution, or provide an equivalent single-consumer guard with failure recovery.
10. Preserve existing 409 replay, 422 approval, and background continuation behavior.

## 10. Abort/Cancel Integrity

`failWorkflowRun` changes persisted state only. It sets project status to `failed`, clears `audit.activeRun`, appends a warning, marks running department audit entries failed, and saves. There is no cancellation signal wired to `runExistingProject`, `callXai`, or an active agent executor.

Consequences:

- Downstream provider work can continue after the abort response.
- Background orchestration can later persist department output, heartbeat, deliverables, or terminal status.
- Abort racing with execution can produce status/write ordering inconsistencies.
- Repeated abort and abort of a completed/non-running project return 409.
- The current UI accurately says “Workflow abort recorded”; B3 must retain that wording and must not call this a safe or guaranteed cancellation.

B3C should add authn/authz, ownership, audit, and sanitized errors while preserving the status-only contract. Actual cooperative cancellation is a separate product/runtime workstream.

## 11. Response-Redaction Risks

### Run

Success is already minimal: project ID, status, and active run ID. The UI needs only success and subsequently reloads projects. The duplicate response exposes active run ID and timestamp; these can be retained for the internal admin UI but must never be returned to denied callers. The blocking-input conflict currently exposes request ID, title, prompt, related field, and status. The dashboard only needs an error message/field errors, so prompts and rich request content should be removed from this control response.

The 503 exposes configuration detail and generic 500 returns raw `error.message`. B3 should return stable safe codes/messages without provider configuration, prompt, schema internals, paths, or stack data.

Recommended success: `{ data: { projectId, status, activeRunId } }` or the current equivalent minimal fields if preserving UI compatibility.

### Resume

The UI requires only engagement ID, pause ID, task status, and resumed time. Current `auditEntry` can contain agent/task/run/step IDs and raw execution error. Continuation failure `reason` can contain project/pause IDs, provider errors, pending step data, or diagnostics. Remove the rich audit entry and raw reason from the route response.

Recommended success: `{ engagementId, pauseStateId, taskStatus, resumedAt, continuation: { status } }`. Preserve top-level fields required by `agent-task-client.ts`.

### Abort

Current success/conflict shapes are small and used only for success/error detection. Keep `ok`, engagement ID, status, and `safeToRetry` if product semantics require them. Replace raw generic errors with a sanitized stable message. `safeToRetry` means the status operation may be retried; it does not promise in-flight work was cancelled.

All routes must exclude full project/run objects, workflow graphs, node state, prompts, provider output, agent output, tool permissions/arguments/results, data-room retrieval, stack traces, raw exception messages, retry internals, token/cost data, diagnostics, hidden reasoning, secrets, and unnecessary internal IDs.

## 12. Audit Policy

Use the merged best-effort security audit mechanism. Recommended actions:

- `workflow_run_start`
- `workflow_resume`
- `workflow_abort`

Use resource type `workflow_run` and the stored active run ID when one exists; before run creation use resource type `project` and the path project ID, or keep a stable project resource ID in the action context. Do not trust a body-supplied resource ID.

Each event contains only timestamp, actor ID, actor role, action, resource type, resource ID, allow/deny decision, and a non-sensitive reason code. Exclude authorization headers, bearer tokens, workflow inputs, prompts, task/provider output, human-input or revision content, tool arguments/results, diagnostics, and secrets.

Audit failure must not change 401, 403, concealed 404, validation, existing 409/422/503 transition outcomes, or successful run/resume/abort outcomes. Audit failure must never cause a duplicate action retry inside the handler.

## 13. Threat Model

| Threat | Current exposure | Existing mitigation | Required B3 mitigation | Test |
| --- | --- | --- | --- | --- |
| Client A guesses Client B run ID | Paths are open; run ID appears in responses | Project lookup only | Authenticate; authorize from stored project client; conceal denied resource | Cross-client guessed ID, no writes/calls |
| Client user triggers internal run | Fully exposed | Lifecycle/state checks only | Deny client user | 403/concealed policy and zero execution |
| Operator runs without assignment | Fully exposed | None | Deny operator by default | 403 and unchanged project |
| Cross-client resume | Fully exposed | Weak pause/project check | Stored project ownership plus strict pause/task links | Foreign project/pause/task combinations |
| Cross-client abort | Fully exposed | Project path lookup | Admin-only stored project policy | Denial leaves active run unchanged |
| False projectId | Extra body fields are ignored by run/abort; resume accepts pause redirect | Path lookup | Reject/ignore ownership fields; stored project only | Override payload matrix |
| False engagementId | Path controls target; pause OR check is weak | Partial equality | Both stored pause links must equal project | Mismatch returns concealed 404 |
| False clientId | Not used today | Stored project has client ID | Never accept body client ID | Override cannot alter decision |
| False task/human-input link | Pause task link drives execution | Task must exist and be approved | Validate task/project/engagement/run/approval target; no human-input fallback | Cross-client task and fake request IDs |
| Replay run | Terminal rerun allowed; active duplicate blocked | Active-run 409 | Preserve duplicate lock after authorization | Active replay 409, no second run |
| Replay resume | Sequential replay 409; concurrent race possible | Pause status check | Atomic claim/single consumer | Sequential and concurrent replay |
| Abort racing execution | Status can be overwritten later | None | Document status-only semantics; secure ordering; add race characterization | Abort during mocked background work |
| Resume racing abort | Project and pause can diverge | Separate state checks | Authorize first; validate stored state immediately before claim; preserve recovery | Controlled race test |
| Resume after completion | Pause status normally blocks | 409 when non-waiting | Preserve; strict pause claim | Completed/resumed pause 409 |
| Run after completion | Allowed restart | Active-run lock only | Preserve current rerun behavior | Completed project starts new run |
| Partial execution before auth failure | Fully possible | None | Authentication, linkage, and role checks before mutation/execution | Spies/stored snapshots prove zero effects |
| Audit sink affects execution | No security audit currently | Best-effort helper exists | Use best-effort calls only | All outcome invariance cases |
| Provider/tool output leaks | Resume and errors expose rich reasons/audit | Some UI sanitization | Server-side safe projection and stable errors | Marker-based leakage negatives |
| Stack/raw exception leaks | Generic 500s use raw messages | Some route-specific normalization | Sanitized 500 | Throw marker/path/token errors |
| State changes without matching execution | Run persists before async work; abort is status-only; resume has multi-write sequence | Failure recovery and audit entries | Preserve documented async contract; add integrity checks and race tests | Persistence/execution ordering tests |

## 14. Shared Authorization Design

A narrow `lib/security/workflow-authorization.ts` helper is appropriate. It should follow the existing agent-task helper style and not contain workflow state-machine logic.

Recommended actions:

- `run`
- `resume`
- `abort`

Suggested responsibilities:

- accept an authenticated actor and action;
- load or accept the stored project;
- require a non-empty stored `clientId`;
- enforce admin-only Alpha policy;
- for resume, validate stored project/pause/task linkage through a focused ownership resolver;
- return canonical project/client/pause/task ownership data;
- raise canonical concealed 404/403 errors;
- never accept body ownership as authority;
- never log workflow content.

Keep lifecycle, duplicate-run, stale recovery, approval-state, pause-state, resume claim, and abort-state checks in their owning route/service abstractions.

## 15. Focused Test Matrix

Apply these cases to each public route, sharing assertions for the two run aliases while invoking both paths.

### Authentication and roles

- Missing and malformed identity return 401 before lookup or body parsing.
- Admin reaches existing state contract.
- Operator receives 403 with no effects.
- Client user is denied with no effects.

### Ownership and linkage

- Stored project with client ownership succeeds for admin.
- Project without `clientId` fails closed.
- Unknown project is concealed after authentication.
- Caller project/engagement/client/workflow IDs cannot redirect a run or abort.
- Resume requires both pause project and engagement links to match.
- Resume requires linked task project/engagement/run and approval-target integrity.
- Foreign task/human-input IDs cannot redirect continuation.

### Existing state safety

- Run: active lifecycle, archived/deleted 409, blocking input 409, fresh duplicate 409, stale recovery, completed/failed rerun.
- Resume: waiting+approved succeeds, unapproved/rejected/revision 422, already resumed/cancelled 409, missing task 404, repeated and concurrent resume.
- Abort: active succeeds, non-running/completed/failed/repeated abort 409.
- Do not add tests that assert new terminal guards or retry limits.

### Execution safety

- Every denial, unknown resource, missing ownership, and invalid linkage causes no project/task/pause/execution persistence and no provider/executor/continuation call.
- Valid actions preserve exactly the current background/synchronous behavior.
- Run authorization precedes stale cleanup and `beginWorkflowRun`.
- Resume authorization and atomic claim precede agent execution.
- Abort denial leaves active state unchanged.

### Audit and response safety

- Allow and deny events use non-sensitive metadata.
- Audit-sink failure preserves 401, 403, concealed 404, validation, 409, 422, 503, and success outcomes.
- Marker values in body, prompts, task output, provider output, tool data, headers, diagnostics, and thrown errors never appear in events or responses.
- Success responses contain only required UI fields; generic 500 is sanitized.

Estimated new tests: 60-75 total across three PRs (B3A 22-26, B3B 26-33, B3C 12-16), with table-driven coverage where contracts are shared.

## 16. PR-Splitting Recommendation

Choose **Option B**.

- **B3A - Workflow run/start:** protect both aliases through the shared project-run implementation. Preserve lifecycle, blocking-input, stale recovery, duplicate-run, 202 background execution, and rerun contracts.
- **B3B - Workflow resume:** independently harden project/pause/task linkage, atomic replay protection, response redaction, and execution ordering. This is the highest-risk PR.
- **B3C - Workflow abort:** add authn/authz and safe errors while documenting and preserving status-only abort semantics.

Do not combine resume and abort. Their data dependencies, race risks, response contracts, and side effects differ materially.

## 17. Dependencies and Blockers

### Dependencies available

- ALPHA-052 security foundation and best-effort audit helpers: available.
- Agent-task ownership and approval hardening: available.
- Human-input mutation ownership hardening: available.
- Stored project `clientId`: available but optional, so missing ownership must fail closed.
- Pause/task stores and existing workflow services: available.

### Blockers to B3 implementation

- No external blocker for B3A or the authn/authz portion of B3C.
- B3B must select and test an atomic pause-claim/recovery design before external execution. This is an implementation design gate, not a new product transition.
- B3C must explicitly retain status-only semantics; real cancellation cannot be claimed without a separately approved cancellation design.

### Blockers to Alpha release

- Remaining ALPHA-052 route batches after B3.
- Production identity provider integration and deployment policy remain broader Alpha concerns.
- Any product requirement for operator workflow control requires a durable assignment/permission model before operators can be allowed.

### Non-blocking technical debt

- No standalone workflow-run store or durable run history identity.
- Pause persistence during workflow agent execution is currently fire-and-forget.
- Project TypeScript types and runtime project schema use inconsistent status vocabulary.
- Background work lacks cooperative cancellation.
- Rich internal service error strings are not designed as public API contracts.
- Build retains 10 known Turbopack warnings.

## 18. Acceptance Criteria

B3 implementation is acceptable only when:

1. All four public handlers authenticate before body parsing, lookup, mutation, or execution.
2. Only `internal_admin` is allowed; operator and client-user denial is explicit.
3. Stored project `clientId` is the sole tenant authority and missing ownership fails closed.
4. Run aliases share identical security and existing transition behavior.
5. Resume requires strict project/pause/task linkage and cannot be redirected by caller fields.
6. Resume replay protection prevents duplicate external execution, including concurrent requests.
7. Abort is described and tested as a persisted status operation, not cancellation.
8. Existing lifecycle, duplicate, stale, rerun, pause, approval, replay, and abort contracts remain unchanged unless separately approved.
9. Denial and linkage failures have zero persistence and execution side effects.
10. Success and failure responses are minimal, UI-compatible, and sanitized.
11. Audit events are metadata-only and audit failure is outcome-invariant.
12. Focused tests, security suite, full suite, typecheck, and build pass.
13. Protected/remaining handler counts change only after implementation PRs merge.

## 19. Open Questions

1. Should B3B auto-discovery of the newest active pause remain available, or should the UI always provide a stored pause ID? Preserve current behavior unless product approves a change.
2. What atomic pause-claim and recovery mechanism best fits the file store while preserving 409 replay semantics?
3. Should authenticated actor ID replace body `resumedBy` entirely, or should body attribution be ignored while retaining the field for compatibility?
4. Is the pause `workflowRunId` expected to match `project.audit.activeRun.id` when a project is no longer active? Current persistence cannot always prove this.
5. Should a separate future workstream implement cooperative cancellation and an `aborted` runtime status?
6. Should blocking-input 409 responses retain request IDs but remove prompt/title content? The current dashboard does not consume those details.
7. Will internal operators ever receive workflow control authority? If yes, define and persist assignments before changing the Alpha deny policy.

## 20. Recommended Implementation Sequence

1. B3A: add shared workflow ownership/action helper and harden the shared run implementation; invoke both aliases in tests.
2. Focused security re-review and merge B3A.
3. B3B: design atomic pause claim/recovery, then harden resume linkage, ordering, audit, and redaction.
4. Focused security re-review and merge B3B.
5. B3C: harden abort while preserving status-only semantics and characterizing races.
6. Focused security re-review and merge B3C.
7. Update handler counts and ALPHA-052 progress only after each implementation merge.

B3 readiness result: **READY**. B3A is COMPLETE on its governed feature branch; B3 overall remains IN PROGRESS, subject to the B3B atomic resume design gate and the explicit B3C status-only boundary.