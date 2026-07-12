# Departments

This document derives from [PROJECT_CONTEXT](PROJECT_CONTEXT.md).

If this file conflicts with [PROJECT_CONTEXT](PROJECT_CONTEXT.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md) wins.

## Purpose

Define department contracts, responsibilities, and expected work products for the consulting operating model.

## Core Principle

Departments are the product.

Workflow exists to orchestrate departments, not replace them.

## Department Contract Template

Each department package should define:

- Inputs
- Memory dependencies
- Tools
- Model routing policy
- Prompt contract
- Schema contract
- Validation behavior
- Deliverables
- Quality review checklist

## Initial Department Set

- Intelligence
- Market Research
- Finance
- Strategy
- Marketing
- Creative
- Website
- Operations
- Legal
- Investor Relations
- Executive Review

## Responsibility Boundaries

- Departments own output quality and schema adherence.
- Orchestration owns sequencing and dependency flow.
- Persistence owns engagement state and work product history.
- Model vendors remain implementation detail behind department interfaces.

## Work Product Requirement

Each department should produce reusable, reviewable consulting assets rather than opaque raw text blobs.

## Implementation Notes

- Prefer strict contracts and explicit validation.
- Normalize only from available model content.
- Do not fabricate client facts, evidence, or certainty.
- Preserve concise error reporting for recoverable review workflows.
