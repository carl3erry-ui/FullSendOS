# Contributing

This guide derives from [PROJECT_CONTEXT](PROJECT_CONTEXT.md).

If this file conflicts with [PROJECT_CONTEXT](PROJECT_CONTEXT.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md) wins.

## Workflow

- Keep changes scoped to one concern.
- Run build before each commit.
- Avoid UI and engine changes in the same commit.

## Architecture guardrails

- Preserve layer boundaries.
- Keep UI unaware of model/provider details.

## Governance guardrails

- Scope issues and commits by consulting capability whenever possible.
- Reference the relevant PROJECT_CONTEXT principle in PR descriptions or commit notes.
