# Slice 13: Agent Retrieval from Data Room (Planning and Safety Design)

Status: Planning only

## 1. Current Architecture Summary

### Agent framework and execution

- Agent definitions and permissions are centralized in [agents/definitions](agents/definitions) and [agents/permissions.ts](agents/permissions.ts).
- Agent execution flow is enforced by [agents/executor.ts](agents/executor.ts):
  - task load and validation
  - approval checks
  - high-risk permission gate
  - provider call
  - execution/task persistence
- Workflow agent-step integration is in [services/workflow-agent-executor.ts](services/workflow-agent-executor.ts).
- Workflow audit entry recording is in [services/workflow-audit-recorder.ts](services/workflow-audit-recorder.ts).

### Data Room and document processing

- File metadata store: [services/client-data-room-store.ts](services/client-data-room-store.ts), persisted at data/clients/[clientId]-data-room.json.
- Parsed document model: [schemas/client-data-room.ts](schemas/client-data-room.ts), type DataRoomDocument.
- Parsed document store: [services/data-room-document-store.ts](services/data-room-document-store.ts), persisted at data/clients/[clientId]-documents.json.
- Parsing and status pipeline: [services/data-room-processing-service.ts](services/data-room-processing-service.ts).
- Safe document metadata APIs:
  - [app/api/clients/[clientId]/data-room/documents/route.ts](app/api/clients/[clientId]/data-room/documents/route.ts)
  - [app/api/engagements/[id]/data-room/documents/route.ts](app/api/engagements/[id]/data-room/documents/route.ts)
- Data Room UI status display and processing controls: [app/components/data-room-panel.tsx](app/components/data-room-panel.tsx).

### Existing safety baseline

- File safe schema omits storagePath: [schemas/client-data-room.ts](schemas/client-data-room.ts).
- Document safe schema omits textExtracted: [schemas/client-data-room.ts](schemas/client-data-room.ts).
- Processing pipeline skips sensitive and unapproved files by default: [services/data-room-processing-service.ts](services/data-room-processing-service.ts).
- Agent permission vocabulary includes explicit disallowed permission ACCESS_RAW_FILE_CONTENTS and high-risk gate controls: [agents/permissions.ts](agents/permissions.ts).

## 2. Architecture Findings for Slice 13

1. Parsed document records are stored in data/clients/[clientId]-documents.json via [services/data-room-document-store.ts](services/data-room-document-store.ts).
2. Full extracted text is stored internally in DataRoomDocument.textExtracted.
3. Full extracted text is not exposed publicly by safe APIs (DataRoomDocumentSafe omits textExtracted).
4. approvedForAgentUse is represented on both file references and document records.
5. sensitive is represented on both file references and document records.
6. Multiple agents currently have READ_DATA_ROOM_METADATA and supportsDataRoomMetadata=true in workforce definitions (for example in [agents/definitions/workforce.ts](agents/definitions/workforce.ts) and [agents/definitions/researcher.ts](agents/definitions/researcher.ts)).
7. No current agent has implemented raw file-content retrieval in executor flow.
8. Best integration point is pre-provider execution in [agents/executor.ts](agents/executor.ts), between task validation/approval checks and provider call.
9. Citation/evidence can be attached through existing task fields evidence and sources in [agents/types.ts](agents/types.ts), plus workflow audit entries in [services/workflow-audit-recorder.ts](services/workflow-audit-recorder.ts).

## 3. Retrieval Safety Policy

### File eligibility rules

A document is retrieval-eligible only if all are true:

- approvedForAgentUse is true.
- sensitive is false (default). Future sensitive access requires explicit approval design, out of this slice.
- processingStatus is completed.
- file is not archived.
- document and file resolve to the same client as the task context.
- engagementId matches when engagement-scoped retrieval is requested.
- requesting agent has retrieval permission.
- retrieval operation is written to audit trail.

### Required permission for future retrieval

- Add a new low-risk read permission in a future implementation slice: read_data_room_retrieval.
- Do not reuse broad read_documents as implicit retrieval authorization.
- Maintain ACCESS_RAW_FILE_CONTENTS as high-risk and unavailable by default.

### Conservative retrieval limits (default)

- maxDocuments: 5
- maxExcerpts total: 12
- maxExcerptsPerDocument: 3
- maxExcerptCharacters: 280
- maxTotalRetrievedCharacters: 2400
- maxKeywordMatchesPerDocument: 8
- maxSummaryCharactersPerDocument: 240
- includeFullExtractedText: false and unavailable in normal flows

### Disallowed behavior

Agents must not:

- read unapproved files
- read sensitive files by default
- read archived files
- cross client boundaries
- bypass engagement scope when engagement-specific mode is requested
- access storagePath
- receive full raw text by default
- bypass permission checks
- omit source references
- fabricate citations

## 4. Retrieval Contract Design

### DataRoomRetrievalRequest

- clientId: string
- engagementId: string optional
- agentId: string
- taskId: string
- query: string
- documentTypes: string[] optional
- folderIds: string[] optional
- fileIds: string[] optional
- keywords: string[] optional
- maxDocuments: number optional
- maxExcerpts: number optional
- includeSummaries: boolean optional
- includePreviews: boolean optional
- allowSensitive: boolean default false

### DataRoomSourceReference

- sourceId: string
- documentId: string
- fileId: string
- clientId: string
- engagementId: string optional
- displayName: string
- folderId: string
- detectedDocumentType: string
- processingStatus: string
- approvedForAgentUse: boolean
- sensitive: boolean
- citationLabel: string

### DataRoomExcerpt

- sourceId: string
- excerpt: string
- excerptIndex: number
- characterCount: number
- matchReason: keyword | summary | preview | heuristic

### DataRoomRetrievalResult

- sources: DataRoomSourceReference[]
- excerpts: DataRoomExcerpt[]
- summaries: Array<{ sourceId: string; summary: string }> optional
- skippedDocuments: Array<{ documentId: string; reason: string }>
- warnings: string[]
- retrievalAuditId: string
- totalCharacters: number
- confidence: number

### Explicit exclusions in contract

- No storagePath in any retrieval result object.
- No full textExtracted in default retrieval result object.

## 5. Retrieval Integration Options and Recommendation

### Option 1: Pre-execution context builder

- Retrieval runs in executor before provider call.
- Safe retrieval payload is attached to task context.
- Deterministic and easy to audit.

### Option 2: Explicit retrieval tool step

- Agent requests retrieval as an internal tool during execution.
- More flexible but more complex control surface.

### Option 3: Workflow-controlled retrieval

- Workflow declares required evidence set.
- Retrieval runs before agent task.
- Strong governance but requires workflow schema expansion first.

### Recommended Slice 13 implementation path

Start with Option 1.

Reason:

- Fits current architecture with minimal surface area.
- Enforces one controlled retrieval path in [agents/executor.ts](agents/executor.ts).
- Allows strict permission and audit policy before any tool-like dynamic access.
- Avoids new public APIs while safety posture is hardened.

## 6. Citation and Evidence Model

Use existing AgentTask evidence and sources surfaces, adding structured source references in task context.

### RetrievalEvidenceEntry (planned)

- sourceId
- fileId
- documentId
- citationLabel
- displayName
- folderId
- detectedDocumentType
- excerptPreview
- confidence
- usedByAgentId
- usedInTaskId
- createdAt

### Work product usage goal

Future work products should reference evidence labels (for example, Source A, Source B) and concise excerpt previews, without embedding full raw documents.

## 7. API and Internal Boundary Recommendation

Slice 13 should be internal-service-first.

- Build internal retrieval service only (no broad public API).
- Invoke retrieval through executor integration only.
- Store retrieval audit records internally with task and workflow audit linkage.
- Optionally expose read-only source preview later via tightly scoped endpoint after policy hardening.

## 8. Planned Test Matrix for Slice 13 Implementation

1. Approved completed document can be retrieved.
2. Unapproved document is skipped.
3. Sensitive document is skipped by default.
4. Archived file is skipped.
5. Wrong-client document is never retrieved.
6. Wrong-engagement document is skipped unless client-wide mode is explicitly enabled.
7. Agent lacking retrieval permission is denied.
8. Retrieval returns excerpts only.
9. Retrieval never returns storagePath.
10. Retrieval never returns full textExtracted by default.
11. Retrieval respects character and source limits.
12. Retrieval writes audit entry.
13. Retrieval returns citation-ready source references.
14. Agent task receives retrieval context only when retrieval is enabled.
15. Work product formatting can consume citation labels.
16. Unsafe fields are not exposed in API/task responses.

## 9. Known Risks

- Over-retrieval can still bias outputs if limits are too permissive.
- Engagement scoping may be ambiguous for client-wide documents unless rules are explicit per task.
- Citation quality may degrade if excerpt selection logic is weak.
- Without a strict permission split, metadata-read and retrieval-read can be conflated.

## 10. Explicitly Out of Scope

- Prompt wiring of full extracted document text.
- Embeddings or vector database retrieval.
- Client Portal features.
- QuickBooks or third-party integrations.
- Deliverable export changes.
- Unrelated platform-wide rate limiting or broad security refactors.

## 11. Exact Next Implementation Prompt Recommendation

Implement Slice 13 with these constraints:

- Add internal retrieval service only, no public retrieval API.
- Add retrieval request/result schemas and safe source/excerpt models.
- Integrate retrieval in AgentExecutor pre-provider call behind explicit task option enableDataRoomRetrieval.
- Enforce eligibility policy: approvedForAgentUse=true, sensitive=false, processingStatus=completed, same client, engagement-aware scoping, permission required.
- Enforce conservative limits from this plan.
- Write retrieval audit records linked to taskId and agentId.
- Add citation-ready source references into AgentTask.evidence and sources without exposing textExtracted.
- Add full test matrix listed in this document.
- Keep existing tests green and do not add embeddings, client portal, integrations, or export work.
