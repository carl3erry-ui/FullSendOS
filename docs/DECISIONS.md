# Decisions

This document derives from [PROJECT_CONTEXT](PROJECT_CONTEXT.md).

If this file conflicts with [PROJECT_CONTEXT](PROJECT_CONTEXT.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md) wins.

## Purpose

Maintain concise architecture decision records (ADRs) linked to constitution principles.

## ADR Format

- ADR ID
- Date
- Status (proposed, accepted, superseded)
- Context
- Decision
- Consequences
- PROJECT_CONTEXT principle mapping

## ADR-001

Date: 2026-07-12

Status: accepted

Context: Model outputs can violate strict department contracts.

Decision: Keep strict schema validation and introduce deterministic normalization before validation.

Consequences:

- Better resilience to shape mismatches.
- Validation integrity preserved.
- Requires targeted normalization tests per department contract.

PROJECT_CONTEXT mapping:

- Departments are the product.
- Deliverables are professional work product.

## ADR-002

Date: 2026-07-12

Status: accepted

Context: Long-running workflow requests can outlast client timeouts.

Decision: Persist running state as source of truth, reject duplicate active runs server-side, and recover UI state through polling persisted project status.

Consequences:

- Reduced duplicate expensive runs.
- Honest execution lifecycle in UI.
- Alpha polling model remains simple and deterministic.

PROJECT_CONTEXT mapping:

- Engagement orchestration reliability.
- Work product quality and delivery consistency.

## ADR-003

Date: 2026-07-12

Status: accepted

Context: Feature-first growth risks architectural drift away from consulting-firm operating semantics.

Decision: Standardize v1.0 domain model around business objects (Client, Engagement, Department, DepartmentRun, WorkProduct, Deliverable, IndustryPack, ClientMemory) and treat Project as transitional implementation terminology.

Consequences:

- Better long-term consistency for APIs, persistence, and UI.
- Easier expansion to packs and reusable department contracts.
- Requires migration discipline to avoid introducing feature-local data models.

PROJECT_CONTEXT mapping:

- Departments are the product.
- Workflow is orchestration.
- Client memory is strategic moat.

## ADR-004

Date: 2026-08-26

Status: accepted

Context: FullSendOS Alpha persists project, workflow-pause, agent-task, execution, and related coordination state in local files. Filesystem exclusive-create primitives can fence workflow-resume claims across processes only when every serving process uses the same durable filesystem. The repository does not currently govern a shared-volume, multi-instance deployment topology or a distributed transactional coordination store. PR #48 predates the approved B3B durable resume-operation design and does not implement its required phase and forward-recovery lifecycle.

Decision: The current file-backed Alpha runtime is approved only as a single serving instance using a persistent durable filesystem. All serving requests must execute through that one application instance. Project, workflow-pause, task/execution, and future resume-operation state must use persistent storage that survives ordinary process restart.

Multi-instance serving is prohibited for any environment that relies on the current file-backed state or filesystem claim model. The current persistence architecture is not approved as production-grade multi-instance coordination.

Before multi-instance or production-grade horizontal deployment, FullSendOS must implement and validate a shared durable coordination mechanism that provides atomic fencing and recovery across instances. This ADR does not select the eventual persistence technology.

B3B impact:

- The approved B3B design is [ALPHA_052_B3B_RESUME_TRANSACTION_DESIGN](alpha/security/ALPHA_052_B3B_RESUME_TRANSACTION_DESIGN.md).
- A replacement B3B implementation may use filesystem exclusive claims only under this single-instance Alpha constraint.
- B3B requires a durable resume-operation record, claim-ID fencing, forward recovery after execution may have begun, and explicit `recovery_required` handling for ambiguity.
- PR #48 is superseded, must not merge, and is preserved only as historical working evidence.
- Replacement implementation must start from clean `main` and follow the approved transaction design.

Required now:

- Single serving instance for the current Alpha file-backed runtime.
- Durable persistent filesystem for Alpha state.
- B3B durable resume-operation record.
- Claim-ID fencing.
- Forward recovery after execution may have begun.
- Explicit `recovery_required` handling for ambiguity.

Required before production or multi-instance release:

- Shared multi-instance-safe workflow coordination.
- Cross-instance atomic fencing.
- Codified production deployment topology.
- Persistence durability and recovery validation.
- Production concurrency testing.

Not approved:

- Automatic takeover.
- Claim lease expiry.
- Ambiguous automatic retry.
- Automatic external task, provider, or tool re-execution.
- Automatic workflow-continuation replay.
- New public pause states.
- Mutating recovery endpoints.

Future architecture decision: the eventual shared persistence and coordination technology.

Consequences:

- Controlled Alpha, internal, and pilot use may run on one serving instance with persistent file-backed state.
- Horizontal scaling of the current runtime is a release violation.
- Deployment and recovery checks must verify the single-instance topology and durable state path.
- FullSendOS must not be described as multi-instance production-ready while this ADR governs persistence.

PROJECT_CONTEXT mapping:

- Workflow is orchestration.
- Client memory is strategic moat.
- Work product must remain durable, reviewable, and governed.
