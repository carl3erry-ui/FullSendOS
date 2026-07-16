# FullSendOS Client Portal Access Layer

## Purpose

The Client Portal Access Layer separates the internal Owner/Admin workspace from the external Client Portal.

FullSendOS has two sides:

```
Owner/Admin Workspace = the kitchen
Client Portal         = the dining room
```

The Owner/Admin side can see everything: agent collaboration traces, internal drafts, AI reasoning, repair cycles, review gates, and operational controls.

The Client Portal shows only clean, approved, client-safe status and deliverables.

## What the Client Portal Can Show

- Client name and status
- Engagement list and progress (without internal details)
- Readable status labels (e.g., "Ready for review")
- Deliverable readiness label and disclaimer
- One-page summary preview (truncated, if review-ready)
- Export/download links (if deliverables are approved)
- Data Room upload status and document list
- Baseline engagement purpose (if available)
- Feedback placeholder

## What the Client Portal Must NEVER Show

- Internal agent collaboration traces
- Raw provider payloads or AI reasoning
- Private collaboration notes
- Unapproved internal drafts without labels
- Admin-only controls (archive, delete, lifecycle actions)
- Agent task output or agent-level details
- Help request logs or guardrail events
- Debug information or stack traces
- Secrets, environment values, or storage paths

## V1 Scope

This is a foundation layer only.

| Feature | V1 Status |
|---|---|
| Client portal route (`/client-portal/[clientId]`) | Implemented |
| Client-safe access model (`ClientPortalVisibility`) | Implemented |
| Engagement status display | Implemented |
| Deliverable readiness labels | Implemented |
| Safe deliverable preview | Implemented |
| Export download links (when approved) | Implemented |
| Data Room status display | Implemented |
| Feedback placeholder | Implemented (UI-only) |
| Demo portal entry link | Implemented |
| File upload | Deferred to v2 (requires auth + cloud storage) |
| Feedback submission | Deferred to v2 |
| Real client auth | Deferred |
| Multi-tenant client accounts | Deferred |

## Client-Safe Access Levels

```
none                — No access
status-only         — Status and progress only
deliverables-view   — Can view deliverables
deliverables-download — Can view and download
full-client-preview — Full safe portal (v1 default)
```

Default v1 behavior is `full-client-preview` with enforced internal guards.

## Deliverable Rules

Every deliverable shown in the client portal includes:

- Readiness label (Internal Draft / Needs Human Review / Client-Ready Draft / Approved for Client)
- Disclaimer explaining current review status
- Download links only if deliverable is approved

AI-generated deliverables default to **Needs Human Review** until explicitly approved.

## Data Room Rules

Data Room status is shown as a count and document type list. Full upload and access management is deferred until authentication is in place.

## Approval Rules

Deliverable downloads are only exposed when the readiness status is `approved-for-client`. All other states show the appropriate disclaimer and withhold download access.

## Future Auth/Permissions Roadmap

- Token-based or session-based client authentication
- Per-client access control with explicit permission grants
- Multi-engagement visibility scoping
- Client-facing upload portal with cloud storage
- Engagement approval workflow (client can approve/reject)
- Notification system for deliverable readiness
- Audit log of client portal access

## Route

```
/client-portal/[clientId]
```

## Implementation Files

| File | Purpose |
|---|---|
| `lib/client-portal/client-portal-access.ts` | Typed access model, filters, and helpers |
| `app/client-portal/[clientId]/page.tsx` | Client portal page |
| `services/client-portal.test.ts` | Tests |
