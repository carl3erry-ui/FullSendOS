# Engagements

This document derives from [PROJECT_CONTEXT](PROJECT_CONTEXT.md).

If this file conflicts with [PROJECT_CONTEXT](PROJECT_CONTEXT.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md) wins.

## Purpose

Define the client-to-engagement model and lifecycle for consulting delivery.

## Canonical Object

Engagement is the canonical delivery object.

Project is a transitional implementation label and should not define long-term domain boundaries.

## Model

Client

- Engagement
  - Objectives
  - Department plan
  - Deliverables
  - Timeline
  - Decisions
  - Work product assets
- Engagement
- Engagement
- Client memory

## Entity Relationships

- A Client has many Engagements.
- An Engagement has many DepartmentRuns.
- A DepartmentRun produces one or more WorkProducts.
- WorkProducts contribute to one or more Deliverables.
- Engagement outputs can update ClientMemory after validation.

## Minimal v1.0 Engagement Contract

- id
- clientId
- objectives
- scope
- timeline
- status
- departments
- departmentRuns
- workProducts
- deliverables
- decisions
- risks
- createdAt
- updatedAt
- schemaVersion

## Engagement Lifecycle

- Created
- Running
- Needs review or completed
- Failed

## Required Engagement Data

- Client identifier
- Objective and constraints
- Requested deliverables
- Department execution plan
- Persisted status and run metadata
- Work product artifacts
- Decision log

## Authoritative Execution State

Persisted engagement state is authoritative.

UI and API behavior should recover from persisted state rather than transient request outcomes.

## Delivery Standard

Each engagement should end with validated work products and an executive-ready summary.

## Migration Guidance

When touching existing project-based code paths:

- Prefer introducing engagement-compatible fields over one-off project fields.
- Keep backward compatibility where needed, but orient new logic around engagement semantics.
