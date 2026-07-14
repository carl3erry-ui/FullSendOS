"use client";

import { useEffect, useMemo, useState } from "react";

type ExportFormat = "markdown" | "html" | "text" | "json";

type ExportSummary = {
  id: string;
  format: ExportFormat;
  filename: string;
  generatedAt: string;
  byteSize: number;
  status: string;
  contentType: string;
};

type ExportDetail = ExportSummary & {
  title: string;
  content: string;
  exportMetadata: {
    generatedBy: string;
    generatedAt: string;
    engagementTitle: string;
    clientName?: string;
    includedSections: string[];
    evidenceReferenceCount: number;
    assumptionCount: number;
    openQuestionCount: number;
    humanConfirmationCount: number;
  };
};

type DeliverableExportPanelProps = {
  engagementId: string;
  disableAutoLoad?: boolean;
  initialExports?: ExportSummary[];
};

const FORMATS: ExportFormat[] = ["markdown", "html", "text", "json"];

function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DeliverableExportPanel({ engagementId, disableAutoLoad = false, initialExports = [] }: DeliverableExportPanelProps) {
  const [exports, setExports] = useState<ExportSummary[]>(initialExports);
  const [activeExport, setActiveExport] = useState<ExportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(!disableAutoLoad);
  const [isGenerating, setIsGenerating] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apiBase = useMemo(() => `/api/engagements/${engagementId}/exports`, [engagementId]);

  async function loadExports(options: { clearError?: boolean } = {}) {
    if (options.clearError ?? true) setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(apiBase, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load exports.");
      }
      setExports(Array.isArray(data) ? data : []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load exports.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateExport(format: ExportFormat) {
    setError(null);
    setNotice(null);
    setIsGenerating(format);
    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to generate export.");
      }
      setNotice(`${format.toUpperCase()} export generated.`);
      await loadExports({ clearError: false });
      setActiveExport(data);
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "Unable to generate export.";
      setError(message);
    } finally {
      setIsGenerating(null);
    }
  }

  async function openExport(exportId: string) {
    setError(null);
    try {
      const response = await fetch(`${apiBase}/${exportId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load export detail.");
      }
      setActiveExport(data as ExportDetail);
    } catch (openError) {
      const message = openError instanceof Error ? openError.message : "Unable to load export detail.";
      setError(message);
    }
  }

  async function copyContent() {
    if (!activeExport?.content) return;
    try {
      await navigator.clipboard.writeText(activeExport.content);
      setNotice("Export content copied.");
    } catch {
      setNotice("Copy not available in this browser context.");
    }
  }

  useEffect(() => {
    if (disableAutoLoad) return;
    void loadExports();
  }, [disableAutoLoad, apiBase]);

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Export Deliverables</h3>
        <p className="mt-1 text-sm text-slate-400">
          Generate a safe export package from the executive report, summary, deck outline, sources, assumptions, open questions, and confirmations.
        </p>
      </div>

      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">{notice}</div>}

      <div className="flex flex-wrap gap-2">
        {FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            className="rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void generateExport(format)}
            disabled={Boolean(isGenerating)}
          >
            {isGenerating === format ? `Generating ${format.toUpperCase()}...` : `Export ${format.toUpperCase()}`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">Generated Exports</p>
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
            onClick={() => void loadExports()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {!isLoading && exports.length === 0 && (
          <p className="rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2 text-sm text-slate-400">
            No exports have been generated yet.
          </p>
        )}

        {isLoading && <p className="text-sm text-slate-400">Loading exports...</p>}

        {exports.map((record) => (
          <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
            <div className="text-sm text-slate-200">
              <p className="font-medium">{record.filename}</p>
              <p className="text-xs text-slate-400">
                {record.format.toUpperCase()} | {new Date(record.generatedAt).toLocaleString()} | {bytesLabel(record.byteSize)}
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
              onClick={() => void openExport(record.id)}
            >
              Open
            </button>
          </div>
        ))}
      </div>

      {activeExport && (
        <article className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-100">{activeExport.title}</p>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
              onClick={() => void copyContent()}
            >
              Copy content
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Generated: {new Date(activeExport.generatedAt).toLocaleString()} | Sections: {activeExport.exportMetadata.includedSections.length}
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-200">
            {activeExport.content}
          </pre>
        </article>
      )}
    </section>
  );
}
