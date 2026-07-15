# FullSendOS Self-Documentation Review System

## Purpose

The Self-Documentation Review System helps keep FullSendOS's own knowledge base aligned with the actual codebase.

As FullSendOS moves quickly, documentation can drift, go stale, or be deferred. This system provides a repeatable, deterministic way to:

- Inventory all known docs
- Inventory all known implementation areas
- Detect mismatches, gaps, and stale content
- Produce a structured review report
- Recommend documentation updates for human approval

## What It Does NOT Do

- It does NOT automatically rewrite governance documents.
- It does NOT make live AI calls during review.
- It does NOT expose secrets, runtime data, or private information.
- It does NOT commit recommended changes without human approval.

## How to Run

```bash
npm run docs:review
```

This produces a generated report at:

```
docs/generated/DOCUMENTATION_REVIEW_REPORT.md
```

The report is advisory only.

## Finding Types

| Type | Meaning |
|---|---|
| `stale-doc` | A doc may be outdated relative to current implementation |
| `missing-doc` | A doc that should exist does not |
| `implementation-undocumented` | Code exists but no doc covers it |
| `roadmap-status-mismatch` | Roadmap item status may not match implementation state |
| `architecture-mismatch` | Architecture doc may conflict with code |
| `deferred-doc-needed` | A doc was explicitly deferred during implementation |
| `decision-record-needed` | An architectural decision should be recorded |
| `duplicate-or-overlapping-doc` | Two docs cover the same topic |
| `terminology-inconsistency` | Inconsistent language across docs |

## Severity Levels

| Severity | Meaning |
|---|---|
| `high` | Requires immediate attention; may affect correctness or safety |
| `warning` | Should be reviewed; likely stale or missing |
| `info` | Informational; worth noting but not urgent |

## Human Approval Guardrails

The self-documentation review system is advisory only.

Before any recommended documentation change is committed:

1. A human must review the finding.
2. A human must approve the recommended action.
3. The change must be submitted as a standard PR with review.
4. No documentation that contains safety, compliance, or architectural commitments should be automatically rewritten.

This applies to all finding types, including `info` severity.

## Future AI-Assisted Doc Drafting

When AI-assisted doc drafting is added in a future slice:

1. The AI may draft proposed documentation text.
2. The draft must be presented to a human for review before committing.
3. The human must approve or reject the draft.
4. The approval must be recorded in the PR.
5. The AI draft must be clearly labeled as AI-generated.

This system does not currently include AI drafting. The review is deterministic and keyword-based only.

## Implementation Files

| File | Purpose |
|---|---|
| `services/doc-review/types.ts` | TypeScript types for doc review entities |
| `services/doc-review/inventory.ts` | Static inventory of docs and implementation areas |
| `services/doc-review/reviewer.ts` | Deterministic reviewer logic |
| `services/doc-review/renderer.ts` | Markdown report renderer |
| `scripts/docs-review.ts` | CLI script entry point |
| `services/self-documentation-review.test.ts` | Tests |
