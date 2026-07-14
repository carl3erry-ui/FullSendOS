# Post-Guardrail OS Smoke Results

## 1) Branch

- `feature/post-guardrail-os-smoke`

## 2) Starting Main Commit

- `0c585a4` (`Merge pull request #16 from carl3erry-ui/fix/workflow-lifecycle-guardrail`)

## 3) PR #16 Presence

- Present on `main`: `YES`
- Guardrail code observed in `app/api/projects/[id]/run/route.ts` with `ENGAGEMENT_NOT_RUNNABLE` response for non-active lifecycle states.

## 4) Validation Results

- Tests: `PASS`
- Build: `PASS`
- Note: browser automation not available in this environment; route-level smoke was used.

## 5) Lifecycle Smoke Results

- Create lifecycle smoke client: `PASS`
- Create active engagement: `PASS`
- Active run behavior: `PASS` (run accepted and reached safe non-running state)
- Archive engagement: `PASS`
- Archived run blocked on project route: `PASS` (`409`, `ENGAGEMENT_NOT_RUNNABLE`, status=`archived`)
- Archived blocked response safe: `PASS`
- Restore engagement: `PASS`
- Restored engagement run via alias: `PASS`
- Soft-delete engagement: `PASS`
- Deleted run blocked on engagement alias: `PASS` (`409`, `ENGAGEMENT_NOT_RUNNABLE`, status=`deleted`)
- Deleted run blocked on project route: `PASS`
- Deleted blocked response safe: `PASS`
- Blocked runs do not mutate lifecycle status: `PASS`
- Blocked runs do not generate work products: `PASS` (deliverables unchanged during blocked attempts)

## 6) Mini OS Demo Smoke Results

Scenario client: `Hardware Brewery Post-Guardrail Smoke`

- Dashboard/app entry routes available: `PASS`
- Client creation: `PASS`
- Engagement creation: `PASS`
- Engagement workspace route: `PASS`
- Human Input route safe: `PASS`
- Data Room route safe: `PASS`
- AI Workforce routes available: `PASS`
- AI Workforce safe failure behavior: `PASS` (unknown agent returns safe `404`)
- Active workflow run: `PASS`
- Work products produced: `PASS`
- Template route: `PASS`

## 7) Export Results (Including PDF)

- Markdown export: `PASS`
- HTML export: `PASS`
- Text export: `PASS`
- JSON export: `PASS`
- PDF export: `PASS`
- Export history: `PASS`
- Export detail routes: `PASS`
- Download routes: `PASS`
- PDF download content type: `PASS` (`application/pdf`)
- Wrong-ownership download safety: `PASS` (`404`)

## 8) Safety Results

- Blocked lifecycle responses are structured and safe: `PASS`
- No stack traces exposed: `PASS`
- No storage paths exposed: `PASS`
- No raw provider payloads exposed: `PASS`
- No private prompts exposed: `PASS`
- No hidden reasoning exposed: `PASS`
- No API keys/tokens exposed: `PASS`
- No unsafe diagnostics exposed: `PASS`
- Export detail/download payload safety scans: `PASS`

## 9) Production-Blocking Lifecycle Issue Status

- Original production-blocking lifecycle issue: `RESOLVED`
- Confirmed: archived/deleted engagements are blocked from workflow execution and must be restored before running.

## 10) Remaining Demo-Blocking Issues

- None identified in this route-level smoke.

## 11) Remaining Production-Blocking Issues

- Auth/access control for client-facing multi-tenant production remains unresolved.
- Deployment/security hardening and operational controls remain required for full client-facing production readiness.

## 12) Readiness Verdict

- Demo-ready: `YES`
- Controlled internal use-ready: `YES, with known limitations`
- Production/client-facing ready: `NO`

## 13) Recommended Next Issue

- `Re-run OS functional smoke after lifecycle guardrail fix`
