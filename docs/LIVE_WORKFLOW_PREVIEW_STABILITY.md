# Live Workflow Preview Stability

## Purpose

This branch adds stability and safety around live workflow previews so the next live test does not repeat the stalled preview pattern.

## Why the Prior Run Stalled

The prior deep live test reached `brand/running` and never reached a terminal state before the preview session ended. The preview URL also became unavailable before Carl could personally test the system.

## What Was Added

- deterministic workflow stability state helper
- stale/stuck/timed-out detection
- safe abort route for stalled engagements
- redacted live logging utility
- safe live preview status harness
- UI warnings for stuck workflows
- internal-only abort guidance

## How Stale / Stuck / Timed-Out States Work

- terminal statuses: `completed`, `needs-review`, `failed`
- stale workflows: running longer than the safe timeout window
- stuck departments: a department remains `running` for too long
- timed-out workflows: the workflow exceeds the maximum safe run window
- unknown timestamps do not crash the UI

## Abort / Cancel Behavior

The abort path is internal-only and safe:

- marks the workflow failed with a safe reason
- does not call Grok
- does not delete history or deliverables
- returns safe JSON only
- does not include raw provider output

## Redacted Logging

Live test logs must not print:

- API keys
- authorization headers
- raw provider payloads
- full prompts
- hidden reasoning
- `.env.local` contents

The redacted logger converts secret-like values into safe summaries.

## Safe Live Preview Harness

The live preview status harness prints only safe summaries for an engagement ID:

- workflow status
- terminal state yes/no
- deliverables yes/no
- exports yes/no
- client portal route yes/no

It does not start workflows or call Grok automatically.

## Known Limitations

- Persisted live collaboration traces are still deterministic preview in some views.
- Workflow timeout thresholds are conservative and may need tuning.
- The safe preview harness relies on local runtime data for status summaries.
