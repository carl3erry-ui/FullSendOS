# Agent Department Consolidation Plan (Planning Only)

## Purpose
Create a safe, phased plan to consolidate legacy department orchestration with the newer agent/provider execution model, without changing runtime architecture in this branch.

## Current State Summary
- Live workflow execution path is currently routed through:
  - `app/api/projects/[id]/run/route.ts`
  - `app/api/engagements/[id]/run/route.ts` (alias)
  - `src/orchestrator/orchestrator.js`
  - `src/services/xaiClient.js`
- Newer agent/provider execution modules exist but are not the active path for project/engagement workflow runs:
  - `ai/*`
  - `agents/*`

## Goals
- Unify workflow execution on one supported orchestration path.
- Preserve current behavior and data contracts during migration.
- Improve reliability, observability, and failure recovery.
- Keep human review and approval guardrails explicit.

## Non-Goals
- No immediate migration in this document.
- No direct runtime cutover from legacy orchestrator to agent executor in this branch.
- No changes to existing client-facing API contracts as part of this plan.

## Proposed Phased Approach

### Phase 0: Contract and Data Mapping
- Map project/engagement workflow run inputs/outputs to agent task/execution contracts.
- Document status model alignment (`draft`, `running`, `needs-review`, `complete`, `failed`).
- Define canonical error and timeout taxonomy across both paths.

### Phase 1: Shared Runtime Primitives
- Extract shared timeout, retry, and redacted-error utilities.
- Standardize safe logging schema for workflow progress events.
- Introduce common status normalization helpers consumed by UI/API/scripts.

### Phase 2: Adapter Layer (No Cutover)
- Add an adapter that allows orchestrator department steps to invoke provider-registry-backed model calls.
- Preserve existing orchestrator sequencing and persistence behavior.
- Validate parity using deterministic mocks and replay tests.

### Phase 3: Dual-Path Validation
- Enable side-by-side execution in non-production preview mode.
- Compare outputs, error rates, and timing characteristics.
- Keep legacy path as authoritative for writes until parity thresholds are met.

### Phase 4: Controlled Cutover
- Gate cutover behind explicit feature flags.
- Start with low-risk workflows and monitor regressions.
- Roll forward only after SLO and correctness criteria pass.

### Phase 5: Legacy Decommissioning
- Remove unused orchestration code after a burn-in window.
- Keep migration notes and architectural decision records updated.
- Finalize runbooks for incident response and rollback.

## Reliability and Safety Requirements
- Time-bound all model/provider requests.
- Ensure abort paths transition runs to safe terminal states.
- Never log prompt bodies, provider raw payloads, headers, or secrets.
- Return structured, sanitized errors for all API routes.
- Keep deterministic fallback behavior explicit in non-production contexts.

## Testing Strategy
- Unit tests for timeout, abort, and status normalization.
- Integration tests for run/abort lifecycle transitions.
- Golden tests for API response shape compatibility.
- Preview harness tests for safe terminal summaries.

## Decision Gates
- Contract parity approved by maintainers.
- Reliability parity demonstrated under mock and preview scenarios.
- Security review confirms no secret leakage paths.
- Human approval before production routing changes.

## Open Questions
- Which workflow statuses should be persisted as canonical terminal states long-term?
- Should agent execution records become the source of truth for department-level audit history?
- How should approval-gated steps be represented in project-level status for dashboard UX?
