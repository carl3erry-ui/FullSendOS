# Consulting OS — Full-Send Foundation

A local, runnable consulting workflow that converts a client brief into structured, validated department outputs and a unified client report.

## Included

- Master project schema and evidence registry
- Seven strict department contracts
- Dependency-aware xAI orchestrator
- Automated JSON repair pass
- Local project persistence
- Project dashboard and navigation
- Live department progress by polling
- Internal workspace vs. client report views
- Source and unknowns review screens
- Markdown, JSON, print/PDF export paths
- Server-side API key handling
- **Client Data Room** — per-project file and document storage with agent-use controls

## Requirements

- Node.js 20 or later
- An xAI API key with access to the configured model

## Start the application

### Windows PowerShell

```powershell
Expand-Archive consulting-os-full-send.zip
cd consulting-os-full-send
Copy-Item .env.example .env
notepad .env
npm install
npm start
```

### macOS or Linux

```bash
unzip consulting-os-full-send.zip
cd consulting-os-full-send
cp .env.example .env
# Edit .env and add the API key
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## Environment file

```env
XAI_API_KEY=your_real_xai_key
XAI_MODEL=grok-4.5
PORT=3000
```

The API key stays on the server and is never stored in the browser.

## Product workflow

1. Create an engagement.
2. Enter only verified client context.
3. Run the departments.
4. Watch outputs validate and populate the project record.
5. Review open unknowns and evidence.
6. Open the client report.
7. Download Markdown, save a PDF through Print, or export the project JSON.
8. Use the **Data Room** tab to upload or register supporting source materials.

## Architecture

```text
Client brief
  -> Master project object
  -> Research
  -> Competitors
  -> Customers
  -> Strategy
  -> Brand
  -> Website
  -> Publishing
  -> Client report + one-page summary + deck outline

Project (client)
  -> Data Room
     -> Default folders (Financials, Brand Assets, Legal, Operations, Marketing,
        Website, Investor Materials, Real Estate, HR/Payroll, Miscellaneous)
     -> Files (metadata records + optional local binary storage)
```

## Client Data Room

Each project has an associated Client Data Room for organizing source materials:

### Default folder structure

| Folder | Slug | Category |
|---|---|---|
| Financials | financials | finance |
| Brand Assets | brand-assets | brand |
| Legal | legal | legal |
| Operations | operations | operations |
| Marketing | marketing | marketing |
| Website | website | digital |
| Investor Materials | investor-materials | investors |
| Real Estate | real-estate | real-estate |
| HR / Payroll | hr-payroll | hr |
| Miscellaneous | miscellaneous | general |

Folder slugs are stable — they do not change if a folder is renamed.

### Supported file types (upload and registration)

**Documents:** PDF, DOCX, TXT, MD, RTF  
**Spreadsheets:** XLSX, CSV  
**Presentations:** PPTX  
**Images:** PNG, JPG, JPEG, WEBP, SVG  
**Archives:** ZIP  
**Accounting/export (metadata policy only):** QBO, OFX, IIF, JSON, XML

### Dangerous file types — always rejected

EXE, DLL, BAT, CMD, SH, JS, TS, JSX, TSX, HTML, PHP, PY, JAR, SCR, MSI, APP, DMG, PS1, VBS, WSF, REG, LNK, and other executable or script formats.

### Storage approach

- File metadata is stored as JSON in `data/data-rooms/{projectId}/`
- Uploaded binary files are stored in `data/data-room-files/{projectId}/`
- The `data/` directory is gitignored — uploaded files are never committed
- Filenames are sanitized to prevent path traversal
- Original filenames are never used as storage paths

### Metadata vs file contents

The data room stores **metadata only** by default. File contents are not parsed, indexed, or OCR'd in this release.

### Agent-use controls

Each file record includes:
- `approvedForAgentUse` — whether this file may be used by an agent in future workflows (default: false)
- `sensitive` — whether the file contains sensitive information (default: false)
- `visibility` — `internal` or `client_visible_later`
- `status` — `uploaded | registered | processing_pending | ready | rejected`

**Agents cannot automatically read file contents in this release.** The approval metadata prepares the foundation for controlled file retrieval in future releases.

### Data Room API routes

```
GET    /api/projects/:id/data-room
GET    /api/projects/:id/data-room/folders
POST   /api/projects/:id/data-room/folders
GET    /api/projects/:id/data-room/files
POST   /api/projects/:id/data-room/files
GET    /api/projects/:id/data-room/files/:fileId
PATCH  /api/projects/:id/data-room/files/:fileId
DELETE /api/projects/:id/data-room/files/:fileId
```

File upload supports:
- `application/json` — metadata registration (no binary file required)
- `application/octet-stream` — binary file upload with `x-file-name`, `x-folder-id`, `x-display-name`, `x-description`, `x-tags`, `x-engagement-id` headers

### Current limitations

- No file parsing, text extraction, OCR, or indexing
- No embedding or semantic search over file contents
- No client portal access (admin/internal workspace only)
- No QuickBooks, Google Drive, or third-party integrations
- No per-folder or per-file permission model beyond visibility flags
- Binary files are stored locally (no S3/GCS/Supabase in this release)

### Future roadmap

- File content parsing and text extraction
- Embedding generation for semantic search
- Per-engagement file access controls
- Client portal file access layer
- Cloud storage backend (S3/GCS/Supabase)
- QuickBooks and Drive integrations

## Important limitation

This build does not yet perform independent live web research. The model receives the project evidence register and must label unsupported information as an estimate, assumption, recommendation, or unknown. The next production layer should add a controlled research connector and capture retrieved sources before analysis.

