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

## Data Room Access (Slice 15)

- Client workspace includes a visible Client Data Room entry point.
- Engagement workspace includes a visible Data Room section in the work product viewer.
- Empty state copy:
  - No files have been added to this data room yet.
  - Upload financials, brand assets, legal documents, real estate files, or other source materials.
- Upload action is available from Data Room panel controls.

## Evidence-Based Work Products (Slice 15)

Work product deliverables can include evidence metadata and evidence-backed summary sections.

Evidence model includes:

- Sources Used
- Assumptions (separate from verified facts)
- Open Questions
- Human Confirmations
- Confidence Summary
- Missing Evidence and recommended next actions

Evidence status semantics include:

- user_provided
- human_confirmed
- retrieved_from_data_room
- agent_inferred
- unverified
- assumption
- open_question

## Safety and Exposure Rules

- Do not expose storage paths.
- Do not expose full extracted document text.
- Do not expose raw provider payloads, stack traces, or debug diagnostics.
- Inferred facts remain unverified until confirmed through human input or explicit evidence.

## Hardware Brewery Behavior

- Missing address does not hard-fail work product generation.
- Missing address is surfaced as an open question and/or human input request.
- Confidence reflects unresolved evidence gaps.

## Lifecycle Compatibility Status

- Client archive/restore/soft-delete controls are preserved.
- Engagement archive/restore/soft-delete controls are preserved.
- Archived/deleted records are hidden by default unless lifecycle visibility filters are enabled.

## Current Limitations

- Deliverable export to PDF, DOCX, or PPTX is not implemented.
- Client-facing evidence portal views are not implemented.

## Future Follow-ups

- Add professional export pipelines for executive deliverables.
- Add client portal evidence views with governed redaction controls.

## Migration Guidance

When touching existing project-based code paths:

- Prefer introducing engagement-compatible fields over one-off project fields.
- Keep backward compatibility where needed, but orient new logic around engagement semantics.
