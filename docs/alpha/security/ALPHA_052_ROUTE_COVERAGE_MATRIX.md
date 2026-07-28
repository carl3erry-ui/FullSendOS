# ALPHA-052 Route Coverage Matrix

Date: 2026-07-27
Status: Planning artifact
Scope: All current `app/api/**/route.ts` handlers in the repository

Legend:
- `FULL` = already fully protected in the merged foundation
- `PARTIAL` = some resource/concealment checks exist, but caller auth is not yet complete
- `NONE` = no meaningful authn/authz guard yet

## Clients

| Route | Methods | Status | Role policy | Ownership source | Batch | Test status | Evidence | PR | Final acceptance state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/clients` | `GET`, `POST` | `NONE` | Later batch: internal admin/internal operator for list/create; no client-user writes | Client record and list filters | `B8` | `TBD` | Public list/create surface, no auth helpers | `TBD` | Pending ALPHA-052-08 |
| `/api/clients/[clientId]` | `GET`, `PATCH` | `PARTIAL` | Tenant-scoped internal access; client-user only if a future client portal case needs it | Path `clientId` + stored client record | `B7` | `TBD` | `loadClient`, `updateClientLifecycle` | `TBD` | Pending ALPHA-052-08 |
| `/api/clients/[clientId]/baseline` | `GET`, `PUT`, `PATCH` | `PARTIAL` | Internal admin/internal operator for write; client-user only for future client-safe read if ever exposed | Stored client baseline keyed by `clientId` | `B7` | `TBD` | `loadClient`, baseline store access | `TBD` | Pending ALPHA-052-08 |
| `/api/clients/[clientId]/data-room` | `GET` | `PARTIAL` | Tenant-scoped internal and client-safe read only | Client ID + stored client data-room records | `B7` | `TBD` | `loadClient`, `loadClientDataRoom` | `TBD` | Pending ALPHA-052-08 |
| `/api/clients/[clientId]/data-room/documents` | `GET` | `PARTIAL` | Tenant-scoped read only | Client ID + document store | `B7` | `TBD` | `loadClient`, `listDataRoomDocuments` | `TBD` | Pending ALPHA-052-08 |
| `/api/clients/[clientId]/data-room/documents/[documentId]` | `GET` | `PARTIAL` | Tenant-scoped read only | Client ID + document ID | `B7` | `TBD` | `loadClient`, `getDataRoomDocument` | `TBD` | Pending ALPHA-052-08 |
| `/api/clients/[clientId]/data-room/files` | `GET`, `POST` | `PARTIAL` | `GET` is already fully protected; `POST` still open in current code | Client ID + file metadata | `B4` | `PASS` for `GET` only; `POST` `TBD` | `GET` protected in PR #41; `POST` remains open | `#41` | `GET protected now; POST pending B4` |
| `/api/clients/[clientId]/data-room/files/[fileId]` | `GET`, `PATCH`, `DELETE` | `PARTIAL` | Tenant-scoped file read/write for internal admin/operator; client-user rules to be determined by client-safe policy | Client ID + file ID + file metadata store | `B4` | `TBD` | `loadClient`, file reference store | `TBD` | Pending ALPHA-052-05 |
| `/api/clients/[clientId]/data-room/files/[fileId]/process` | `POST` | `PARTIAL` | Tenant-scoped file processing only | Client ID + file ID | `B4` | `TBD` | `loadClient`, `processDataRoomFile` | `TBD` | Pending ALPHA-052-05 |
| `/api/clients/[clientId]/data-room/folders` | `GET` | `PARTIAL` | Tenant-scoped read only | Client ID + folder store | `B7` | `TBD` | `loadClient`, folder listing | `TBD` | Pending ALPHA-052-08 |
| `/api/clients/[clientId]/human-input` | `GET` | `NONE` | Future batch should gate by client scope | Client ID query parameter | `B7` | `TBD` | Delegates to human-input list without auth | `TBD` | Pending ALPHA-052-08 |

## Engagements

| Route | Methods | Status | Role policy | Ownership source | Batch | Test status | Evidence | PR | Final acceptance state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/engagements` | `GET`, `POST` | `NONE` | List/create should later be internal-scoped; no client-user authority | List filters + created project clientId | `B8` | `TBD` | Delegates directly to project store | `TBD` | Pending ALPHA-052-09 |
| `/api/engagements/[id]` | `GET`, `PATCH` | `PARTIAL` | Internal admin/internal operator only in later batch; no client-user authority | Stored project `clientId` and project ID | `B7` | `TBD` | `loadProject`, lifecycle update helpers | `TBD` | Pending ALPHA-052-08 |
| `/api/engagements/[id]/abort` | `POST` | `PARTIAL` | Internal admin/internal operator only | Stored project ownership | `B3` | `TBD` | `loadProject`, `failWorkflowRun` | `TBD` | Pending ALPHA-052-04 |
| `/api/engagements/[id]/data-room` | `GET`, `POST` | `PARTIAL` | Internal admin/internal operator within scope; client-user only if explicitly made client-safe later | Stored project client ownership and engagement ID | `B5` | `TBD` | `loadProject`, `resolveClientIdForEngagement` | `TBD` | Pending ALPHA-052-05 |
| `/api/engagements/[id]/data-room/[fileId]` | `GET`, `PATCH`, `DELETE` | `PARTIAL` | Internal admin/internal operator within scope | Project ownership plus file ownership | `B5` | `TBD` | `loadProject`, data-room file store | `TBD` | Pending ALPHA-052-05 |
| `/api/engagements/[id]/data-room/[fileId]/process` | `POST` | `PARTIAL` | Internal admin/internal operator within scope | Project ownership plus file ownership | `B5` | `TBD` | `loadProject`, file processing service | `TBD` | Pending ALPHA-052-05 |
| `/api/engagements/[id]/data-room/documents` | `GET` | `PARTIAL` | Scoped read only | Project ownership + engagement ID | `B7` | `TBD` | `loadProject`, document list | `TBD` | Pending ALPHA-052-08 |
| `/api/engagements/[id]/data-room/folders` | `GET` | `PARTIAL` | Scoped read only | Project ownership + engagement ID | `B7` | `TBD` | `loadProject`, folder listing | `TBD` | Pending ALPHA-052-08 |
| `/api/engagements/[id]/exports` | `GET`, `POST` | `PARTIAL` | Export listing/creation should be internal-scoped | Project ownership + export store | `B6` | `TBD` | `loadProject`, export store access | `TBD` | Pending ALPHA-052-07 |
| `/api/engagements/[id]/exports/[exportId]` | `GET` | `PARTIAL` | Scoped export detail read | Project ownership + export ID | `B6` | `TBD` | `loadProject`, export detail lookup | `TBD` | Pending ALPHA-052-07 |
| `/api/engagements/[id]/exports/[exportId]/download` | `GET` | `PARTIAL` | Scoped download only; filenames must stay safe | Project ownership + export ownership | `B5` | `TBD` | `loadProject`, `getDeliverableExport` | `TBD` | Pending ALPHA-052-05 |
| `/api/engagements/[id]/human-input` | `GET` | `PARTIAL` | Scoped read only | Project ownership + engagement ID | `B7` | `TBD` | `listHumanInputRequests({ engagementId })` | `TBD` | Pending ALPHA-052-08 |
| `/api/engagements/[id]/run` | `POST` | `PARTIAL` | Internal admin/internal operator only | Project ownership | `B3` | `TBD` | `loadProject`, workflow runner | `TBD` | Pending ALPHA-052-04 |
| `/api/engagements/[id]/workflow/resume` | `POST` | `PARTIAL` | Internal admin/internal operator only | Project ownership + pause state ownership | `B3` | `TBD` | `loadProject`, `loadPauseState`, `findActivePauseForProject` | `TBD` | Pending ALPHA-052-04 |

## Human Input

| Route | Methods | Status | Role policy | Ownership source | Batch | Test status | Evidence | PR | Final acceptance state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/human-input` | `GET`, `POST`, `PATCH` | `NONE` | Future batch should require scoped access or internal-only policy depending on action | List/filter payloads; no caller identity yet | `B8` | `TBD` | List/create/update helpers without auth | `TBD` | Pending ALPHA-052-09 |
| `/api/human-input/[id]` | `GET`, `PATCH` | `PARTIAL` | Scoped read/update; future batch should distinguish client-safe reads from internal edits | Human-input request ID + stored request ownership | `B7` | `TBD` | `getHumanInputRequest`, `updateHumanInputRequest` | `TBD` | Pending ALPHA-052-08 |
| `/api/human-input/[id]/answer` | `POST` | `FULL` | `internal_admin`, `internal_operator`, `client_user` within request ownership scope | Stored request `clientId` + `engagementId` | `B0` | `PASS` | PR #41 foundation tests | `#41` | Protected now |
| `/api/human-input/[id]/confirm` | `POST` | `FULL` | `internal_admin` and `client_user` within stored request ownership scope; `internal_operator` denied until a real assignment model exists | Stored request `clientId` + `engagementId` | `B1` | `PASS` | `feature/alpha-052-02-human-input-mutations`, `services/security-route-guards.test.ts` | `TBD` | Protected now |
| `/api/human-input/[id]/reject` | `POST` | `FULL` | `internal_admin` and `client_user` within stored request ownership scope; `internal_operator` denied until a real assignment model exists | Stored request `clientId` + `engagementId` | `B1` | `PASS` | `feature/alpha-052-02-human-input-mutations`, `services/security-route-guards.test.ts` | `TBD` | Protected now |
| `/api/human-input/[id]/skip` | `POST` | `FULL` | `internal_admin` and `client_user` within stored request ownership scope; `internal_operator` denied until a real assignment model exists | Stored request `clientId` + `engagementId` | `B1` | `PASS` | `feature/alpha-052-02-human-input-mutations`, `services/security-route-guards.test.ts` | `TBD` | Protected now |

## Agent Tasks

| Route | Methods | Status | Role policy | Ownership source | Batch | Test status | Evidence | PR | Final acceptance state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/agent-tasks` | `GET`, `POST` | `NONE` | Future batch should require internal scoping; client-user access is not intended | Task metadata + project/engagement references | `B8` | `TBD` | Task creation/listing without auth | `TBD` | Pending ALPHA-052-09 |
| `/api/agent-tasks/[id]` | `GET` | `PARTIAL` | Scoped internal read only; redact raw provider output | Task ID + task store metadata | `B2` | `TBD` | `globalTaskStore.loadTask`, paused-workflow lookup | `TBD` | Pending ALPHA-052-03 |
| `/api/agent-tasks/[id]/run` | `POST` | `FULL` | `internal_admin` allowed after stored ownership and linkage checks; `internal_operator` denied until assignment model exists; `client_user` denied (internal execution control) | Stored task `projectId` + stored project `clientId`; task/project linkage integrity enforced before execution | `B2A` | `PASS` | `app/api/agent-tasks/[id]/run/route.ts`, `lib/security/agent-task-authorization.ts`, `services/security-route-guards.test.ts` | `#45` | Protected now (ALPHA-052-03A) |
| `/api/agent-tasks/[id]/approve` | `POST` | `FULL` | `internal_admin` allowed after stored ownership and linkage checks; `internal_operator` denied until assignment model exists; `client_user` denied | Stored task `projectId` + stored project `clientId`; task/project linkage integrity enforced before mutation | `B2B` | `PASS` | `app/api/agent-tasks/[id]/approve/route.ts`, `lib/security/agent-task-authorization.ts`, `services/security-route-guards.test.ts` | `TBD` | Protected now (ALPHA-052-03B) |
| `/api/agent-tasks/[id]/reject` | `POST` | `FULL` | `internal_admin` allowed after stored ownership and linkage checks; `internal_operator` denied until assignment model exists; `client_user` denied | Stored task `projectId` + stored project `clientId`; task/project linkage integrity enforced before mutation | `B2B` | `PASS` | `app/api/agent-tasks/[id]/reject/route.ts`, `lib/security/agent-task-authorization.ts`, `services/security-route-guards.test.ts` | `TBD` | Protected now (ALPHA-052-03B) |
| `/api/agent-tasks/[id]/request-revision` | `POST` | `FULL` | `internal_admin` allowed after stored ownership and linkage checks; `internal_operator` denied until assignment model exists; `client_user` denied | Stored task `projectId` + stored project `clientId`; task/project linkage integrity enforced before mutation | `B2B` | `PASS` | `app/api/agent-tasks/[id]/request-revision/route.ts`, `lib/security/agent-task-authorization.ts`, `services/security-route-guards.test.ts` | `TBD` | Protected now (ALPHA-052-03B) |

## Projects

| Route | Methods | Status | Role policy | Ownership source | Batch | Test status | Evidence | PR | Final acceptance state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/projects` | `GET`, `POST` | `NONE` | Future batch should make list/create internal-scoped | List filters + created project clientId | `B8` | `TBD` | Project list/create without auth | `TBD` | Pending ALPHA-052-09 |
| `/api/projects/[id]` | `GET`, `PATCH` | `PARTIAL` | Internal admin/internal operator only in a future batch | Stored project `clientId` and project ID | `B6` | `TBD` | `loadProject`, lifecycle update helpers | `TBD` | Pending ALPHA-052-07 |
| `/api/projects/[id]/run` | `POST` | `PARTIAL` | Internal admin/internal operator only | Stored project ownership | `B3` | `TBD` | `loadProject`, orchestration runner | `TBD` | Pending ALPHA-052-04 |
| `/api/projects/[id]/exports` | `GET`, `POST` | `PARTIAL` | Scoped internal export access only | Project ownership + export store | `B6` | `TBD` | `loadProject`, export builder/store | `TBD` | Pending ALPHA-052-07 |
| `/api/projects/[id]/exports/[exportId]` | `GET` | `PARTIAL` | Scoped export detail read | Project ownership + export ID | `B6` | `TBD` | Export lookup helper | `TBD` | Pending ALPHA-052-07 |
| `/api/projects/[id]/exports/[exportId]/download` | `GET` | `PARTIAL` | Scoped download only; safe filenames required | Project ownership + export ownership | `B6` | `TBD` | Export download helper | `TBD` | Pending ALPHA-052-07 |

## Public / Reference

| Route | Methods | Status | Role policy | Ownership source | Batch | Test status | Evidence | PR | Final acceptance state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/agents` | `GET` | `NONE` | Public-safe metadata only; no auth gate intended in Alpha | None | `B8` | `TBD` | Public agent metadata and workforce catalog | `TBD` | Public-safe |
| `/api/deliverable-templates` | `GET` | `NONE` | Public-safe template catalog only | None | `B8` | `TBD` | Sanitized template list | `TBD` | Public-safe |
| `/api/demo/seed` | `POST` | `FULL` | `internal_admin` only | Internal demo state | `B0` | `PASS` | PR #41 security tests | `#41` | Protected now |
