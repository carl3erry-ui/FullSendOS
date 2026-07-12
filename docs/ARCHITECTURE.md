# Architecture

## High-level flow

Dashboard -> API Route -> Workflow Engine -> Department Executor -> AI Provider -> Grok -> Structured Result -> Project Store -> Dashboard Refresh

## Rule

UI must not call AI clients directly.

## Layering Rules

- Workflow engine does not depend on provider-specific request/response formats.
- Department executor handles dependencies and department execution order.
- AI provider interface abstracts model vendors.
- Grok client is one provider implementation.

## Target Structure

- app/
- components/
- types/
- schemas/
- services/
- workflow/
- departments/
- ai/
- contracts/
- reports/
