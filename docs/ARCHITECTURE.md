# Architecture

This document defines implementation details derived from [PROJECT_CONTEXT](PROJECT_CONTEXT.md).

If this file conflicts with [PROJECT_CONTEXT](PROJECT_CONTEXT.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md) wins.

## High-level flow

Dashboard -> API Route -> Workflow Engine -> Department Executor -> AI Provider -> Grok -> Structured Result -> Project Store -> Dashboard Refresh

## Business-Object Orientation

Architecture should be organized around domain entities:

- Client
- Engagement
- Department
- DepartmentRun
- WorkProduct
- Deliverable
- IndustryPack
- ClientMemory

Feature modules and UI pages are views over these entities, not the primary design center.

## Contract Versioning

Domain contracts should be explicitly versioned to support safe evolution.

- Engagement contract version
- Department contract version
- Work product schema version
- Deliverable schema version

Migration rule:

- New capabilities should map to existing business objects first.
- Avoid adding ad hoc structures that bypass the domain model.

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

## Transitional Naming

Project may remain in selected UI/API surfaces temporarily.

Canonical domain target remains Engagement.

## API Compatibility Layer

- Canonical public routes: /api/engagements
- Legacy compatibility routes: /api/projects
- Engagement routes should delegate to shared existing handlers during this phase.
- Internal project schema, store, and orchestrator modules remain in place until an approved migration milestone.
