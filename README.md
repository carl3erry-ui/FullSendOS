# FullSendOS — Next.js Migration

A full-stack AI consulting workspace built with Next.js App Router, React, TypeScript, Zod, and xAI.

## What changed

- Replaced Express + static HTML with Next.js App Router
- Replaced browser log output with a project dashboard
- Preserved the master project schema and seven department contracts
- Preserved validation, JSON repair, evidence controls, local persistence, and downloads
- Moved API endpoints into Next.js Route Handlers
- Added project detail pages, live polling, internal/client views, and export center

## Run on Windows

1. Double-click `start-windows.bat`.
2. Add your xAI key to `.env.local` when Notepad opens.
3. Keep the server window open.

Or manually:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

```env
XAI_API_KEY=your_real_key
XAI_MODEL=grok-4.5
```

Never commit `.env.local`.

## Current architecture

- `src/app` — pages and server Route Handlers
- `src/components` — dashboard and project workspace
- `src/lib/contracts` — strict department output contracts
- `src/lib/schemas` — project and evidence schemas
- `src/lib/orchestrator` — sequential AI workflow and repair pass
- `src/lib/storage` — local JSON project persistence
- `data/projects` — generated locally and ignored by Git

## Important production note

The local file store is appropriate for this stage. Before deploying to a serverless production host, move project persistence and background jobs to a durable database and job queue.
