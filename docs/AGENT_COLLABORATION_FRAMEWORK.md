# FullSendOS Agent Collaboration Framework v1

## Purpose

The Agent Collaboration Framework governs how FullSendOS agents work together on client engagements.

FullSendOS agents do not behave like disconnected chatbots. They behave like members of one consulting firm operating under a shared Leadership Doctrine and a governed operating model.

## Why This Matters

Without a governed collaboration model, agent systems produce:
- Inconsistent outputs from uncoordinated departments
- Circular help requests and runaway costs
- Generic recommendations without real client context
- Deliverables that bypass human review before client delivery
- No audit trail for how conclusions were reached

The Collaboration Framework prevents these failures by enforcing clear rules about who gets called, why, what they can do, and when humans must approve.

## The Operating Rule

```
Agents can request help.
The Orchestrator approves, denies, or redirects.
All collaboration is logged.
Executive Review compiles and validates.
Human approval is required before client delivery.
The Leadership Doctrine governs every decision.
```

## Target Operating Model

```
User Request
   ↓
Orchestrator analyzes engagement
   ↓
Agent Registry provides available specialists
   ↓
Dynamic Team Selection selects the team
   ↓
Agents receive task assignments
   ↓
Agents produce structured outputs
   ↓
Agents may submit structured help requests
   ↓
Orchestrator approves, denies, or redirects
   ↓
Specialist agents respond with evidence and confidence
   ↓
Collaboration trace is recorded
   ↓
Quality Control reviews consistency
   ↓
Executive Review synthesizes and validates
   ↓
Leadership Decision Check evaluates output
   ↓
Human review/approval gate
   ↓
Deliverables move toward client-ready status
```

## The Leadership Doctrine

The Leadership Doctrine is the governance backbone of the Collaboration Framework.

See `docs/FULLSENDOS_LEADERSHIP_DOCTRINE.md` and `ai/governance/leadership-doctrine.ts` for the full doctrine.

Every agent output should be evaluated against the Leadership Decision Check before advancing to Executive Review. Key questions include:

- Does this recommendation advance the stated objective?
- Does it improve the client or customer experience?
- Is it operationally realistic?
- Are assumptions and gaps visible?
- Have relevant specialists been consulted?
- Would Executive Review be comfortable defending it?

The Collaboration Framework integrates the Leadership Doctrine version into every collaboration trace.

## Component Files

| File | Purpose |
|---|---|
| `lib/agents/agent-registry.ts` | Capability profiles for all 15 specialist agents |
| `lib/agents/team-selection.ts` | Deterministic team selection by engagement type |
| `lib/agents/collaboration.ts` | Help request/response model and lifecycle helpers |
| `lib/agents/collaboration-trace.ts` | Collaboration trace recording all events and doctrine fields |
| `lib/agents/collaboration-guardrails.ts` | Guardrail evaluator (circular, duplicate, max limits) |
| `lib/agents/approval-gates.ts` | Human approval gate evaluator |
| `ai/governance/leadership-doctrine.ts` | Leadership Doctrine runtime representation |

## Human Approval Gates

Human approval is required when:
- Output contains legal-sensitive content
- Output contains financial projections for investors or lenders
- Output is investor-facing
- Output is client-facing and ready for delivery
- A high-cost workflow is involved
- Confidence is low and critical decisions depend on the output
- Critical data is missing

## Executive Review Responsibilities

Executive Review must verify:
1. Appropriate agents participated in the engagement
2. No critical department was skipped
3. Client/customer impact was considered
4. Financial and operational consequences were reviewed
5. Assumptions are visible, not hidden
6. Risks are addressed, not only mentioned
7. Recommendations are actionable with specific next steps
8. The Leadership Doctrine was meaningfully applied
9. The Leadership Decision Check has been completed

## What v1 Does NOT Do

- No live AI routing in team selection
- No real-time agent chat or uncontrolled message passing
- No provider-level routing changes
- No client portal or external agent communication
- No fully automated self-correction without human oversight
- No production infrastructure deployment

## Recommended Next Issue

Build Client Portal / External Access Layer so that approved, human-reviewed deliverables can be safely shared with clients.
