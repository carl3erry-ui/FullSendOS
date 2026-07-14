# Epic 1.1: Client-Level Data Room

Status: Implemented

## Overview

Epic 1.1 promotes Data Room ownership from engagement-level storage to client-level storage.

- Client is the source of truth for folders, files, and quota.
- Engagement routes remain supported as compatibility views.
- Engagement linkage is optional per file via `engagementIds[]`.

## In Scope

### Client-first storage model

- Metadata persisted in `data/clients/[clientId]-data-room.json`.
- Uploaded binary files persisted in `data/uploads/`.
- Files include required `clientId` and `folderId`.
- Files may include zero or more `engagementIds`.

### Default folder system

System folders are created automatically for each client room:

1. `financials`
2. `brand`
3. `legal`
4. `operations`
5. `marketing`
6. `website`
7. `investor`
8. `real-estate`
9. `hr`
10. `misc`

### Service behavior

- 100MB max per file.
- 5GB max total active storage per client room.
- Soft-delete (`isArchived`) for removal.
- Search/filter supports `folderId`, `engagementId`, `tags`, `name`, and `type`.
- Safe response schema omits `storagePath`.

### API surface

Client routes:

- `GET /api/clients/[clientId]/data-room`
- `GET /api/clients/[clientId]/data-room/folders`
- `GET /api/clients/[clientId]/data-room/files`
- `POST /api/clients/[clientId]/data-room/files`
- `GET /api/clients/[clientId]/data-room/files/[fileId]`
- `PATCH /api/clients/[clientId]/data-room/files/[fileId]`
- `DELETE /api/clients/[clientId]/data-room/files/[fileId]`
- `POST /api/clients/[clientId]/data-room/files/[fileId]/process`
- `GET /api/clients/[clientId]/data-room/documents`
- `GET /api/clients/[clientId]/data-room/documents/[documentId]`

Engagement compatibility routes:

- `GET /api/engagements/[id]/data-room`
- `POST /api/engagements/[id]/data-room`
- `GET /api/engagements/[id]/data-room/folders`
- `GET /api/engagements/[id]/data-room/[fileId]`
- `PATCH /api/engagements/[id]/data-room/[fileId]`
- `DELETE /api/engagements/[id]/data-room/[fileId]`
- `POST /api/engagements/[id]/data-room/[fileId]/process`
- `GET /api/engagements/[id]/data-room/documents`

Compatibility routes resolve engagement owner via project lookup, then delegate to the client data room while enforcing engagement-level filtering.

### UI updates

`DataRoomPanel` supports:

- folder loading
- folder filter for file listing
- folder selection on upload
- existing engagement endpoint compatibility
- manual file processing action with policy guardrails
- processing status and safe parsed metadata previews

## Out of Scope (Explicit)

- No QuickBooks or external integrations.
- No client portal.
- No prompt wiring of uploaded file content.
- No deliverable export changes.
- No rate limiting in this slice.

### Parsing/Indexing Foundation Scope (Slice 12)

- Safe parsing/indexing foundation is now implemented for selected text-like formats (`txt`, `md`, `csv`, `json`, `xml`).
- Parsed records are metadata-first and stored separately from file upload references.
- Internal extracted text is never returned from safe document APIs.
- Sensitive files and unapproved files are intentionally skipped.

### Parsing/Indexing Still Out of Scope

- No embeddings/vector database retrieval.
- No automatic injection of parsed content into agent prompts.
- No raw file-content exposure from public APIs.
- No client portal/export/email workflow changes.

## Architecture Summary

Core schema types in `schemas/client-data-room.ts`:

- `DataRoomFolder`
- `FileReference`
- `ClientDataRoom`
- `FileReferenceSafe`

Core service functions in `services/client-data-room-store.ts`:

- `loadClientDataRoom`
- `addFileReference`
- `listFiles`
- `getFileReference`
- `archiveFile`
- `updateFileMetadata`
- `searchFiles`
- `getFolders`
- `linkFileToEngagement`
- `unlinkFileFromEngagement`

Core slice-12 services:

- `services/data-room-document-parser.ts`
- `services/data-room-document-store.ts`
- `services/data-room-processing-service.ts`

## Validation and Testing

Added and updated coverage includes:

- client room initialization with default folders
- stable folder IDs and sorting
- client-level file upload and metadata ownership
- folder and engagement filtering
- engagement link/unlink behavior
- safe schema behavior (`storagePath` omitted)
- metadata update behavior for flags and linkage
- quota and max file-size enforcement
- engagement compatibility route delegation and filtering
- engagement route patch/delete on client-owned files
- 404 behavior for unknown engagements

## Data Ownership Rule

Single source of truth:

- Files are stored once in the client room.
- Engagement routes must not create duplicate engagement-owned data room records.
- Engagement routes are scoped projections over client-owned files.
