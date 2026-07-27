# ALPHA-052 Authentication and Authorization Readiness Review

Date: 2026-07-27
Author: Engineering (readiness review only)
Status: Review complete, implementation not started

## 1) Executive Summary

ALPHA-052 is not release-ready. The codebase has strong client-safe output filtering patterns, but it does not yet have a real authentication or authorization baseline for client-facing access.

Key result:
- Central auth middleware: not present
- Session/identity primitive in API routes: not present
- API route handlers reviewed: 46
- Fully protected routes: 0
- Partially protected routes (resource-existence and ownership-shape checks only): 27
- Unprotected routes (no identity check, no actor authorization): 19

Highest risk:
- URL-addressable client and engagement resources can be accessed or mutated without a verified caller identity.

## 2) Scope and Constraints

This review is documentation and readiness scoping only.

No runtime implementation changes were made.
No middleware, dependency, route behavior, or auth logic was added in this review.

## 3) Evidence Inventory

Primary reviewed areas:
- Client portal surface and client-safe filtering
- API route inventory under app/api
- Route-level ownership checks (loadClient, loadProject, engagement-export ownership checks)
- Existing docs explicitly stating deferred real auth

Key evidence files:
- app/client-portal/[clientId]/page.tsx
- lib/client-portal/client-portal-access.ts
- docs/CLIENT_PORTAL_ACCESS_LAYER.md
- docs/CLIENT_PORTAL_ACCESS_RESULTS.md
- app/api/**/*.ts route handlers (46 total)

Notable findings from evidence:
- Client portal docs explicitly state real client auth is deferred.
- Access model is safety-filter oriented, not identity-enforcement oriented.
- Resource checks are common, caller identity checks are absent.

## 4) Route Protection Matrix (By Family)

Coverage summary by route family:

| Route Family | Route Count | Current Protection State | Notes |
| --- | ---: | --- | --- |
| /api/projects and /api/projects/[id]/* | 6 | Partial | Uses project/client existence checks and export ownership checks; no caller authn/authz. |
| /api/engagements and /api/engagements/[id]/* | 14 | Partial to Unprotected | Many routes proxy to project guards, but no caller authn/authz; human-input listing by engagement id is unprotected. |
| /api/clients and /api/clients/[clientId]/* | 11 | Partial to Unprotected | Data-room and baseline routes validate client existence; list and some human-input surfaces have no identity gate. |
| /api/human-input/* | 6 | Unprotected | Request listing and state-changing actions currently accept requests without actor authorization. |
| /api/agent-tasks/* | 6 | Unprotected | Task read/run/approval-state actions have no authenticated actor boundary. |
| /api/agents | 1 | Unprotected | Public-safe metadata, but still no explicit identity gate. |
| /api/deliverable-templates | 1 | Unprotected | Read-only template catalog without identity gate. |
| /api/demo/seed | 1 | Unprotected | Demo workspace seeding endpoint exposed without actor authn/authz. |

Detailed route classification totals:
- Partial: 27
- Unprotected: 19
- Fully protected: 0

## 5) Threat Model (Alpha)

Assets at risk:
- Client and engagement data
- Deliverable exports and download surfaces
- Human-input decisions that influence workflow progression
- Agent task execution and approval state

Threat actors:
- Unauthenticated internet user
- Authenticated but unauthorized tenant/user
- Internal operator acting outside intended role permissions

Primary attack paths:
- Insecure direct object reference via predictable ids in URL paths
- Cross-client data access through missing actor-to-client binding
- Unauthorized state changes (approve/reject/revise, answer/confirm/reject/skip)
- Uncontrolled demo seeding and operational endpoint invocation

Security properties currently weak/missing:
- Strong authentication (who is caller)
- Strong authorization (what caller can access/change)
- Tenant boundary enforcement (which client/engagement scope caller belongs to)
- Consistent deny-by-default policy enforcement layer

## 6) Gap Analysis

Critical gaps:
1. No centralized auth enforcement layer (middleware or shared route guard).
2. No server-side session or token verification in route handlers.
3. No actor-to-resource authorization checks for client, engagement, human-input, or agent-task actions.
4. No role matrix implemented for owner/admin/operator/client/auditor personas.

High gaps:
1. Route-by-route authorization behavior is inconsistent and mostly structural.
2. Client portal uses URL-based access without authenticated session binding.
3. Mutation endpoints for workflow controls and approvals are callable without identity controls.

## 7) Recommended ALPHA-052 Architecture

Target auth baseline:
1. Identity layer
- Session or token verification for all client-facing and mutating API surfaces.

2. Authorization layer
- Central policy function with deny-by-default.
- Explicit permission checks per route action (read, write, approve, run, export, download).

3. Resource scoping layer
- Bind actor identity to allowed clientIds and engagementIds.
- Enforce this binding before business logic execution.

4. Audit layer
- Record principal id, role, action, target resource id, decision (allow/deny), timestamp.

## 8) Role Model Recommendation

Minimum roles for Alpha:
- platform_admin: internal operations and governance
- operator: engagement execution and workflow operations
- reviewer: human approval/review decisions
- client_viewer: client portal read-only surfaces for own tenant scope
- client_approver: optional client-side approval actions (if enabled in Alpha)

Permission examples:
- client_viewer cannot access internal task, workflow control, or cross-client resources
- reviewer can perform approval actions but only in assigned scope
- operator can run/abort/resume only within authorized tenant/project scope

## 9) Phased Implementation Plan

Phase 0: Security contract and policy definitions
- Define principal schema, session claims, role/permission map, and resource-scope contract.

Phase 1: Middleware and shared guard primitives
- Add centralized auth verification and a shared authorize() helper.
- Establish deny-by-default for sensitive API groups.

Phase 2: Route hardening by risk order
- First harden mutation endpoints: human-input actions, agent-task actions, run/abort/resume, demo seed.
- Then harden data and export read paths.

Phase 3: Client portal binding
- Require authenticated client session and enforce clientId ownership binding for portal data fetches.

Phase 4: Negative testing and audit evidence
- Add unauthorized/forbidden/cross-tenant test matrix and audit log verification.

## 10) Test Plan (Required for ALPHA-052 Completion)

Required test categories:
1. Authentication required tests
- Unauthenticated requests return 401 on protected routes.

2. Authorization tests
- Authenticated user without permission returns 403.

3. Tenant isolation tests
- Cross-client and cross-engagement access attempts return deny responses.

4. Mutation protection tests
- Unauthorized run/abort/resume, approval, and human-input actions are blocked.

5. Portal boundary tests
- Client portal only resolves data for session-bound client identity.

6. Audit tests
- Allow/deny decisions emit security audit entries with actor and target context.

## 11) Acceptance Criteria for ALPHA-052

ALPHA-052 can be marked COMPLETE only when all are true:
1. Central auth verification is active on all in-scope client-facing and mutating routes.
2. Role-based authorization checks are enforced consistently.
3. Tenant scoping is enforced for client and engagement resources.
4. Unauthorized/cross-tenant negative tests are present and passing.
5. Portal access requires authenticated identity and tenant binding.
6. Security review evidence is documented and linked.

## 12) Migration and Preview Considerations

- Keep existing client-safe filtering behavior; layer authn/authz before handlers.
- Roll out by route group to reduce regression risk.
- Preserve demo usability with explicitly controlled demo access policy rather than open seed endpoints.
- Maintain current typecheck/test/build gates while adding auth tests.

## 13) Open Questions

1. Which identity provider/session mechanism is authoritative for Alpha (internal session, JWT, external IdP)?
2. Should demo seed route be removed from runtime or restricted to platform_admin only?
3. Is client_approver required in Alpha, or is client_viewer sufficient for release?
4. What is the canonical mapping from internal user to allowed clientIds/engagementIds?
5. What security audit retention requirement applies for Alpha evidence?

## 14) First Implementation Task (When PMO Approves Build Start)

Task: ALPHA-052-01 Security Guardrail Foundation

Definition:
- Introduce centralized auth middleware and shared authorize() guard utility.
- Apply to highest-risk mutation routes first:
  - /api/human-input/[id]/answer
  - /api/human-input/[id]/confirm
  - /api/human-input/[id]/reject
  - /api/human-input/[id]/skip
  - /api/agent-tasks/[id]/run
  - /api/agent-tasks/[id]/approve
  - /api/agent-tasks/[id]/reject
  - /api/agent-tasks/[id]/request-revision
  - /api/projects/[id]/run
  - /api/engagements/[id]/abort
  - /api/engagements/[id]/workflow/resume
  - /api/demo/seed

Required outputs:
- Guard utilities
- Route integration
- 401/403 negative tests
- Security evidence update in ALPHA docs

## 15) Readiness Verdict

ALPHA-052 readiness review is complete.

Implementation readiness verdict: YES (ready to begin implementation planning).

Release-readiness verdict for ALPHA-052 itself: NO (authn/authz baseline not implemented yet).
