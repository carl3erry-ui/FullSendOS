# FullSendOS Project Context

## North Star

FullSendOS is an AI Consulting Operating System that orchestrates specialized AI departments to produce professional consulting work.

It is not a collection of AI tools; it is a digital consulting firm where departments collaborate through structured workflows, persistent client memory, and validated work products.

## Constitution

This document is the constitution and single source of truth for product direction.

If any docs conflict, this file wins.

FullSendOS is an AI Consulting Operating System.

It orchestrates specialized AI departments to produce professional consulting work product for client engagements.

It is not a single-purpose marketing app, finance tool, or website builder. Those are capabilities inside a consulting operating model.

Primary architectural truth:

- Departments are the product.
- Workflow is orchestration.
- Models are implementation detail.
- Client memory is strategic moat.
- Deliverables are professional work product.

## v1.0 Domain Model

FullSendOS should be designed around business objects, not UI pages.

Organization

- Clients
- Departments
- Industry packs
- AI model routing policies
- Users

Client

- Memory
- Brands
- Engagements
- Assets
- History

Engagement

- Objectives
- Scope
- Timeline
- Department plan
- Work products
- Decisions
- Risks
- Deliverables

Supporting entities for implementation:

- DepartmentRun
- WorkProduct
- Deliverable
- IndustryPack
- ClientMemory

Projects are transitional implementation details. The enduring domain object is Engagement.

Terminology policy:

- Internal domain and APIs should converge on Engagement.
- Project can remain a temporary UI label while migration completes.

Compatibility implementation policy:

- Canonical public API surface is /api/engagements.
- Legacy /api/projects remains supported for backward compatibility.
- Current runtime persistence and orchestration remain project-based implementation details in this phase.
- Internal schema and store migration is intentionally deferred until a capability requires a new domain representation.

Decision filter for all features and architecture:

1. Does this help a consulting department produce better work?
2. Does this improve client memory quality and reuse?
3. Does this improve engagement orchestration reliability?
4. Does this improve deliverable quality or usability?

If all answers are no, the feature likely belongs in an integrated external tool, not core FullSendOS.

## Product Decision Filter

Before adding a feature, ask:

Does this improve one of the following?

- A consulting department
- Client memory
- Engagement orchestration
- Work product quality
- Deliverable generation
- Executive decision support
- Professional collaboration

If no, it probably belongs in an external integration rather than inside FullSendOS.

Examples aligned with core product:

- New financial modeling department
- Better competitor intelligence
- Investor memo generation
- Restaurant industry pack
- Executive review improvements

Examples outside core product:

- Accounting ledger
- Payroll
- Inventory management
- CRM replacement
- Graphic design editor
- Spreadsheet editor
- Email client

## Operating Model

Use a consulting firm organization model, not a generic task pipeline.

CEO

Chief Operating Officer

Project Manager

Departments:

- Intelligence
- Market Research
- Finance
- Strategy
- Marketing
- Creative
- Website
- Operations
- Legal
- Investor Relations
- Executive Review

Each department should be independently reusable and packageable.

Each department contract contains:

- Inputs
- Memory
- Tools
- AI model selection policy
- Prompt contract
- Schema contract
- Validation rules
- Deliverables
- Quality review

## Engagement Model

Use Consulting Engagement as the top-level delivery object above project execution details.

Client

- Engagement
  - Objectives
  - Department plan
  - Deliverables
  - Timeline
  - Decisions
  - Work product assets
- Engagement
- Engagement
- Client memory

A client can have multiple engagements.

Each engagement contributes work product back into client memory.

## Product Language

External and internal language should reflect consulting practice.

Preferred language:

- New Consulting Engagement
- Work Product
- Department Deliverables
- Executive Review
- Client Memory

Avoid reducing the platform to generic project/task wording when consulting terminology is more accurate.

## Work Product Chain

Departments produce assets, not only raw outputs.

Example chain:

- Research -> Research Binder
- Strategy -> Business Strategy
- Finance -> Financial Binder
- Creative -> Brand Assets
- Website -> Website Specification
- Executive Review -> Final Presentation

Each downstream deliverable should reference upstream validated work.

## Client Memory Policy

Client memory is persistent and reusable across engagements.

Typical memory domains:

- Brand
- Voice
- Financials
- Employees
- Customers
- Markets
- Competitors
- Past projects and engagements
- Logos and style guide
- Prior reports and decks
- Historical KPIs
- Research evidence

Default behavior:

- New engagements inherit approved client context.
- Teams should not need repeated re-explanation or re-upload for stable client facts.

## Model Abstraction Policy

Departments are model-agnostic at product surface.

Users hire departments, not model vendors.

Model routing can vary by department and over time without changing engagement semantics.

## Pack Strategy

Industry packs are configuration, not bespoke application forks.

Packs should primarily vary:

- Department prompts
- Playbooks
- Templates
- Validation preferences
- Terminology

Packs should reuse the same department contracts and orchestration model whenever possible.

## Roadmap Orientation

Phase 1 - Alpha: One consulting engagement

- Create engagement
- Run departments
- Generate validated work product
- Persist engagement state
- Review deliverables

Phase 2 - Client intelligence

- Client memory
- Brand and voice continuity
- Historical research reuse
- Cross-engagement context

Phase 3 - Department library

- Intelligence
- Finance
- Marketing
- Operations
- Creative
- Website
- Legal

Phase 4 - Industry packs

- Restaurant
- Brewery
- Healthcare
- Hospitality
- Commercial real estate
- Construction
- Professional services

Phase 5 - Team collaboration

- Multi-consultant workflow
- Approvals
- Comments
- Version history
- Client portal

Phase 6 - Automation

- Scheduled monitoring
- Weekly executive briefings
- Competitor tracking
- News and review monitoring
- Financial alerts

Phase 7 - Marketplace

- Third-party departments
- Industry packs
- Templates
- Prompt packs
- Model packs
- Extensions

## Issue Taxonomy Guidance

Prefer business-capability epics over purely technical labels.

Example epics:

- Consulting Engagement (create, resume, timeline, deliverables, executive review)
- Intelligence Department (research, SWOT, TAM/SAM/SOM, competitor analysis, reports)
- Finance Department (financial model, DCF, ROI, valuation, scenario analysis)

This keeps implementation work aligned with consulting value delivered to clients.

## Current Alpha Execution Note

Current alpha uses persisted project state and audit metadata as source of truth for execution lifecycle.

- Long-running requests are expected.
- Active duplicate runs are rejected.
- UI recovers using persisted-state refresh.
- This is alpha execution architecture, not final production queue architecture.

## Enforcement

Architecture and issue scoping should explicitly map to this document.

When proposing a change, include a short statement: which constitution principle and roadmap phase it advances.
