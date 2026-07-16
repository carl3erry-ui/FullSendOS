# Safe Live Preview Runbook

## Goal

Run the next live preview in a way that Carl can actually access it and test it without leaking raw provider output or shutting the session down too early.

## How to Run

1. Start the dev server and keep it running.
2. Use a stable preview URL.
3. Open the Owner/Admin dashboard.
4. Open the internal Collaboration Trace and Agent Workforce status views.
5. Use the safe live preview status harness to check workflow state.
6. If testing live Grok, run exactly one controlled workflow.
7. Keep the preview session alive until Carl confirms testing is done.

## How to Keep the Server and Tunnel Alive

- Prefer a stable Codespaces forwarded port or cloudflared tunnel.
- Avoid unstable tunnels for long manual test sessions.
- Do not stop the dev server while Carl is still testing.
- Do not stop the tunnel unless there is a safety or resource issue.

## How to Avoid Raw Provider Payloads

- Never print live provider responses in terminal output.
- Use redacted logging helpers only.
- Summarize workflow state, not raw text.
- Remove any debug logging that exposes prompts or payloads.

## How to Report Status to Carl

Report only safe summaries:

- workflow status
- terminal state
- deliverables yes/no
- exports yes/no
- client portal safe yes/no
- collaboration trace visible yes/no

## How to Stop Safely

If the workflow stalls:

- stop polling
- mark the run failed/aborted safely
- preserve runtime data locally
- do not commit runtime data
- document the failure honestly

## What Success Means

Success for the next preview means at least one of the following:

- Carl personally accesses the live OS
- or a safe screenshot walkthrough is captured

## What Failure Means

Failure means:

- workflow stalls
- preview becomes unavailable
- deliverables are not produced
- exports are not available
- raw provider payloads leak into terminal output
