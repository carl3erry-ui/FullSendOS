# FullSendOS Agent Registry v1

## Purpose

The Agent Registry defines the capability profile of every specialist agent in the FullSendOS AI consulting firm.

These profiles are used by the Dynamic Team Selection system to choose the right agents for each engagement.

## Initial Agent List

| Agent ID | Name | Department | Role | Core? |
|---|---|---|---|---|
| orchestrator | Orchestrator | Executive | Engagement Planner | Yes |
| project-manager | Project Manager | Executive | Project Coordinator | No |
| researcher | Research Analyst | Intelligence | Market Researcher | No |
| market-research | Market Research Specialist | Intelligence | Segment Researcher | No |
| finance | Financial Analyst | Finance | Financial Modeler | No |
| strategy | Strategy Advisor | Strategy | Growth Strategist | No |
| brand-strategy | Brand Strategist | Brand | Brand Architect | No |
| creative-director | Creative Director | Brand | Creative Lead | No |
| website-digital | Website/Digital Strategist | Brand | Digital Architect | No |
| operations | Operations Analyst | Operations | Process Optimizer | No |
| legal-review | Legal Review | Legal | Compliance Reviewer | No |
| sales-revenue | Sales/Revenue Strategist | Strategy | Revenue Architect | No |
| investor-relations | Investor Relations | IR | Investor Narrative Lead | No |
| quality-control | Quality Control | Quality | Output Reviewer | No |
| executive-review | Executive Review | Executive | Final Synthesizer | Yes |

## Capability Profile Structure

Each agent profile includes:

- `agentId` — Unique identifier
- `name` — Display name
- `department` — Department area
- `role` — Functional role
- `description` — What this agent does
- `capabilities` — What it can produce
- `bestUseCases` — When to use it
- `inputsNeeded` — What it requires to operate well
- `outputsProduced` — What it generates
- `canHelpWith` — Help request subjects it can answer
- `escalatesWhen` — When it must escalate rather than answer
- `approvalRequiredFor` — Output types requiring human approval
- `defaultProviderPreference` — Preferred AI provider
- `costRiskLevel` — Budget guardrail rating
- `isCoreAgent` — Whether this agent is required in all engagements

## How Agents Are Selected

The Dynamic Team Selection service maps engagement types to required and recommended agent sets.

See `lib/agents/team-selection.ts` for the full engagement type map.

Key engagement types with pre-defined teams:
- `market-entry`
- `business-plan`
- `investor-deck`
- `sba-loan`
- `brand-strategy`
- `website-strategy`
- `operations-review`
- `financial-analysis`
- `general-consulting`

## Escalation Rules

Every agent has defined escalation conditions. Legal Review always escalates to a licensed human attorney. Executive Review escalates when department outputs conflict.

## How to Add Future Agents

1. Add a new `AgentCapabilityProfile` entry to `lib/agents/agent-registry.ts`.
2. Add a `bestUseCases` entry for the relevant engagement types.
3. Add the agent to relevant `ENGAGEMENT_TEAM_MAP` entries in `lib/agents/team-selection.ts`.
4. Update `SELECTION_REASONS` with a clear explanation.
5. Add tests in `services/agent-collaboration.test.ts`.
6. Update this registry doc.
