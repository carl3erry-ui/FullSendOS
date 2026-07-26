# FullSendOS Alpha v1 Definition of Done

This document is the Alpha governing checklist for execution.

Precedence:
- The Constitution and Product Charter remain the long-term governing source.
- This Definition of Done governs Alpha completion and release decisions.

Traceability rule:
- Every GitHub Issue, branch, pull request, feature, bug fix, and product decision must map to one or more ALPHA requirement IDs in this document.

## 1. Alpha Mission

- ALPHA-001: Deliver a stable FullSendOS Alpha that can run one end-to-end engagement workflow with safe operational controls.
- ALPHA-002: Prove that executive work products can be generated, reviewed by humans, and exported without exposing internal-only data.
- ALPHA-003: Establish an auditable, repeatable execution process from client setup through demonstration and release approval.

## 2. Alpha Scope

- ALPHA-004: Alpha scope includes owner/admin workspace operations for client creation, engagement execution, workflow monitoring, and export generation.
- ALPHA-005: Alpha scope includes Data Room ingestion, document processing metadata, and retrieval-safe evidence support.
- ALPHA-006: Alpha scope includes Human Input and workflow pause/resume controls for approval-gated execution.
- ALPHA-007: Alpha scope includes client-safe portal views and outputs with enforced exclusion of internal traces and raw provider payloads.

## 3. Alpha Success Criteria

- ALPHA-008: A user can create or select a client, open an engagement, and run a workflow from draft to terminal status.
- ALPHA-009: Workflow terminal behavior supports complete/completed, needs-review, failed, and aborted with consistent operator-visible outcomes.
- ALPHA-010: Executive deliverables are present for completed engagement runs and can be reviewed in workspace views.
- ALPHA-011: Export generation and download for markdown, html, text, json, and pdf complete successfully for review-ready engagement output.
- ALPHA-012: Alpha release decisions are made by checklist evidence, not by ad hoc judgment.

## 4. Core User Journey

- ALPHA-013: Operator creates or selects a client and confirms client baseline context.
- ALPHA-014: Operator creates an engagement, provides objective and constraints, and enters workflow run path from dashboard.
- ALPHA-015: Operator resolves blocking human-input requests and then starts workflow execution.
- ALPHA-016: Operator monitors department progression, warnings, and terminal state.
- ALPHA-017: Operator reviews executive deliverables and evidence summary before sharing.
- ALPHA-018: Operator generates and downloads client-safe deliverables.

## 5. Functional Requirements

- ALPHA-019: Engagement run route must reject archived or deleted lifecycle records.
- ALPHA-020: Engagement run route must reject duplicate active runs and return safe conflict responses.
- ALPHA-021: Engagement run route must block when required human input is unresolved.
- ALPHA-022: Stale active runs must be detected and transitioned safely out of running state.
- ALPHA-023: Abort endpoint must safely handle both running and non-running engagements.
- ALPHA-024: Engagement detail APIs must return safe structured data for workspace and client-safe views.
- ALPHA-025: Data Room upload, list, file detail, process, and folders flows must work for client-owned records and engagement-linked access.
- ALPHA-026: Data Room document listing must return safe metadata and exclude unsafe internals.
- ALPHA-027: Human Input actions (answer, confirm, reject, skip) must support workflow continuation logic.
- ALPHA-028: Agent task APIs and workflow pause/resume integration must function for approval-gated steps.
- ALPHA-029: Deliverable export creation and download routes must enforce engagement ownership and safe attachment behavior.
- ALPHA-030: Dashboard and workspace views must parse API responses safely and avoid raw JSON parse crashes.

## 6. Technical Requirements

- ALPHA-031: Legacy active run architecture must remain explicit and documented: dashboard -> engagement/project run route -> orchestrator -> provider -> persistence.
- ALPHA-032: Runtime persistence under data directories must remain deterministic and observable for local Alpha operations.
- ALPHA-033: Build must pass on Alpha baseline branch with no compile-blocking failures.
- ALPHA-034: Test suite must pass on Alpha baseline branch.
- ALPHA-035: Standalone TypeScript typecheck must pass with zero errors before Alpha complete.
- ALPHA-036: Documentation review command must pass and required deferred Alpha documentation gaps must be resolved or explicitly accepted by PMO.
- ALPHA-037: Status-model consistency across legacy and typed workflow paths must be defined and enforced.
- ALPHA-038: Preview/demo runbook must produce a stable, repeatable operator flow.

## 7. AI Orchestration Requirements

- ALPHA-039: xAI request timeout protection with AbortController must be active in legacy run path.
- ALPHA-040: Configurable XAI_REQUEST_TIMEOUT_MS behavior must be supported with safe defaults.
- ALPHA-041: Timeout, network, and HTTP failures must return sanitized errors without secrets or prompt leakage.
- ALPHA-042: Raw provider payload logging and prompt leakage must be absent from runtime logs and surfaced responses.
- ALPHA-043: Department output validation and repair path must remain operational and bounded.
- ALPHA-044: Workflow summary logging must remain safe and high signal (summary-only telemetry).

## 8. Human Review Requirements

- ALPHA-045: Default deliverable readiness must be needs-human-review before client distribution.
- ALPHA-046: Human review checklist must be visible and usable in operating workflow.
- ALPHA-047: Client-safe release decisions must require explicit human approval criteria.
- ALPHA-048: Open questions and assumptions must remain explicit until resolved or acknowledged.

## 9. Client Portal Requirements

- ALPHA-049: Client portal must expose only client-safe engagement and deliverable information.
- ALPHA-050: Client portal must not expose internal trace, agent notes, raw provider output, or hidden reasoning fields.
- ALPHA-051: Client portal data-room and deliverable surfaces must honor client-safe filtering boundaries.
- ALPHA-052: Client-facing access control baseline (authentication and authorization) must be defined and implemented for Alpha release readiness.

## 10. Security Requirements

- ALPHA-053: API responses must exclude secrets, internal storage paths, full extracted text, and unsafe debug internals by default.
- ALPHA-054: Export outputs must include safety exclusions and avoid internal-only data leakage.
- ALPHA-055: Data retrieval paths must enforce approval and sensitivity constraints for agent context access.
- ALPHA-056: Runtime data handling policy for data directories must be documented for retention, backup, and non-commit behavior.
- ALPHA-057: Security review evidence for Alpha must include negative checks for raw payload and secret leakage paths.

## 11. Deliverables Required

- ALPHA-058: Executive report output exists for completed engagements.
- ALPHA-059: One-page summary output exists for completed engagements.
- ALPHA-060: Deck outline output exists for completed engagements.
- ALPHA-061: Export artifacts are available in at least markdown, html, text, json, and pdf.
- ALPHA-062: Deliverable readiness labeling and disclaimer text are present and applied.

## 12. Demonstration Requirements

- ALPHA-063: Demonstration must include full operator flow from client selection through engagement run and review.
- ALPHA-064: Demonstration must include Data Room interaction and safe evidence-backed output visibility.
- ALPHA-065: Demonstration must include export generation and download verification.
- ALPHA-066: Demonstration must include client portal boundary check showing internal data remains hidden.
- ALPHA-067: Demonstration must use safe logs and must not expose secrets or raw provider payloads.

## 13. Acceptance Criteria

- ALPHA-068: All COMPLETE/PARTIAL/NOT STARTED statuses are tracked in the Alpha Traceability Matrix with evidence links.
- ALPHA-069: All blocking PARTIAL or NOT STARTED items required for release are closed before Alpha complete declaration.
- ALPHA-070: PMO receives and approves release checklist evidence package.
- ALPHA-071: Final Alpha review confirms no runtime behavior regressions introduced by release hardening.

## 14. Out of Scope (Beta+)

- ALPHA-072: Marketplace and third-party extension ecosystem capabilities.
- ALPHA-073: Broad production multi-tenant scale optimization beyond Alpha validation targets.
- ALPHA-074: Non-essential automation epics that do not block Alpha mission completion.
- ALPHA-075: Additional industry packs beyond what is needed to validate the core Alpha journey.

## 15. Definition of Alpha Complete

Alpha is complete only when all required Alpha-gating items are satisfied:
- ALPHA-076: Core user journey requirements ALPHA-013 through ALPHA-018 are accepted with evidence.
- ALPHA-077: Functional and technical gates ALPHA-019 through ALPHA-038 are met, including passing typecheck and regression-safe validation.
- ALPHA-078: AI orchestration and safety gates ALPHA-039 through ALPHA-057 are met with test and review evidence.
- ALPHA-079: Deliverable and demonstration gates ALPHA-058 through ALPHA-067 are met in a PMO-observed or PMO-reviewed run.
- ALPHA-080: Acceptance and governance gates ALPHA-068 through ALPHA-071 are approved by PMO and product leadership.

If any ALPHA-gating item is unresolved, Alpha remains open.