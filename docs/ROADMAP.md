# Roadmap

This roadmap derives from [PROJECT_CONTEXT](PROJECT_CONTEXT.md).

If this file conflicts with [PROJECT_CONTEXT](PROJECT_CONTEXT.md), [PROJECT_CONTEXT](PROJECT_CONTEXT.md) wins.

## Constitution-Derived Phases

Phase 1: Alpha one engagement

- Create engagement
- Run departments
- Generate validated work product
- Persist engagement state
- Review deliverables
- Structured consulting work-product viewer

Phase 2: Client intelligence

- Client memory
- Brand and voice continuity
- Historical research reuse
- Cross-engagement context

Phase 3: Department library

- Intelligence
- Finance
- Marketing
- Operations
- Creative
- Website
- Legal

Phase 4: Industry packs

- Restaurant
- Brewery
- Healthcare
- Hospitality
- Commercial real estate
- Construction
- Professional services

Phase 5: Team collaboration

- Multi-consultant workflow
- Approvals
- Comments
- Version history
- Client portal

Phase 6: Automation

- Scheduled monitoring
- Weekly executive briefings
- Competitor tracking
- News and review monitoring
- Financial alerts

Phase 7: Marketplace

- Third-party departments
- Industry packs
- Templates
- Prompt packs
- Model packs
- Extensions

## Sprint 2: AI Engine Foundation

- Issue #5: Project Domain Model
- Issue #6: Workflow Engine (no AI calls)
- Issue #7: Server-Side Grok Client
- Issue #8: Department Execution Framework
- Issue #9: Prompt Builder Framework
- Issue #10: First Real End-to-End Project Run

## Sprint 3

- Executive report builder
- Word export
- PDF export
- PowerPoint export

## Slice 11 Scope Note

Department Agent Workforce Foundation is implemented as an extension to the
existing agent framework. This slice explicitly excludes:

- Rebuilding registry/executor/provider architecture
- Data-room file parsing/indexing of private file contents
- Autonomous external actions (publishing, spending, account modifications)

Note: richer export artifact generation remains deferred until after validated in-product review workflows.

## Slice 12 Scope Note

Data Room File Parsing and Indexing Foundation is implemented with strict
safety boundaries. This slice includes:

- Document processing statuses and metadata records
- Safe parsing for selected text-like file types
- Client and engagement-compatible processing/listing APIs
- UI controls for manual processing and status visibility

This slice explicitly excludes:

- Prompt injection of parsed file content
- Vector search/embeddings infrastructure
- Client portal, export, or email workflow integrations
- Exposure of raw private file text in public APIs

## Slice 13 Scope Note

Agent Retrieval from Data Room is implemented as an internal retrieval layer
integrated into task execution with explicit task opt-in. This slice includes:

- Retrieval permission gating via `RETRIEVE_DATA_ROOM_CONTEXT`
- Eligibility filtering for approved, non-sensitive, completed documents
- Bounded excerpts and citation-ready source references for agent context
- Retrieval audit records linked to task and agent identifiers
- Safe source visibility in agent task detail surfaces

This slice explicitly excludes:

- Broad public retrieval APIs
- Full extracted text exposure in public responses
- Embeddings or vector-search infrastructure
- Client portal, exports, external integrations, and unrelated security scope

## Sprint 4

- Client management
- Authentication
- File uploads
- Evidence library

## Sprint 5

- White label
- Billing
- Multi-tenant support
- Marketplace

## Future Production Security Epic

- Secure Client Portal Production Foundation (future scope)
	- authentication
	- tenant isolation
	- role-based authorization
	- client user management
	- MFA
	- session revocation
	- audit logging
	- secure invitations
	- Data Room authorization
	- deliverable versioning
	- cross-client negative tests

## Version Milestones

- v0.1: Dashboard
- v0.2: Workflow Engine
- v0.3: AI Integration
- v0.4: Department Execution
- v0.5: First End-to-End Project
- v0.6: Executive Reports
- v1.0: FullSendOS Alpha

## Development Rhythm

One concern per change, build check, isolated commit, push.
