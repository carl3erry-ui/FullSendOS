# FullSendOS 2.0 Scaffold

This repository is now scaffolded for a clean module-first architecture.

## Folder Layout

- `app/` - Next.js App Router entrypoints and route handlers.
- `components/` - Shared UI primitives and feature components.
- `lib/` - App-agnostic utilities and cross-cutting helpers.
- `types/` - Shared TypeScript type declarations.
- `hooks/` - Reusable React hooks.
- `services/` - Internal service layer and adapters.
- `ai/` - AI orchestration interfaces and provider wrappers.
- `contracts/` - Inter-module contracts and boundary definitions.
- `schemas/` - Validation schemas and canonical data shapes.

## Rules For This Stage

- Structure only, no new business logic.
- Migrate one module at a time into its target folder.
- Keep old implementation paths until each module is fully moved.
