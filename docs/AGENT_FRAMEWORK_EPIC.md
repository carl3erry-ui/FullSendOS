# Agent Framework Epic (Foundation Slice)

## Epic Goal
Create the first safe, provider-independent foundation layer for the FullSendOS Agent Framework without destabilizing current Alpha behavior.

## Product Principle
- Agents do the thinking work.
- Workflows govern the process.
- Humans authorize consequential actions.
- FullSendOS controls state, permissions, evidence, cost, approval, and accountability.

## Constraints
- Do not build the full agent UI yet.
- Do not integrate agents into the existing workflow engine yet.
- Do not rewrite existing engagement, project, department, or workflow execution code.
- Do not create placeholder agents that only return hardcoded text.
- Do not destabilize current Alpha behavior.

## Branching Requirement
- Create and work from `feature/agent-framework`.
- Before branching:
  - Report current branch.
  - Report `git status --short`.
  - If uncommitted work exists, stop and report it before branching.
  - Do not overwrite unrelated work.

## Scope (This Slice)
Implement these foundation capabilities only:
1. Agent domain types and schemas
2. AI provider abstraction
3. Mock AI provider
4. xAI provider wrapper
5. Provider registry
6. Agent registry
7. Initial agent definitions:
   - Orchestrator Agent
   - Research Agent
   - Quality Control Agent
8. Structured output schemas for those agents
9. Tests
10. Documentation

## Out of Scope (Later Slices)
- Agent task persistence
- Execution routes
- Approval APIs
- Dashboard UI
- Workflow integration

## Architecture Discovery (Required Before Changes)
Summarize current:
- Next.js structure
- API routes
- Workflow/orchestration code
- Schema/validation approach
- AI/xAI integration
- Environment variable patterns
- Test/build scripts
- Persistence approach

Reuse existing architecture patterns where reasonable.

## Domain Model Requirements
Create strongly typed models and validation schemas for:

### AgentDefinition
Fields:
- id
- name
- description
- role
- version
- capabilities
- allowedTools
- defaultProvider
- defaultModel
- systemPrompt
- outputSchema
- requiresApproval
- maximumIterations
- timeoutMs
- enabled
- createdAt
- updatedAt

### AgentTask (type/schema only)
Fields:
- id
- projectId
- engagementId
- workflowRunId
- departmentId
- agentId
- title
- objective
- instructions
- input
- context
- status
- priority
- provider
- model
- requestedBy
- assignedAt
- startedAt
- completedAt
- failedAt
- approvalStatus
- output
- structuredOutput
- evidence
- sources
- error
- usage
- cost
- createdAt
- updatedAt

Note: parent references may be nullable/optional.

### AgentExecution (type/schema only)
Fields:
- id
- agentTaskId
- agentId
- provider
- model
- status
- attempt
- inputSnapshot
- systemPromptSnapshot
- toolPermissionsSnapshot
- rawResponse
- parsedResponse
- validationResult
- usage
- estimatedCost
- error
- startedAt
- completedAt

### ApprovalGate (type/schema only)
Fields:
- id
- agentTaskId
- actionType
- reason
- requestedBy
- requestedAt
- status
- reviewedBy
- reviewedAt
- reviewerNotes

### AgentEvidence
Fields:
- type
- title
- content
- source
- sourceUrl
- confidence
- retrievedAt

Note: `sourceUrl` is optional for internal evidence.

## Required Typed Enums/Values
### Agent task status
- queued
- running
- waiting_for_approval
- completed
- failed
- cancelled

### Execution status
- pending
- running
- completed
- failed
- timed_out

### Approval status
- not_required
- pending
- approved
- rejected
- revision_requested

### Provider name
- xai
- mock

## AI Provider Abstraction
Create `AIProvider` with:
- `generate(request): Promise<AIProviderResponse>`

Request should include:
- model
- systemPrompt
- messages
- temperature
- maximumOutputTokens
- responseFormat or output schema
- metadata
- timeout
- optional tool definitions

Response should include:
- provider
- model
- text
- structuredOutput
- usage
- finishReason
- requestId
- rawResponse (only when safe/useful)

Implement:
- `AIProviderRegistry`
- `MockAIProvider`
- `XAIProvider`

Constraint: do not import xAI directly into agent classes.

## xAI Integration Rules
Use existing repository xAI configuration where available and support:
- `XAI_API_KEY`
- `XAI_DEFAULT_MODEL`
- `XAI_BASE_URL`

Security:
- Never expose API key to client.
- Do not log secrets/authorization headers.
- Missing API key must return typed provider-configuration error.
- Preserve current working Grok model name if already defined.

## Mock Provider Rules
- Must return valid, meaningful structured outputs for:
  - Orchestrator
  - Research
  - Quality Control
- Support mock mode via: `AI_PROVIDER_MODE=mock`
- Tests must not depend on live xAI calls.

## Agent Registry Requirements
Create `AgentRegistry` that:
- Registers agents
- Lists enabled agents
- Returns agent by ID
- Prevents duplicate IDs
- Exposes public-safe metadata
- Never exposes private full system prompts in public-safe metadata

Register initial agents:
- `orchestrator`
- `researcher`
- `quality-control`

## Agent Output Schemas
Use repository standard schema library (prefer Zod if already used).

### Orchestrator Output
Fields:
- summary
- assumptions
- tasks
- dependencies
- risks
- approvalGates
- successCriteria
- recommendedNextAction

Each task:
- id
- title
- objective
- recommendedAgentId
- department
- priority
- dependencies
- requiresApproval
- expectedOutput

### Research Output
Fields:
- executiveSummary
- researchQuestions
- findings
- evidence
- assumptions
- gaps
- risks
- recommendations
- confidence

Requirement:
- Must disclose when no research tools are available.

### Quality Control Output
Fields:
- verdict
- score
- summary
- passedChecks
- failedChecks
- unsupportedClaims
- missingInformation
- requiredRevisions
- approvalRecommendation

Verdict values:
- approved
- approved_with_notes
- revision_required
- rejected

## Base Agent Contract
Create interface/abstract base with:
- definition
- validateTask
- buildSystemPrompt
- buildMessages
- execute
- parseOutput
- validateOutput

Constraint:
- Keep execution lightweight/testable.
- No persistence or workflow execution integration in this slice.

## Security Boundaries
Define permission vocabulary:
- read_project
- read_engagement
- read_documents
- search_internal_knowledge
- search_web
- create_task
- update_task
- draft_email
- send_email
- publish_content
- spend_money
- modify_production
- delete_record

First-slice restrictions:
- No send email
- No publish content
- No spend money
- No modify production
- No delete records
- No uncontrolled external tools

High-risk actions must be represented as requiring approval in the model.

## Test Coverage
Add focused tests for:
- Agent definition validation
- Agent task schema validation
- Execution schema validation
- Approval schema validation
- Agent registry registration
- Duplicate agent ID rejection
- Public-safe metadata excludes private prompt text
- Provider registry resolution
- Unknown provider error
- Missing xAI key behavior
- Mock provider returns valid orchestrator output
- Mock provider returns valid research output
- Mock provider returns valid quality-control output
- xAI provider is server-side only and does not expose secrets
- Output schemas validate canonical payloads
- Output schemas reject malformed payloads

Constraint: no live xAI calls in tests.

## Documentation Requirements
Document:
- What an agent is in FullSendOS
- Agent vs workflow vs automation vs approval
- Provider abstraction
- AgentRegistry
- AIProviderRegistry
- Mock mode
- xAI configuration
- Current limitations
- Future slices:
  - task persistence
  - agent executor
  - API routes
  - approval UI
  - workflow integration
  - tool permissions
  - background queue

Constraint: do not claim full agent task system is complete.

## Validation Commands
Run:
- `npm test`
- `npm run build`

Also run typecheck/lint if scripts exist.

## Commit Plan
If checks pass, create one focused commit:
- `feat: add agent framework foundation`

Push only if branch workflow allows feature branch push.

## Required Final Report
Include:
1. Starting branch and status
2. New branch name
3. Existing architecture summary
4. Files created
5. Files modified
6. Agent domain models added
7. Provider abstraction added
8. Registered agents
9. Mock mode behavior
10. xAI configuration behavior
11. Security boundaries
12. Tests added
13. Test result
14. Build result
15. Typecheck/lint result (if available)
16. Commit hash
17. Push result
18. Known limitations
19. Next recommended issue

End with:
- Branch: ___
- Agent foundation: PASS or FAIL
- Provider abstraction: PASS or FAIL
- Mock provider: PASS or FAIL
- xAI provider wrapper: PASS or FAIL
- Agent registry: PASS or FAIL
- Tests: PASS or FAIL
- Build: PASS or FAIL
- Commit: ___ or NOT CREATED
- Push: PASS, FAIL, or NOT PUSHED
- Next issue: ___
