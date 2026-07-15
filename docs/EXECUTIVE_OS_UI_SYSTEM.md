# Executive OS UI System Principles (v1)

## Identity Statement

FullSendOS is not a chatbot. It is an AI consulting operating system.

The product should communicate: structured, high-trust, executive-grade work product delivery.

## Visual Feel

- Premium — Stripe-level spacing, typography, and trust signals.
- Calm — No visual noise, no unnecessary color, no alerts for non-critical states.
- Operational — Always shows the user what to do next.
- Modern SaaS — Linear-influenced clean workflow states.
- Not playful — No emoji-driven empty states, no toy UI patterns.
- Not generic admin — Avoids raw CRUD patterns in favor of command-center frames.
- Not a chatbot skin — No chat bubbles, no typewriter text, no conversation metaphors.

## Inspiration

- Linear: Speed, focus, clean workflow state transitions.
- Stripe: Trust through spacing, typography precision, and explicit documentation.
- Notion: Workspace organization and structured content hierarchy.
- Raycast: Command-center energy and always-ready keyboard-first feel.
- Figma: Collaboration and state awareness with clear role indicators.

## Core Concepts

| Concept | Language |
|---|---|
| Client space | Client Command Center |
| Engagement | Engagement |
| Run workflow | Deploy AI Workforce |
| Pipeline stages | AI Workforce Pipeline |
| Review queue | Decision Queue |
| File uploads | Data Room |
| Exports | Executive Deliverables |
| Input requests | Human Review |
| Empty first run | Start your first command center |

## Language Replacements

| Old (Admin) | New (Executive OS) |
|---|---|
| No clients yet. Create your first client above. | Start your first client command center. |
| Run Workflow | Deploy AI Workforce |
| Create project | Start engagement |
| Consulting command center | Client Command Center |
| Recent engagements | Active Engagements |
| Decision queue | Decision Queue |
| Client workspace | Client Command Center |
| FullSendOS Alpha | FullSendOS Executive OS |
| Active Clients | Client Command Centers |
| No engagements yet. Create your first engagement to begin. | No engagements yet. Create a client first, then start an engagement to deploy the AI Workforce. |
| Recent Work Products | (removed from zero-state; contextual only) |
| Export Deliverables (always visible) | Export Deliverables (gated on deliverable state) |

## Color Usage

- `cyan` — AI actions, active states, run/deploy.
- `emerald` — Complete, ready for review, positive.
- `amber` — Action required, needs review, caution.
- `rose` — Errors, failures.
- `slate` — Structural elements, inactive states.
- `indigo / violet` — Setup steps, secondary guidance.

## Typography Hierarchy

1. Section label: `text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500`
2. Card title: `text-xl font-semibold`
3. Hero title: `text-3xl/4xl font-bold tracking-tight text-slate-50`
4. Body: `text-sm leading-6 text-slate-300`
5. Caption: `text-xs text-slate-400`
6. Metric value: `text-3xl font-bold`
7. Hint text: `text-xs text-slate-500`

## Empty States

All empty states should:
1. State what is missing clearly.
2. Explain why it matters.
3. Provide a clear next action.
4. Feel like progress, not a dead end.

## First-Run Experience

The empty dashboard must:
1. Show a clear value statement.
2. Show 4 setup steps (Onboard → Data Room → Engage → Deploy).
3. Provide a primary CTA (Start Client Onboarding).
4. Show what FullSendOS produces (capability grid).
5. Never show zeroed-out metrics without accompanying direction.

## Deferred to Next Iteration

- Full design token system.
- Sidebar navigation.
- Mobile layout.
- Dark/light mode.
- Command palette.
- Animated status transitions.
