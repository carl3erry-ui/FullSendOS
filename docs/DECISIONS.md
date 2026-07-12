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
