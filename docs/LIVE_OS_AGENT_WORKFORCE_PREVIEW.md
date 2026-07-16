# Live OS Agent Workforce Preview

## Purpose

This preview validates that FullSendOS feels like a live AI consulting operating system in the Owner/Admin workspace.

The focus is visibility and control, not architecture rewrite.

Owner/Admin users should be able to see:

- Grok provider status (safe label only)
- selected agents
- workflow state
- collaboration trace visibility
- human approval gates
- Leadership Doctrine version
- deliverable readiness and export availability

Client Portal must remain client-safe and must not show internal traces.

## How to Preview

1. Start dashboard: `npm run dev`
2. Open an engagement workspace in Owner/Admin
3. In the engagement workspace, verify:
   - Agent Workforce Status section
   - Collaboration Trace tab
   - CollaborationTracePanel content
4. Open the demo client portal (`/client-portal/[clientId]`) and verify no internal trace content appears.

## What Should Be Visible (Owner/Admin)

- Agent Workforce Status section
  - Provider status (Configured/Not configured/Unknown/Live verification not run)
  - Workflow status
  - Human review status
  - Client-readiness status
  - Export availability
  - Selected agent team
- Collaboration Trace tab
  - Static/LIVE trace label
  - Team and selection reasons
  - Help requests
  - Escalations
  - Approval gates
  - Confidence rationale
  - Leadership Doctrine version

## Static Trace Preview vs Live Workflow Trace

In this slice, CollaborationTracePanel is wired using a deterministic collaboration preview built from engagement metadata and team-selection rules.

- **Static Collaboration Preview**: deterministic preview when persisted trace data is unavailable.
- **Live Workflow Trace**: to be shown when persisted workflow trace data is available in a future slice.

This avoids claiming persisted live trace where none exists.

## Grok Provider Status Rules

Provider status labels are safe and non-sensitive:

- `Configured`
- `Not configured`
- `Unknown`
- `Live verification not run`

No API keys or secret env values are shown.

## Client Portal Safety Rules

Client Portal must never expose:

- CollaborationTracePanel
- internal traces
- agent notes
- raw provider output
- admin controls
- private reasoning

Client Portal remains client-safe and focused on status + deliverables.

## Known Limitations

- Collaboration trace data is deterministic preview, not persisted live trace storage.
- Provider status is inferred from safe run metadata only.
- Client Portal remains v1 access layer (no production auth/tenant isolation yet).
- Secure production portal hardening is deferred to the roadmap epic:
  - **Secure Client Portal Production Foundation**.
