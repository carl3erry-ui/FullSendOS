# FullSendOS Use Readiness

## 1. Current readiness status

- Overall classification: `PARTIAL`
- Local operator usage (Carl, controlled environment): `READY`
- Team/internal demo usage: `READY`
- Client-facing production usage: `NOT READY`
- Hosted preview verification status: `NOT AVAILABLE`

## 2. What works today

- Engagement dashboard and workspace flow.
- Client lifecycle and engagement lifecycle controls.
- Human Input / Action Center requests and resolution flow.
- Client Data Room upload/list/document metadata APIs with safe response filtering.
- Agent workforce task APIs and execution framework.
- Workflow run, pause/approval, resume, and recovery paths.
- Evidence-backed work products with assumptions/open-questions/human-confirmations model.
- Deliverable template API and template-aware exports.
- Export generation for `markdown`, `html`, `text`, `json`, and `pdf`.
- PDF base64 persistence and safe PDF download routes.
- Safety-focused exclusion of private prompts, raw payloads, and storage paths from exported outputs.

## 3. What is usable now

- Running FullSendOS locally as an operating system for real workflow iteration.
- Creating clients and engagements.
- Running workflows in deterministic fallback mode when no live xAI key is configured.
- Running live verification scripts when explicit smoke flags and key are present.
- Producing and downloading client-ready deliverables (including PDF) after workflow output exists.

## 4. What requires configuration

- xAI key configuration for live model output.
- Model selection defaults for consistency across routes and agent definitions.
- Explicit toggle for live provider smoke scripts.
- Local data storage path awareness and backup discipline.
- Environment-mode awareness (`NODE_ENV`, fallback behavior).

## 5. Required environment variables

| Variable | Required? | Purpose | Safe example | Notes |
| --- | --- | --- | --- | --- |
| `XAI_API_KEY` | Yes for live intelligence, no for local fallback | Auth for xAI provider calls | `XAI_API_KEY=replace-with-real-key` | Required in production routes; if absent in development, fallback can keep flow testable. |
| `XAI_MODEL` | Recommended | Primary model for project run route and legacy provider path | `XAI_MODEL=grok-4.5` | Keep aligned with `XAI_DEFAULT_MODEL` to avoid surprises. |
| `PORT` | Optional | Server port | `PORT=3000` | App scripts already bind to 3000 by default. |

## 6. Optional environment variables

| Variable | Required? | Purpose | Safe example | Notes |
| --- | --- | --- | --- | --- |
| `XAI_DEFAULT_MODEL` | Optional | Default model for agent definitions and xAI provider wrapper | `XAI_DEFAULT_MODEL=grok-4.5` | Used by agent definitions and live verification utilities. |
| `XAI_BASE_URL` | Optional | Override xAI API base endpoint | `XAI_BASE_URL=https://api.x.ai/v1` | Keep default unless operating through a controlled endpoint. |
| `XAI_DEV_FALLBACK` | Optional | Enables deterministic fallback behavior in development when key is missing | `XAI_DEV_FALLBACK=true` | Useful for demos/tests without live calls. |
| `LIVE_PROVIDER_SMOKE` | Optional | Explicit opt-in gate for live verification scripts | `LIVE_PROVIDER_SMOKE=1` | Must be set with `XAI_API_KEY` for verify scripts. |
| `XAI_MAX_OUTPUT_TOKENS` | Optional | Legacy xAI client output cap tuning | `XAI_MAX_OUTPUT_TOKENS=3000` | Use only when output size tuning is needed. |
| `WORKFLOW_PAUSE_DIR_OVERRIDE` | Optional | Override workflow pause file path (mainly test/debug) | `WORKFLOW_PAUSE_DIR_OVERRIDE=/tmp/fullsendos-workflow-pauses` | Do not use shared unsafe paths in real use. |

## 7. Local setup instructions

1. Install Node.js 20+.
2. Clone the repository and enter the project folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Set `XAI_API_KEY` for live model usage.
6. Set `XAI_MODEL` and optionally `XAI_DEFAULT_MODEL` to the same model value.
7. Leave `XAI_DEV_FALLBACK=true` for local reliability if live key is unavailable.
8. Start the app with `npm run dev`.
9. Open `http://localhost:3000`.

## 8. First-run instructions (non-technical operator)

1. Open the dashboard.
2. Create a client in the Clients workspace.
3. Create an engagement linked to that client and enter the objective.
4. Open engagement workspace.
5. Review Human Input / Action Center and answer blocking requests.
6. Upload relevant files into Data Room and verify they appear.
7. Check AI Workforce panel to confirm available agents.
8. Run workflow for the engagement.
9. Wait until executive deliverables appear in workspace.
10. Review evidence, assumptions, and open questions before sharing output.
11. Open Export Deliverables section.
12. Generate Markdown/HTML/Text/JSON if needed.
13. Select template, generate PDF, and download.

## 9. Real-use operating procedure

1. Create or select client.
2. Create engagement with clear objective and known constraints.
3. Add verified facts only; avoid speculative client claims.
4. Upload source files to Data Room and tag/describe them.
5. Resolve blocking Human Input requests before running workflow.
6. Run workflow and monitor status.
7. Review work products with emphasis on evidence coverage.
8. Confirm assumptions and open questions with humans before client sharing.
9. Use AI Workforce tasks for targeted follow-up analysis when needed.
10. Generate a template-aligned client-ready export.
11. Generate and download PDF deliverable.
12. Perform final safety and quality review before external distribution.
13. Archive or continue engagement according to lifecycle status.

Manual trust checks before sharing:

- Confirm key conclusions are evidence-backed.
- Confirm open questions are not silently presented as facts.
- Confirm no private prompts/raw payloads/path leaks appear.
- Confirm objective and requested deliverables match client scope.
- Confirm human-approved edits are reflected in final export.

## 10. Demo script

Scenario: `Hardware Brewery Acquisition Review`

1. Open dashboard.
2. Create client: Hardware Brewery.
3. Create engagement with acquisition-review objective.
4. Point out Human Input / Action Center and explain blocking questions.
5. Point out Data Room and upload-able source structure.
6. Point out AI Workforce and available agents.
7. Run workflow.
8. Open engagement workspace and show evidence-backed deliverables.
9. Show assumptions/open questions/human confirmations.
10. Open Export Deliverables.
11. Select `client-ready` template and generate PDF.
12. Download PDF and confirm safe filename/content-type behavior.
13. Explain safety boundaries (no raw payloads/private prompts/storage paths).
14. Close with roadmap: DOCX/PPTX, portal delivery, sharing workflows.

## 11. Safety checklist before sharing output

- Confirm no private prompts are visible.
- Confirm no raw provider payload is visible.
- Confirm no API key or auth token is visible.
- Confirm no stack trace/internal diagnostics are visible.
- Confirm no storage paths/local filesystem paths are visible.
- Confirm no full extracted Data Room text dump is visible.
- Confirm assumptions/open questions are clearly separated from verified facts.
- Confirm human review has occurred for high-impact client claims.

## 12. Known limitations

- No authentication/authorization layer for multi-tenant client-facing deployment.
- Local file-backed storage only; no built-in backup/restore automation.
- No DOCX/PPTX export yet.
- No client portal delivery path yet.
- No email/share workflow yet.
- Hosted preview and production deployment evidence is not fully codified.

## 13. Demo-blocking issues

- None for local demo in a controlled environment.

## 14. Production-blocking issues

- `production-blocking`: Missing auth and access control for external/client-facing deployment.
- `production-blocking`: No formal backup/restore and data retention policy automation.
- `production-blocking`: No hardened deployment checklist (domain/HTTPS/secret manager/ops monitoring) implemented in-repo.

## 15. Recommended next fixes

- `confusing but usable`: Add explicit in-UI messaging that exports require completed work product first.
- `confusing but usable`: Surface a first-run checklist panel in dashboard.
- `production-blocking`: Add documented backup/restore playbook for `data/` directories.
- `production-blocking`: Add deployment hardening guide (HTTPS, secret manager, host policy).

## 16. Recommended next product features

- `future feature`: DOCX export foundation.
- `future feature`: PPTX/deck generation.
- `future feature`: Client portal delivery and controlled sharing.
- `future feature`: Email/share workflow with approval gates.
- `future feature`: Role-based auth and audit policy controls.

## 17. Launch-readiness score

- Score: `78/100`
- Interpretation: Strong local operating capability with good workflow/export safety, but production usage is blocked by missing auth/security/deployment hardening controls.

## Route and architecture inventory snapshot

- Dashboard entry: `app/page.tsx` -> `ProjectDashboard`.
- Main app shell: `app/components/project-dashboard.tsx` and `app/components/project-workspace.tsx`.
- Core APIs:
  - Clients: `/api/clients`, `/api/clients/[clientId]`
  - Engagements: `/api/engagements`, `/api/engagements/[id]`
  - Data Room: `/api/engagements/[id]/data-room/*`, `/api/clients/[clientId]/data-room/*`
  - Human Input: `/api/human-input/*`, `/api/engagements/[id]/human-input`
  - Agent workforce/tasks: `/api/agents`, `/api/agent-tasks/*`
  - Workflow: `/api/engagements/[id]/run`, `/api/engagements/[id]/workflow/resume`
  - Exports: `/api/engagements/[id]/exports/*`, `/api/projects/[id]/exports/*`
  - Templates: `/api/deliverable-templates`

## Before real use checklist

- [ ] Confirm `.env` exists and is populated for intended mode.
- [ ] Confirm `XAI_API_KEY` is set for live usage.
- [ ] Confirm `XAI_MODEL` and `XAI_DEFAULT_MODEL` are aligned.
- [ ] Confirm `NODE_ENV` and fallback expectation (`XAI_DEV_FALLBACK`) are intentional.
- [ ] Confirm data storage location (`data/*`) is known to operator.
- [ ] Confirm no secrets in logs during startup and workflow runs.
- [ ] Confirm backup approach for `data/` before real client usage.
- [ ] Confirm user access model for who can run/edit/share outputs.
- [ ] Confirm output review process (human review before client delivery).
- [ ] Confirm disclaimer/process for assumptions and unresolved questions.
- [ ] Confirm export safety checks before sharing files.
- [ ] Confirm Data Room file approval process (`approvedForAgentUse`) is followed.
- [ ] Confirm cost controls and expected live-provider usage pattern.
- [ ] Confirm provider fallback behavior for outages/missing key.
- [ ] Confirm deployment target (local, dev host, production host).
- [ ] Confirm domain/URL for intended operator environment.
- [ ] Confirm HTTPS for any non-local deployment.
- [ ] Confirm auth/security controls before client-facing rollout.

## Issue classification summary

- `demo-blocking`: none currently identified for local controlled demo.
- `production-blocking`: auth/access control, deployment hardening, backup policy.
- `confusing but usable`: export-before-work-product expectation not explicit enough for first-time operators.
- `cosmetic`: docs cross-linking can be improved further.
- `future feature`: DOCX/PPTX, portal delivery, email/share flow.
