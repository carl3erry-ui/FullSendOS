# Client Portal Access Layer — Results

## What Was Implemented

### Access Model (`lib/client-portal/client-portal-access.ts`)

- `ClientPortalAccessLevel` — 5 levels from `none` to `full-client-preview`
- `ClientPortalVisibility` — typed visibility config with enforced internal guards (`canViewInternalTrace: false`, `canViewAgentNotes: false`, `canViewRawProviderOutput: false`)
- `getDefaultClientPortalVisibility()` — v1 default grants full-client-preview with safe defaults
- `isClientSafeField()` — returns false for 14 internal field names and prefixes
- `filterClientSafeEngagement()` — converts raw engagement to `ClientSafeEngagement`
- `filterClientSafeDeliverable()` — converts raw deliverable data to `ClientSafeDeliverable` with readiness labels, disclaimers, and truncated preview

### Client Portal Page (`app/client-portal/[clientId]/page.tsx`)

- Route: `/client-portal/[clientId]`
- Sections: Overview, Deliverables, Data Room, Feedback
- Overview shows engagement list with progress bars and readable status labels
- Deliverables shows readiness badge, disclaimer, safe preview, and download links (when approved)
- Data Room shows document list from baseline and upload-coming-soon placeholder
- Feedback shows placeholder form (UI-only in v1)
- Demo portal label: shows "Demo Client Portal — Fictional sample data only" banner for demo clients
- Does not render CollaborationTracePanel
- Does not expose agent notes, internal traces, or raw provider output

### Demo Portal Entry (`app/components/project-dashboard.tsx`)

- "View Client Portal" link appears on demo client cards (`DEMO-APEX-BREW` prefix)
- Links directly to `/client-portal/{clientId}`

### Self-Documentation Update

- `Client Portal / External Access Layer` removed from `UPCOMING_EPICS`
- `CLIENT_PORTAL_ACCESS_LAYER.md` and `CLIENT_PORTAL_ACCESS_RESULTS.md` added to `DOC_INVENTORY`
- `OS_TEST_DRIVE_PREVIEW.md` added to `DOC_INVENTORY`
- `IMPLEMENTED_FEATURES` updated with `client portal` and `client-safe visibility`
- `self-documentation-review.test.ts` test updated to match new UPCOMING_EPICS state
- `npm run docs:review` passes after updates

## Tests

File: `services/client-portal.test.ts` — 16 new tests covering:

- Default visibility denies internal trace, agent notes, raw provider output
- Default visibility allows status, deliverables, review status
- `isClientSafeField` blocks 10 internal field names, allows 6 safe field names
- `filterClientSafeEngagement` preserves readable status, marks deliverable readiness correctly
- `filterClientSafeDeliverable` preserves readiness label, provides safe preview text, shows internal-draft for draft engagements
- Safe deliverable does not expose raw provider fields
- No live xAI calls in client portal tests

## Validation

- Tests: **505 passing, 0 failing**
- Build: **12 pages compiled** (new `/client-portal/[clientId]` route present)
- docs:review: **37 docs inventoried, 20 findings (0 high)**

## Known Limitations

- File upload deferred — requires authentication + cloud storage
- Feedback submission deferred — UI placeholder only
- No real client authentication — portal is accessible by URL in v1
- Download access is gated by `isClientApproved` but not by session auth yet
- Multi-tenant client accounts not implemented
- Client portal does not yet show engagement department-level progress details
- `CollaborationTracePanel` is still not wired into the dashboard (separate future ticket)

## Recommended Next Issue

Wire `CollaborationTracePanel` into the Admin Dashboard

Next branch: `feature/collaboration-trace-dashboard-wiring`
