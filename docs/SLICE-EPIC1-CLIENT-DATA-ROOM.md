# Epic 1: Client Data Room Foundation

**Status:** IMPLEMENTED ✅

**Commit:** (to be updated)

## Overview

Client Data Room Foundation provides secure file storage and management for client-provided evidence, documents, and supporting materials within engagements.

This epic establishes the foundational infrastructure for evidence collection without external integrations, maintaining FullSendOS's file-based persistence model.

## Scope: What's Included

### ✅ File Storage & Management
- **File Upload:** Multipart/form-data upload with MIME type validation
- **File Metadata:** Name, size, description, tags, upload timestamp, uploader
- **File Classification:** Types (document, research, contract, financial, correspondence, media, other)
- **Soft Delete:** Archive files without permanent loss
- **Tagging & Search:** Classify and retrieve files by tags, name, or type

### ✅ Quota & Validation
- **Per-File Limit:** 100MB max per file
- **Per-Engagement Limit:** 5GB max per engagement
- **MIME Type Validation:** Allowed types restrict to common formats (PDF, Word, Excel, images, text)
- **Metadata Validation:** Description and tags optional; engagementId required

### ✅ Safe Data Handling
- **Storage Isolation:** Files stored in `data/uploads/` with internal path references
- **API Response Filtering:** Safe response schemas omit internal `storagePath`
- **No Prompt Wiring:** File contents are NOT read or wired into agent prompts (out of scope)

### ✅ API Endpoints
- `GET /api/engagements/[id]/data-room` — List files with optional filtering (tags, name, type)
- `POST /api/engagements/[id]/data-room` — Upload new file with metadata
- `GET /api/engagements/[id]/data-room/[fileId]` — Get file metadata
- `PATCH /api/engagements/[id]/data-room/[fileId]` — Update description, tags, type
- `DELETE /api/engagements/[id]/data-room/[fileId]` — Archive file

### ✅ UI Component
- `DataRoomPanel` — React component with upload form, file list, and delete actions
- Inline styling for standalone usage
- Loading states, error handling, file size/date formatting

### ✅ Persistence
- File-based JSON: `data/clients/[engagementId].json` stores metadata
- Files uploaded to: `data/uploads/[engagementId]-[timestamp]-[filename]`
- Automatic directory creation on first use
- Atomic writes with full JSON serialization

## Scope: What's NOT Included (Out of Scope)

- ❌ **File Downloads** — No streaming file retrieval endpoint yet
- ❌ **Integrations** — No QuickBooks, external storage, CDN, or S3
- ❌ **Portal** — No client-facing self-service portal
- ❌ **Prompt Wiring** — File contents not read or sent to AI agents
- ❌ **Advanced Permissions** — No per-file sharing, access control lists, or team workflows
- ❌ **Full-Text Search** — Tags and name search only
- ❌ **Versioning** — No file history or version tracking
- ❌ **Indexing** — No full-text indexing of file contents
- ❌ **Rate Limiting** — No request throttling (apply at reverse proxy layer)

## Architecture

### Schema Layer (`schemas/client-data-room.ts`)
```typescript
FileReference {
  id, name, type, mimeType, size, uploadedAt, uploadedBy, 
  description, tags, engagementId, storagePath, isArchived
}

ClientDataRoom {
  engagementId, files[], createdAt, updatedAt, fileCount, totalSize
}

FileReferenceSafe (omits storagePath for API responses)
```

### Service Layer (`services/client-data-room-store.ts`)
- **loadClientDataRoom(engagementId)** — Initialize or load existing data room
- **addFileReference(...)** — Upload file with quota validation
- **listFiles(engagementId)** — Get non-archived files
- **getFileReference(engagementId, fileId)** — Retrieve specific file
- **updateFileMetadata(...)** — Modify description, tags, type
- **archiveFile(engagementId, fileId)** — Soft delete
- **searchFiles(engagementId, query)** — Filter by tags, name, type

### API Routes (`app/api/engagements/[id]/data-room/[...route].ts`)
- All routes use safe response schemas
- Multipart form handling with automatic directory creation
- Error messages provided to client
- MIME type validation enforced

### UI Component (`app/components/data-room-panel.tsx`)
- Standalone React component
- Form controls for upload (file, type, description, tags)
- File list with metadata display
- Delete confirmation dialogs
- Loading and error states

## Testing (9 tests, all passing)

```
✔ Client Data Room — loadClientDataRoom initializes new data room
✔ Client Data Room — addFileReference adds file to data room
✔ Client Data Room — listFiles returns non-archived files
✔ Client Data Room — getFileReference retrieves by ID
✔ Client Data Room — updateFileMetadata modifies description/tags
✔ Client Data Room — searchFiles filters by tags and name
✔ Client Data Room — archiveFile soft-deletes and updates counts
✔ Client Data Room — file size validation rejects oversized files
✔ Client Data Room — total storage quota validation
```

**Total Test Suite:** 256 passing (247 prior + 9 new)

## Usage Example

### Upload File
```bash
curl -X POST http://localhost:3000/api/engagements/ENGAGEMENT-123/data-room \
  -F "file=@document.pdf" \
  -F "type=document" \
  -F "description=Client research findings" \
  -F "tags=research,Q1,confidential"
```

### List Files
```bash
curl http://localhost:3000/api/engagements/ENGAGEMENT-123/data-room
curl http://localhost:3000/api/engagements/ENGAGEMENT-123/data-room?tags=research
```

### Update Metadata
```bash
curl -X PATCH http://localhost:3000/api/engagements/ENGAGEMENT-123/data-room/FILE-123 \
  -H "Content-Type: application/json" \
  -d '{"tags":["important","updated"]}'
```

### Archive File
```bash
curl -X DELETE http://localhost:3000/api/engagements/ENGAGEMENT-123/data-room/FILE-123
```

## Next Steps (Future Epics)

1. **File Downloads** — Streaming endpoint with range requests and security checks
2. **Search Enhancement** — Full-text search on document content
3. **File Preview** — Thumbnails and inline preview for supported types
4. **Access Control** — Per-file sharing and team collaboration
5. **Client Portal** — Public/authenticated file sharing interface
6. **Integrations** — Connect to QuickBooks, external storage
7. **Prompt Wiring** — Read file contents and inject into agent prompts (Phase 2+)

## Technical Decisions

### Why File-Based Persistence?
- Consistency with existing `data/projects`, `data/clients`, `data/agent-tasks` model
- No database migration overhead
- Simple to backup, version control, and inspect
- Suitable for MVP through small-team deployment

### Why 5GB Engagement Limit?
- Reasonable for small-team consulting workflow
- 100MB/file prevents individual file DOS
- Can be tuned per deployment
- Encourages evidence organization vs. bulk dumps

### Why Soft Delete (Archive)?
- Preserves audit trail and file references
- Reduces complexity of cascade deletes
- Enables recovery if deleted by mistake
- Engaged status/counts remain consistent

### Why No Download Endpoint in V1?
- Can be added post-MVP without schema changes
- Requires security hardening (streaming, range requests, disk space checks)
- File paths already managed safely (storagePath never exposed to client)

## Safety & Privacy

✅ **Never exposes internal storage paths in API responses**
✅ **Validates MIME types to prevent script execution**
✅ **Enforces quota to prevent disk exhaustion**
✅ **Soft-deletes preserve audit trails**
✅ **No automatic prompting with file content (scope boundary)**
✅ **Safe response schemas omit pathological fields**

---

## Deployment Checklist

- [x] Schema layer complete and tested
- [x] Service layer with quota validation
- [x] API routes with error handling
- [x] UI component with form state
- [x] All tests passing (256 suite)
- [x] TypeScript compilation successful
- [x] Next.js dynamic route params updated for v16
- [x] Documentation complete

Ready for deployment to `feature/alpha-dashboard`.
