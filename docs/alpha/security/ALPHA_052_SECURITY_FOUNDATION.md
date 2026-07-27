# ALPHA-052-01 Security Guardrail Foundation

Date: 2026-07-27
Status: COMPLETE (ALPHA-052 remains IN PROGRESS)
Branch: feature/alpha-052-01-security-guardrail-foundation

## 1) Architecture

ALPHA-052-01 introduces a provider-neutral server-side security boundary for route handlers:

- Canonical actor model in `lib/security/types.ts`
- Authentication resolver in `lib/security/authentication.ts`
- Deny-by-default authorization helpers in `lib/security/authorization.ts`
- Safe security error semantics in `lib/security/security-response.ts`
- Security decision audit sink in `lib/security/security-audit.ts`
- Route guard orchestration in `lib/security/route-guards.ts`

The implementation is intentionally narrow and does not attempt to harden all routes in this batch.

## 2) Actor Model

Canonical actor:

- `id`
- `role`
- `clientId` (scoped actor boundary where applicable)
- `displayName` (optional)
- `authenticated: true`

Roles:

- `internal_admin`
- `internal_operator`
- `client_user`

## 3) Role Permissions

- `internal_admin`: may access internal/admin operations and cross-client resources.
- `internal_operator`: may access client-owned resources only within assigned `clientId` scope.
- `client_user`: may access only resources within assigned `clientId` scope.

Client users are explicitly denied internal admin operations and cross-client resources.

## 4) Authentication Contract

Primary interface:

- `getAuthenticatedActor(request)`

Rules:

- Missing identity fails closed.
- Malformed identity fails closed.
- Arbitrary unverified identity headers are not trusted.
- Development/test adapter is hard-disabled in production mode.
- Development/test adapter requires an explicit `FULLSENDOS_AUTH_DEV_TEST_SECRET` with minimum length 32; no default fallback secret is used.
- Oversized authorization header/token/segment inputs are rejected before signature verification.
- If no production identity provider is configured, protected routes return unauthorized.

Deterministic development/test adapter:

- Signed bearer token format (`fst1.<payload>.<signature>`)
- HMAC verification with `FULLSENDOS_AUTH_DEV_TEST_SECRET`
- Enabled in test mode and optionally in development with `FULLSENDOS_AUTH_DEV_TEST_ENABLED=1`
- Not a production login or IdP system

## 5) Authorization Contract

Primary helpers:

- `requireInternalAdmin(actor)`
- `requireClientAccess(actor, clientId)`
- `requireEngagementAccess(actor, engagementId)`

Policy is deny-by-default.

Ownership behavior:

- Engagement authorization derives client ownership from stored project relationships.
- Client-scope checks enforce actor-to-client boundaries server-side.
- Client-user cross-tenant access is concealed as not found when appropriate.

## 6) Error-Response Policy

Standardized behavior:

- `401` for missing/invalid authentication
- `403` for authenticated actor lacking permission
- `404` for concealed cross-tenant resource responses where policy requires existence hiding

Responses are intentionally generic and do not expose provider internals, stack traces, or identity-debug payloads.

## 7) Security Audit Policy

Security decision events capture:

- timestamp
- actor ID
- actor role
- action
- resource type
- resource ID
- decision (`allow`/`deny`)
- non-sensitive reason code

Events explicitly do not include tokens, cookies, credentials, or request-body payloads.
Audit writes are best-effort: sink failures are isolated and cannot change authn/authz route outcomes.
Current default sink storage is process-local in-memory and non-durable.

## 8) Test Authentication Design

Deterministic test support:

- `services/test-auth.ts` issues signed test tokens via the shared auth module.
- Primitive tests verify missing/malformed identity denial, valid role authentication, and production adapter disablement.
- Tests verify invalid-signature rejection, oversized header/token denial, and explicit secret requirement behavior.
- Route guard tests verify internal-operator denial for internal-only routes and audit-sink-failure isolation.

Security tests added:

- `services/security-foundation.test.ts`
- `services/security-route-guards.test.ts`

## 9) Representative Routes Protected

This batch protects exactly three representative routes:

1. Client-owned read route
- `GET /api/clients/[clientId]/data-room/files`

2. Client-owned mutation route
- `POST /api/human-input/[id]/answer`

3. Internal-only route
- `POST /api/demo/seed`

These routes now demonstrate:

- unauthenticated denial
- authorized access
- cross-client denial/concealment
- internal-role enforcement

## 10) Production Provider Integration Boundary

This batch does not select or implement a production identity provider.

Current production behavior for protected routes:

- If no production provider integration exists, authentication fails closed and protected routes return `401`.

Follow-up work must integrate the chosen production identity/session provider into `getAuthenticatedActor`.

## 11) Known Limitations

- ALPHA-052-01 hardened three representative routes; ALPHA-052-02 B1 later added confirm/reject/skip.
- No universal route coverage yet.
- No end-user login UI or account lifecycle is implemented.
- Existing unprotected routes remain for subsequent hardening batches.
- Build currently reports 10 Turbopack broad-pattern warnings in this environment.

## 12) Remaining Route-Hardening Phases

Recommended next sequence:

1. High-risk mutation controls
- Human-input confirm/reject/skip are now protected in ALPHA-052-02 B1
- Agent-task approve/reject/request-revision/run
- Workflow run/abort/resume

2. Sensitive client/engagement data reads
- Data room and export/detail surfaces

3. Internal operations surfaces
- Additional administrative endpoints requiring strict internal role checks

4. Full negative test matrix and final ALPHA-052 completion evidence
