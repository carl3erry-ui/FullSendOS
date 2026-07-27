# ALPHA-052 Route Hardening Plan

Date: 2026-07-27
Status: PLANNING COMPLETE
Scope: Remaining ALPHA-052 route hardening only
Prerequisite merge: PR #41 at `e704e9e2f5cb988ac1e5470a9d08581b3f3f00ed`

## 1) Executive Summary

ALPHA-052-01 is merged and the security foundation is stable. ALPHA-052-02 B1 is now complete, and the remaining work is the governed hardening of the 40 route files that are not fully protected yet.

Current baseline for planning:
- Route files in scope: 46
- Fully protected handlers already merged: 6
- Remaining route files to harden: 40
- ALPHA-052 status: IN PROGRESS
- ALPHA-052-01 status: COMPLETE
- Security follow-up: Issue #42 satisfied by explicit audit-failure coverage in `services/security-route-guards.test.ts`
- Build-warning follow-up: Issue #43
- Current build warnings: 10, pre-existing and non-blocking

Planning conclusions:
- The next work should be split into small batches of 3 to 7 related handlers.
- The safest first batch is the human-input lifecycle mutation set: confirm, reject, skip.
- Issue #42 is now satisfied by explicit 403 and concealed 404 audit-failure assertions; it no longer blocks the B1 batch.
- Issue #43 remains a separate engineering cleanup item and does not block ALPHA-052.

See [ALPHA_052_ROUTE_COVERAGE_MATRIX.md](ALPHA_052_ROUTE_COVERAGE_MATRIX.md) for the file-by-file inventory.

## 2) Current Route Inventory

Route families discovered in the current repository:

| Family | Route files | Current posture | Dominant risk | Notes |
| --- | ---: | --- | --- | --- |
| `/api/clients/**` | 11 | Mixed: 1 hardened, rest partial or none | Tenant-bound read/write access, file upload/download, lifecycle changes | Strong resource checks exist; identity checks are still missing on most surfaces. |
| `/api/engagements/**` | 14 | Mixed: mostly partial/none | Workflow control, export/download, engagement-scoped data room access | Several routes already resolve project ownership or conceal missing IDs, but caller auth is still missing. |
| `/api/human-input/**` | 6 | Mixed: 4 hardened, rest partial/none | Approval and workflow-steering mutations | Best candidate family for the first remaining mutation batch. |
| `/api/agent-tasks/**` | 6 | Mostly none/partial | Task execution, approval, and revision control | High risk because the routes can affect execution state and raw outputs. |
| `/api/projects/**` | 6 | Mostly partial/none | Lifecycle changes, run control, export management | Strong tenant scoping will be needed before any broad exposure. |
| `/api/agents` | 1 | None | Public metadata exposure | Safe to keep public if internal details stay filtered. |
| `/api/deliverable-templates` | 1 | None | Public template metadata exposure | Safe reference endpoint, but should remain low-risk and read-only. |
| `/api/demo/**` | 1 | Hardened | Internal-only operational control | Already protected in the foundation merge. |

Current handler inventory remains 46 total. The six already protected handlers are:
- `GET /api/clients/[clientId]/data-room/files`
- `POST /api/human-input/[id]/answer`
- `POST /api/human-input/[id]/confirm`
- `POST /api/human-input/[id]/reject`
- `POST /api/human-input/[id]/skip`
- `POST /api/demo/seed`

## 3) Route Security Policy Matrix

| Family | Allowed roles | Prohibited roles | Ownership source | Tenant boundary | Concealment | 401/403/404 policy | Raw diagnostics / provider output | Audit events |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/clients/**` | `internal_admin`; `internal_operator` within scoped client; `client_user` only on client-safe reads | Any cross-tenant actor; `client_user` on internal/admin actions | Path `clientId`, stored client record, data-room file metadata, and any project-linked client ownership | Same-client required except internal admin cross-client cases | Cross-tenant client-user reads should conceal as `404` where the resource should remain hidden; other denials use `403` | `401` missing auth, `403` forbidden, `404` concealed existence | File/document routes must filter storage paths and raw file internals; no provider output here | Required for protected reads and all mutations |
| `/api/engagements/**` | `internal_admin`; `internal_operator` within authorized client/engagement; `client_user` only where a route is explicitly client-safe | Unauthorized internal operators; all client users on internal-only control routes | `engagementId` path parameter, stored project ownership, engagement-linked data room/export metadata | Same engagement/client scope required for scoped access | Conceal guessed or cross-tenant engagements with `404` when the route is meant to hide existence | `401` missing auth, `403` forbidden, `404` concealed existence | Export/detail routes must filter internal notes, raw outputs, and storage paths | Required for workflow control, exports, and scoped reads |
| `/api/projects/**` | `internal_admin`; `internal_operator` within scope | `client_user` and any out-of-scope internal operator | Stored project `clientId` plus project ID | Same client required for non-admin access | Missing project IDs should remain `404`; unauthorized access should not leak internal details | `401` / `403` / `404` as appropriate | Project detail/export routes must redact internal diagnostics and evidence internals | Required for lifecycle and export routes |
| `/api/human-input/**` | `internal_admin`; `client_user` for own client on client-facing actions | `internal_operator` until a stored assignment model exists; cross-client clients; unscoped clients | Stored human-input request `clientId` and `engagementId` | Same client/engagement required | Cross-tenant access should hide existence on client-facing actions | `401` / `403` / `404` according to the caller and route type | Responses must stay generic; no raw request payloads or audit data in responses | Required for all protected human-input actions |
| `/api/agent-tasks/**` | `internal_admin`; `internal_operator` within authorized scope | `client_user` and out-of-scope internal operators | Task `projectId`, `engagementId`, `workflowRunId`, and agent/task store metadata | Same project/client/engagement scope required | Guessable task IDs should not reveal task internals | `401` / `403` / `404` according to hidden task policy | Read routes must redact raw provider outputs and execution internals | Required for run/approve/reject/revision routes |
| `/api/agents` | Public-safe metadata only; no auth required in Alpha | None, provided implementation stays public-safe | None | None | None | No auth gate required; failures should still be generic `500` only | System prompts and internal implementation details must remain filtered | Not required for public metadata |
| `/api/deliverable-templates` | Public-safe metadata only; no auth required in Alpha | None, provided template catalog stays safe | None | None | None | No auth gate required; failures should still be generic `500` only | Raw provider output is not present, but template metadata must remain sanitized | Not required for public reference data |
| `/api/demo/**` | `internal_admin` only | `internal_operator`, `client_user`, and unauthenticated callers | None beyond internal demo state | Internal-only, no tenant binding | Hide existence where appropriate; do not expose demo internals | `401` missing auth, `403` forbidden, `404` only for genuine absence | No raw diagnostics or provider output in responses | Required for internal-only demo controls |

## 4) Risk Ranking

### CRITICAL
- Human-input lifecycle mutations: `confirm`, `reject`, `skip`
- Agent-task execution and approval controls: `run`, `approve`, `reject`, `request-revision`
- Workflow execution controls: `run`, `abort`, `workflow/resume`
- Demo seed control: `POST /api/demo/seed`
- Project execution control: `POST /api/projects/[id]/run`

### HIGH
- Client and engagement file mutations, uploads, downloads, and export downloads
- Project lifecycle mutation routes
- Human-input answer route already protected, but its surrounding family remains high-risk until the rest is covered

### MEDIUM
- Client and engagement detail/read routes that rely on resource existence checks but not caller identity
- Baseline, document, folder, and human-input read surfaces that are tenant-sensitive but not execution-critical

### LOW
- Public-safe reference endpoints: `/api/agents`, `/api/deliverable-templates`
- Broad list endpoints that are intentionally non-sensitive if they remain read-only and sanitized

## 5) Proposed Implementation Batches

Batch size target: 3 to 7 related handlers.

| Batch ID | ALPHA subtask | Route handlers | Risk addressed | Role policy | Ownership source | Helper required | New tests required | Complexity | Expected PR size | Dependencies | Exit criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | ALPHA-052-02 | `/api/human-input/[id]/confirm`, `/api/human-input/[id]/reject`, `/api/human-input/[id]/skip` | Critical workflow-steering mutations | `internal_admin` allowed; `internal_operator` denied until assignment model; `client_user` only for stored matching client | Human-input request `clientId` + `engagementId` | `requireAuthenticatedActor`, `requireClientAccess`, deny `internal_operator` until assignment model exists | 401, 403, 404, ownership, audit, invalid-body tests | Low-medium | Small | ALPHA-052-01 helpers | All three routes enforce tenant-safe auth and generic error policy |
| B2 | ALPHA-052-03 | `/api/agent-tasks/[id]/run`, `/api/agent-tasks/[id]/approve`, `/api/agent-tasks/[id]/reject`, `/api/agent-tasks/[id]/request-revision` | Critical execution and approval controls | `internal_admin`; `internal_operator` only where the task is scoped and execution is allowed | Task `projectId` / `engagementId` / `workflowRunId` | `requireAuthenticatedActor`, `requireInternalAdmin` and/or scoped helper | 401, 403, 404, execution-state, redaction, audit tests | Medium | Medium | ALPHA-052-01 helpers; task ownership model | Task execution and approval decisions cannot cross tenant boundaries |
| B3 | ALPHA-052-04 | `/api/engagements/[id]/run`, `/api/engagements/[id]/abort`, `/api/engagements/[id]/workflow/resume`, `/api/projects/[id]/run` | Workflow execution controls | `internal_admin`; `internal_operator` within scope | Project ownership and workflow pause state | `requireAuthenticatedActor`, `requireEngagementAccess` | 401, 403, 404, workflow-state, pause/resume, audit tests | Medium | Medium | Batch B2 or shared workflow helper patterns | Workflow control routes require tenant-safe authorization and do not expose pause details |
| B4 | ALPHA-052-05 | `/api/clients/[clientId]/data-room/files`, `/api/clients/[clientId]/data-room/files/[fileId]`, `/api/clients/[clientId]/data-room/files/[fileId]/process` | File upload, metadata mutation, and file processing | `internal_admin`, `internal_operator` within client scope, `client_user` only for client-safe surfaces where allowed | Client ID + file metadata ownership | `requireAuthenticatedActor`, `requireClientAccess` | 401, 403, 404, upload, metadata, archive, process, audit tests | Medium-high | Medium | Client file ownership rules | File handlers are tenant-bound and do not leak storage internals |
| B5 | ALPHA-052-06 | `/api/engagements/[id]/data-room`, `/api/engagements/[id]/data-room/[fileId]`, `/api/engagements/[id]/data-room/[fileId]/process`, `/api/engagements/[id]/exports/[exportId]/download` | Engagement-scoped file/download exposure | `internal_admin`, `internal_operator` within scope | Stored project ownership + engagement-linked file/export ownership | `requireAuthenticatedActor`, `requireEngagementAccess` | 401, 403, 404, concealment, safe download filename, audit tests | High | Medium | Batch B3 or shared engagement helper | Engagement data room and download routes respect tenant boundaries and redaction rules |
| B6 | ALPHA-052-07 | `/api/projects/[id]`, `/api/projects/[id]/exports`, `/api/projects/[id]/exports/[exportId]` | Project lifecycle and export management | `internal_admin`, `internal_operator` within scope | Stored project `clientId` and export ownership | `requireAuthenticatedActor`, `requireEngagementAccess` | 401, 403, 404, lifecycle, export, validation, audit tests | High | Medium | Batch B3; export store ownership rules | Project lifecycle and export routes become deny-by-default and tenant-safe |
| B7 | ALPHA-052-08 | `/api/clients/[clientId]`, `/api/clients/[clientId]/baseline`, `/api/clients/[clientId]/data-room`, `/api/clients/[clientId]/data-room/documents`, `/api/clients/[clientId]/data-room/documents/[documentId]`, `/api/clients/[clientId]/data-room/folders`, `/api/clients/[clientId]/human-input`, `/api/engagements/[id]/human-input` | Client and engagement read surfaces | `internal_admin`, `internal_operator` within scope; `client_user` only for client-safe portal reads | Client ID, project ownership, and human-input request ownership | `requireAuthenticatedActor`, `requireClientAccess`, `requireEngagementAccess` | 401, 403, 404, concealment, read-redaction tests | Medium | Medium | Batch B4/B5 helper patterns | Read surfaces are scoped, concealed when needed, and sanitized |
| B8 | ALPHA-052-09 | `/api/clients`, `/api/engagements`, `/api/agent-tasks`, `/api/agents`, `/api/deliverable-templates`, `/api/human-input`, `/api/human-input/[id]` | Low-risk list/reference endpoints and public-safe metadata | Public-safe endpoints remain public; internal lists should become scoped as needed | List filters, stored client/project/request references | Lightweight auth only where required | Coverage for 401/403/404 on internal lists; public-safe endpoints remain sanitized | Low | Small-medium | Earlier batches if list filters need tenant scoping | Public/reference routes stay safe, and internal lists do not leak cross-tenant data |

## 6) Dependencies

Planned batches should reuse the merged foundation from PR #41:
- `lib/security/authentication.ts`
- `lib/security/authorization.ts`
- `lib/security/route-guards.ts`
- `lib/security/security-response.ts`
- `lib/security/security-audit.ts`
- `services/test-auth.ts`

No new authentication dependency should be added.

## 7) Issue #42 Placement

Recommended placement: complete before final ALPHA-052 acceptance only.

Reason:
- Issue #42 is a security test coverage follow-up, not a blocker for starting route hardening.
- It should be closed before ALPHA-052 is declared complete because it addresses remaining audit-sink negative coverage.
- The work is isolated to tests and does not require a new runtime batch.

## 8) Issue #43 Disposition

Recommended disposition: keep separate from security route hardening.

Reason:
- The warning is pre-existing on current `main` and was not introduced by PR #41.
- It does not affect security behavior or build correctness.
- It should be tracked as a future engineering/performance cleanup item, not as an ALPHA-052 blocker.

Best future phase:
- Post-ALPHA-052 build/performance hygiene or a small infra cleanup pass.

## 9) Recommended ALPHA-052-02 Scope

Top three candidate batches compared:

1. Human-input lifecycle mutations
- Routes: `confirm`, `reject`, `skip`
- Risk reduced: direct workflow-steering mutations that can alter client-visible approval state
- Complexity: low-medium
- Expected tests: 401, 403, 404, ownership, audit, invalid payload
- Behavioral impact: strong security improvement with small surface area
- Why first: smallest high-risk batch, reuses the same ownership model already proven by `POST /api/human-input/[id]/answer`

2. Agent-task execution and approval controls
- Routes: `run`, `approve`, `reject`, `request-revision`
- Risk reduced: execution and review state changes; possible raw output exposure
- Complexity: medium
- Expected tests: 401, 403, 404, task ownership, execution-state, redaction, audit
- Behavioral impact: large security gain, but more moving parts than human-input
- Why not first: broader executor interactions and more redaction surface than the human-input family

3. Workflow execution controls
- Routes: `engagements/[id]/run`, `engagements/[id]/abort`, `engagements/[id]/workflow/resume`, `projects/[id]/run`
- Risk reduced: workflow orchestration and state transition control
- Complexity: medium
- Expected tests: 401, 403, 404, workflow-state, pause/resume, audit
- Behavioral impact: high, but likely to need more coordination across orchestration helpers
- Why not first: slightly larger integration footprint than human-input lifecycle mutations

Selected first batch: Human-input lifecycle mutations (`B1`).

## 10) Test Strategy

Every batch should add or extend tests in the same style as the merged foundation:
- Unauthenticated requests return `401`
- Authenticated but unauthorized requests return `403`
- Cross-tenant concealment returns `404` where policy requires hiding existence
- Safe generic response bodies only
- Audit events are recorded for allow/deny decisions
- Sensitive values never appear in responses
- Route-specific ownership rules are verified using the helper model from `services/test-auth.ts`

Recommended test layering:
1. Batch-specific route tests
2. Security helper regression tests where shared behavior changes
3. Existing full-suite regression rerun only at PR boundary

## 11) Acceptance Criteria

ALPHA-052 can move toward completion only when all are true:
1. All 40 remaining route files are assigned to batches and implemented.
2. Each protected route has explicit authn/authz and safe error handling.
3. Cross-client and cross-engagement concealment works as intended.
4. Audit events continue to be best-effort and non-failing.
5. Required negative tests exist for every hardened route family.
6. Issue #42 is closed or explicitly incorporated into the final acceptance gate.
7. Issue #43 remains separate and non-blocking.

## 12) Remaining Limitations

- ALPHA-052-01 and ALPHA-052-02 B1 now cover six hardened handlers.
- Public/reference routes remain intentionally open until a later batch decides otherwise.
- No production identity provider is configured.
- Some current routes still rely on resource existence checks without caller identity checks.
- Route-hardening should stay batched to avoid regressing the stable foundation.

## 13) Route Coverage Dashboard

| Metric | Value |
| --- | ---: |
| Total route files | 46 |
| Already hardened handlers | 6 |
| Remaining route files | 40 |
| Critical-risk families | Human-input mutations, agent-task controls, workflow controls, demo seed, project run |
| High-risk families | File upload/download, export download, lifecycle mutation routes |
| Medium-risk families | Tenant-bound reads and detail surfaces |
| Low-risk families | Public/reference metadata endpoints |
| Current warning count | 10 |
| Warning classification | Pre-existing, non-blocking |
