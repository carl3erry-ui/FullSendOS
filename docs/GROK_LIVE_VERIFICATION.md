# Grok Live Verification

This runbook provides a safe, explicit, opt-in path to verify:

- xAI/Grok provider connectivity
- provider abstraction usage via AgentExecutor
- live agent task execution
- multi-agent collaboration traceability

These checks are intentionally separate from normal test/build workflows.

## Safety Model

- Live checks run only when LIVE_PROVIDER_SMOKE=1 is set.
- XAI_API_KEY must be present.
- Scripts redact key-like and authorization-like strings from output.
- Default unit tests remain non-live and use mock provider paths.

## Required Environment

- XAI_API_KEY: required for all live verification scripts.
- LIVE_PROVIDER_SMOKE=1: explicit opt-in gate for live checks.
- XAI_DEFAULT_MODEL (optional): defaults to grok-4.5.
- XAI_BASE_URL (optional): alternate xAI endpoint.

## Commands

Run from project root:

```bash
LIVE_PROVIDER_SMOKE=1 XAI_API_KEY=... npm run verify:grok
LIVE_PROVIDER_SMOKE=1 XAI_API_KEY=... npm run verify:agent-live
LIVE_PROVIDER_SMOKE=1 XAI_API_KEY=... npm run verify:agent-collaboration
```

If XAI_API_KEY is not set, expected behavior is:

- NOT RUN - live verification guard failed
- reason includes missing XAI_API_KEY

## Expected Output (High-Level)

verify:grok prints a JSON summary with:

- provider, model, requestId
- usage metadata when available
- sanitized text preview

verify:agent-live prints a JSON summary with:

- taskId, agentId
- provider/model used at execution
- execution status and timestamps

verify:agent-collaboration prints a JSON summary with:

- workflowRunId, taskIds, agentIds
- step statuses and timestamps
- handoffLinks showing inter-agent sequence
- finalSynthesis and safetyStatus

## Mock vs Live Detection

A run is considered live only when:

- LIVE_PROVIDER_SMOKE=1 and XAI_API_KEY are present
- script reports provider as xai

Normal tests do not set LIVE_PROVIDER_SMOKE=1 and do not require a live key.

## Collaboration Evidence Criteria

A collaboration run should include:

- at least two tasks with different agentId values
- shared workflowRunId
- at least one handoff link between tasks
- provider recorded as xai for live path
- safetyStatus reported as clean or redacted

## Troubleshooting

- Guard failure: set LIVE_PROVIDER_SMOKE=1 and provide XAI_API_KEY.
- Provider init error: validate key and optional XAI_BASE_URL.
- Output validation failure: rerun and inspect sanitized error in script output.
- Intermittent provider timeout: retry; these checks are smoke-level, not load tests.
