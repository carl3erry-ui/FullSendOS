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

- Deliverable export to DOCX or PPTX is not implemented.
- Client-facing evidence portal views are not implemented.

## Deliverable Export Foundation

Supported export formats in this phase:

- Markdown
- HTML
- Plain text
- JSON export package

Export packages include:

- Executive report
- One-page summary
- Deck outline
- Sources used
- Assumptions
- Open questions
- Human confirmations
- Confidence summary
- Recommended next actions
- Export metadata

Export safety rules:

- Do not include raw provider payloads.
- Do not include private prompts.
- Do not include stack traces.
- Do not include storage paths or local file paths.
- Do not include full extracted document text.

Future delivery roadmap:

- Add PDF, DOCX, and PPTX generation on top of this foundation.
- Add share/email and client portal delivery workflows in later slices.

## Export File Downloads + Branded Templates

The export foundation now supports direct file download and built-in branded templates.

Download routes:

- `GET /api/projects/[id]/exports/[exportId]/download`
- `GET /api/engagements/[id]/exports/[exportId]/download`

Download behavior:

- Validates engagement/project exists.
- Validates export exists and belongs to that engagement/project.
- Returns `Content-Disposition: attachment` with a safe filename.
- Returns format-specific content type.

Supported content types:

- Markdown: `text/markdown; charset=utf-8`
- HTML: `text/html; charset=utf-8`
- Text: `text/plain; charset=utf-8`
- JSON: `application/json; charset=utf-8`
- PDF: `application/pdf`

Built-in templates:

- `executive-standard`
- `client-ready`
- `investor-brief`
- `internal-review`

Template API:

- `GET /api/deliverable-templates`

Export generation accepts:

- `format`
- `templateId` (optional; defaults to `executive-standard`)

Filename rules:

- Uses engagement/client slug + deliverable marker + format + date.
- Removes unsafe characters.
- Uses format-correct file extension.
- Bounded length to keep filenames portable.

Current limitations:

- No DOCX/PPTX generation yet.
- No template editor yet.
- No Client Portal delivery yet.
- No email/share flow yet.

## Binary PDF Export Foundation

This phase adds binary PDF generation on top of the existing deliverable export foundation.

PDF generation approach:

- Uses server-side `pdfkit` in API/runtime-safe Node execution.
- Reuses existing template-driven section mapping and safety filters.
- Generates consultant-grade, readable baseline PDFs without external network services or browser-only rendering.

Why `pdfkit` was chosen:

- Stable Node compatibility for Next.js route handlers.
- No headless browser requirement.
- Predictable binary output suitable for file-backed JSON persistence.

Persistence behavior:

- PDF bytes are stored as base64 in the existing export record `content` field.
- Export metadata includes a binary indicator (`encoding: base64`, media type `application/pdf`, inline preview excluded).
- No local storage paths are exposed through API responses.

Detail and download behavior:

- PDF detail route returns safe metadata and marks inline preview unavailable.
- PDF download route validates ownership first, decodes base64 after validation, and returns binary bytes.
- Download response keeps `Content-Disposition: attachment` and safe filename rules.

Safety behavior:

- Excludes private prompts, raw provider payloads, API keys, stack traces, hidden reasoning, storage paths, and full extracted document text.
- Does not execute HTML/scripts and does not fetch remote assets.

Limitations in this slice:

- Inline PDF preview is intentionally not supported.
- PDF layout is a professional foundation, not a final design system.
- DOCX/PPTX export is intentionally out of scope.

Future follow-ups:

- Richer template-specific PDF layouts and branding controls.
- DOCX export pipeline for editable client handoffs.
- PPTX/deck generation pipeline.
- Client Portal delivery workflow.
- Email/share delivery workflow.

## Future Follow-ups

- Add professional export pipelines for executive deliverables.
- Add client portal evidence views with governed redaction controls.

## Migration Guidance

When touching existing project-based code paths:

- Prefer introducing engagement-compatible fields over one-off project fields.
- Keep backward compatibility where needed, but orient new logic around engagement semantics.
