# FullSendOS Usability + Intake Audit

## Scope
Audit date: 2026-07-15  
Branch: feature/usability-intake-foundation

Reviewed surfaces:
1. Dashboard
2. Clients list
3. Client detail/workspace
4. Engagement creation
5. Engagement detail/workspace
6. Data Room
7. AI Workforce area
8. Deliverables area
9. Export/download UI
10. Empty states

## What Works
- Dashboard already consolidates engagements, AI Workforce, and Human Input views.
- Client and engagement lifecycle controls (archive/restore/delete) are present and safe.
- Engagement workspace already has structured executive/analysis/department/evidence views.
- Data Room backend supports upload, metadata persistence, foldering, and safe parsing metadata.
- Export backend supports markdown/html/text/json/pdf with safe download routes and content-type handling.

## What Feels Clunky
- Clients and engagements are embedded in one large page with weak flow guidance from blank state to first value.
- Client workspace lacked explicit onboarding/baseline layer and always-on next-step direction.
- Data Room upload form was functional but low-clarity for policy controls (AI-approved/sensitive).
- Export tab was always reachable even when deliverables were unavailable, creating confusion.

## What Is Unclear
- Where a new user should start after creating a client.
- What baseline context is required before running AI workflow.
- Which sequence to follow: onboarding vs upload vs engagement run vs exports.

## Broken or Incomplete Flows (Before This Branch)
- No formal ClientBaseline model persisted per client.
- No onboarding wizard for business/customer/goal/context intake.
- Data Room UI did not clearly expose safe workflow policy flags during upload.
- Export UI lacked explicit unavailable state when deliverables were not yet generated.

## Data Room Upload Status
- Backend status: implemented and tested.
- UI status before: basic upload present, but minimal guidance and policy controls.
- UI status now: improved with folder context, upload success feedback, and policy toggles.

## Export UI Status
- Backend status: implemented and tested across formats including PDF.
- UI status before: export controls visible without strong availability gating.
- UI status now: button gating/message when deliverables are not ready and clearer status language.

## Where Onboarding Should Live
- Primary: client workspace card section labeled "Company Baseline" with embedded wizard.
- Secondary: dedicated route at /clients/new/onboarding using clientId query for focused intake.

## Recommended Build Sequence
1. Establish ClientBaseline schema and file-store persistence.
2. Add baseline API on /api/clients/[clientId]/baseline.
3. Introduce onboarding wizard (embedded + full-page route).
4. Add workspace step guidance and empty-state hierarchy.
5. Tighten Data Room upload UX around policy + feedback.
6. Tighten export availability messaging.
7. Run tests/build and document results.
