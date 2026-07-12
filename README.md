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
XAI_DEV_FALLBACK=true
PORT=3000
```

The API key stays on the server and is never stored in the browser.
When `XAI_API_KEY` is missing in local development, `XAI_DEV_FALLBACK=true` enables a deterministic workflow fallback so the run interaction remains testable. In production, `XAI_API_KEY` is still required.

## Product workflow

1. Create an engagement.
2. Enter only verified client context.
3. Run the departments.
4. Watch outputs validate and populate the project record.
5. Review open unknowns and evidence.
6. Open the client report.
7. Download Markdown, save a PDF through Print, or export the project JSON.

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
```

## Important limitation

This build does not yet perform independent live web research. The model receives the project evidence register and must label unsupported information as an estimate, assumption, recommendation, or unknown. The next production layer should add a controlled research connector and capture retrieved sources before analysis.
