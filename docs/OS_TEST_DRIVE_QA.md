# OS Test Drive QA (Clean State)

Date: 2026-07-14
Branch: feature/os-test-drive-clean-state
Starting main commit: 0b65d02
PR #9 included in main: YES

## Scope And Method

This QA pass is a local/dev clean-state test drive only.

- No code paths, schemas, tests, routes, or docs were removed.
- No backend behavior changes were implemented.
- Browser interaction was not used in this run; verification was route-level/API-level with local app runtime logs.
- Hosted visual QA remains pending hosted preview URL availability.

## Data Reset Safety

### Data locations discovered

- data/clients
- data/projects
- data/agent-tasks
- data/agent-executions
- data/workflow-pauses
- data/human-input-requests
- data/deliverable-exports
- data/agent-retrieval-audits
- data/uploads

### Representative runtime data files discovered pre-reset

- data/workflow-pauses/*.json (large volume of pause state records)
- data/agent-tasks/*.json
- data/agent-executions/*.json
- data/human-input-requests/*.json
- data/clients/*.json
- data/projects/*.json
- data/deliverable-exports/*.json
- data/agent-retrieval-audits/*.json
- data/uploads/*

### What was treated as local/dev runtime data

All files under data/* above were treated as local file-backed runtime/demo artifacts.

### What was not touched

- source code under app/, services/, src/, agents/, departments/
- tests
- schemas
- docs
- config/environment files

### Existing reset/seed script

No dedicated reset/seed script was found in package scripts.

### Backup

Backup created before clearing:

- /tmp/fullsendos-qa-artifacts/fullsendos-data-backup-20260714-053747

### Reset method

Runtime reset performed by deleting files only (not directories):

- find data -mindepth 1 -type f -delete

Directory structure was preserved for all stores.

## Validation After Reset

- npm test: PASS (349 passed, 0 failed)
- npm run build: PASS

## Test Drive Inputs

### Test client

- Name: Hardware Brewery Test
- Website: https://hardwarebrewery.example
- City/state context: Titusville, FL (captured in QA intent; route-level run does not enforce location field)

### Test engagement objective

Evaluate brewery/business acquisition including:

- real estate
- upstairs/downstairs space
- brand potential
- market fit
- operational risks
- financial risks
- recommended next steps

Address intentionally uncertain/missing.

## Checklist Results

Legend: PASS | FAIL | PARTIAL | NOT AVAILABLE

### Dashboard

1. Dashboard first impression is clear: PASS (route-level empty-state hints present)
2. Empty state is understandable: PASS
3. New client flow works: PASS
4. New engagement flow works: PASS
5. Active client appears: PASS
6. Active engagement appears: PASS
7. Main navigation is understandable: PARTIAL (route-level only; no visual walkthrough)
8. Primary next action is obvious: PARTIAL (route-level only)

### Human Input / Action Center

1. Human Input / Action Center is visible: PASS (endpoint + engagement-scoped endpoint available)
2. Missing/uncertain address is surfaced if applicable: PASS (open questions contained explicit address unknown in research output)
3. User can answer, confirm, reject, or skip where available: PASS (answer action executed successfully)
4. Empty state is understandable when no input is needed: PARTIAL (API empty state confirmed; no visual copy review)
5. Human Input language is clear to non-technical user: PARTIAL (blocking prompt clear; full UI wording not visually reviewed)

### Data Room

1. Client Data Room is visible: PASS
2. Engagement Data Room is visible: PASS
3. Empty Data Room state is clear: PARTIAL (safe empty payloads confirmed; no visual review)
4. Upload/register affordance is visible: NOT AVAILABLE (browserless run)
5. Data Room folder structure is understandable: PARTIAL (folder/list APIs available)
6. No storage paths are exposed: PASS
7. No full extracted text is exposed: PASS

### AI Workforce / Agents

1. AI Workforce is visible: PASS (/api/agents returned public catalog)
2. Agent task creation is visible: PARTIAL (task list endpoint verified; UI affordance not visually reviewed)
3. Agent task run/review flow works or fails safely: PARTIAL (workflow agent execution observed in logs)
4. Approval-gated actions are clear: PASS (human-input gate returned structured blockingRequests)
5. Agent results are understandable: PASS (normalized department outputs and open questions)
6. Agent errors, if any, are safe and useful: PASS (safe structured errors observed)

### Workflow

1. Run workflow action is visible for active engagement: PARTIAL (route-level)
2. Workflow run does not crash: PASS
3. Approval/resume behavior is clear if triggered: PASS (blocking gate + answer + rerun)
4. Non-active engagements cannot be run and explain why: PASS (archived run attempt returned blocked status)
5. Workflow status is understandable: PASS
6. Workflow progress is understandable or clearly limited: PARTIAL (progress visible in server logs; no UI review)

### Work Products / Evidence

1. Work product viewer loads: PASS (detail payload available)
2. Executive report area is visible: PASS (generated deliverable present)
3. One-page summary area is visible: PASS
4. Deck outline area is visible: PASS
5. Evidence/Sources section appears where evidence exists: PASS
6. Assumptions are separate from facts: PASS
7. Open questions are visible: PASS
8. Human confirmations are visible where applicable: PASS (structure present)
9. Confidence summary is visible: PASS
10. No unsafe data is exposed: PASS

### Lifecycle

1. Archive engagement works: PASS
2. Restore engagement works: PASS
3. Soft-delete engagement works: PASS
4. Archive client works: PASS
5. Restore client works: PASS
6. Soft-delete client works: PASS
7. Deleted/archived records are hidden from default views: PASS
8. No hard delete occurs: PASS (lifecycle filter behavior confirmed)
9. Lifecycle labels are readable: PARTIAL (route-level)
10. Disabled run messaging is clear: PARTIAL (blocked run status confirmed; UI copy not visually reviewed)

### Export

1. Export controls are visible: PARTIAL (route-level)
2. Markdown export works: PASS (after deliverables completed)
3. HTML export works: PASS
4. Text export works: PASS
5. JSON export works: PASS
6. Export list/history appears: PASS
7. Export detail/open action works: PASS
8. Export fails safely if no deliverables exist: PASS (422 before deliverables)
9. Export does not expose unsafe data: PASS
10. Export labels and helper text are understandable: PARTIAL (route-level)

## Safety Review

Confirmed no unsafe exposure in inspected UI/API/export payloads:

- raw provider payloads: not exposed
- private prompts: not exposed
- API keys: not exposed
- stack traces: not exposed
- hidden reasoning: not exposed
- local storage paths: not exposed
- full extracted document text: not exposed
- unsafe diagnostics: not exposed

## Findings

### Demo-blocking

1. Workflow completion latency can be long in local async mode; a newly started engagement may remain in running state for extended polling windows before deliverables are available. This delays export usability in live demos.

### Confusing but usable

1. Initial workflow run may block for website input even when client profile already contains website. The user can resolve this by answering the blocking Human Input request and rerunning.
2. Route-level QA confirms states and safety, but some user-facing clarity checks remain partial without browser visual pass.

### Cosmetic

1. None identified in API-level pass (visual cosmetic review not performed).

### Deferred

1. Hosted visual QA and screenshot evidence deferred until hosted preview URL is available.
2. Full UI copy/affordance judgment deferred to browser pass.

## Overall Demo Readiness

Result: PARTIAL

Reason: Core capabilities, safety boundaries, lifecycle, and export foundation all worked in local route-level QA; however, workflow timing and browserless limitations leave visual/demo polish validation incomplete.

## Recommended Next Issue

Issue: Improve workflow run UX for gated/long-running states.

Suggested scope:

- surface explicit "blocked by Human Input" state in engagement run control
- improve progress and completion visibility for long-running workflows
- make export panel readiness messaging explicit when deliverables are pending
