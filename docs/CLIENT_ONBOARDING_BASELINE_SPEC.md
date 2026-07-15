# Client Onboarding + Baseline Builder Spec (v1)

## Goal
Guide a user from blank client record to AI-ready engagement context with a structured ClientBaseline.

Target flow:
Client Onboarding -> Company Baseline -> Data Room Setup -> Engagement Setup -> AI Workforce Run -> Review + Exports

## Entry Points
- Embedded in client workspace (recommended default for existing workflow).
- Full-page route for focused intake: /clients/new/onboarding?clientId=<id>

## Wizard Sections
1. Company Basics
- company name
- website
- industry
- location/markets served
- business model
- current stage
- size/team count
- locations

2. Customer Profile
- target customers
- customer segments
- price sensitivity
- buying motivations
- key customer problems

3. Business Goals
- growth goal
- engagement purpose
- desired deliverable
- timeline
- audience for final output
- success definition

4. Competitive Context
- known competitors
- market concerns
- advantages
- weaknesses

5. Brand and Voice
- brand tone
- existing positioning
- preferred writing style
- words to use
- words to avoid

6. Operational Context
- services/products
- revenue drivers
- major costs
- constraints
- current bottlenecks

7. Document Checklist
- business plan
- menu/product list
- financials
- pitch deck
- website copy
- brand guide
- market research
- lease/property docs
- investor docs
- SOPs
- org chart
- other files

## Output Model
The wizard writes ClientBaseline with:
- clientId
- companyOverview
- businessModel
- markets
- customers
- goals
- competitors
- brandVoice
- operations
- knownConstraints
- availableDocuments
- missingDocuments
- recommendedEngagementTypes
- createdAt
- updatedAt

## UX Requirements (v1)
- Clear section labels and helper text.
- Step switcher + progress percentage.
- Save draft action.
- Complete baseline action.
- Return explicit next steps in client workspace.
- Keep implementation lightweight and dashboard-compatible.

## Persistence + Compatibility
- Store path: data/clients/<clientId>-baseline.json
- Validation: zod schema in schemas/client-baseline.ts
- Existing clients are not broken: baseline is lazily initialized via ensureClientBaseline.

## API
- GET /api/clients/[clientId]/baseline
  - Ensure baseline exists and return it.
- PUT /api/clients/[clientId]/baseline
  - Full upsert with validation.
- PATCH /api/clients/[clientId]/baseline
  - Merge partial payload into existing baseline.

## Derived Behaviors
- missingDocuments derived when not explicitly provided.
- recommendedEngagementTypes inferred from goals/customers/operations/docs when not explicitly provided.

## Deferred to Future Slice
- Rich autosave timer.
- More sophisticated scoring model.
- Source-backed baseline confidence metrics.
- Inline file upload from document checklist rows.
