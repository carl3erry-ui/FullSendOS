"use client";

import { useEffect, useState } from "react";
import {
  filterClientSafeEngagement,
  filterClientSafeDeliverable,
  getDefaultClientPortalVisibility,
  type ClientSafeEngagement,
  type ClientSafeDeliverable,
} from "@/lib/client-portal/client-portal-access";
import { getSafeResponseError, parseJsonResponseSafely } from "@/app/components/safe-json-response";

type ClientSummary = {
  id: string;
  name: string;
  industry: string;
  website: string;
  primaryContact: string;
  lifecycleStatus: string;
  engagementCount: number;
  baseline?: {
    companyOverview?: {
      companyName?: string;
      industry?: string;
    };
    goals?: {
      engagementPurpose?: string;
    };
    availableDocuments?: string[];
  };
  engagements: Array<{
    id: string;
    companyName: string;
    objective: string;
    status: string;
    completedDepartments: number;
    totalDepartments: number;
    updatedAt?: string;
  }>;
};

type ExportRecord = {
  id: string;
  format: string;
  filename: string;
  generatedAt: string;
};

export default function ClientPortalPage({ params }: { params: Promise<{ clientId: string }> }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [engagements, setEngagements] = useState<ClientSafeEngagement[]>([]);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [deliverable, setDeliverable] = useState<ClientSafeDeliverable | null>(null);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"overview" | "deliverables" | "data-room" | "feedback">("overview");

  useEffect(() => {
    params.then((p) => setClientId(p.clientId));
  }, [params]);

  useEffect(() => {
    if (!clientId) return;

    (async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
        const parsed = await parseJsonResponseSafely<ClientSummary>(response);
        const parseError = getSafeResponseError(parsed, "Client not found.");
        if (parseError) throw new Error(parseError);
        const data = parsed.data;
        if (!data) throw new Error("Client not found.");

        setClient(data as ClientSummary);

        const safeEngagements = (data.engagements || []).map(
          (eng: ClientSummary["engagements"][number]) => filterClientSafeEngagement(eng),
        );
        setEngagements(safeEngagements);

        if (safeEngagements.length > 0) {
          setSelectedEngagementId(safeEngagements[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load client portal.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [clientId]);

  useEffect(() => {
    if (!selectedEngagementId || !client) return;

    (async () => {
      try {
        const [engResponse, exportsResponse] = await Promise.all([
          fetch(`/api/engagements/${selectedEngagementId}`, { cache: "no-store" }),
          fetch(`/api/engagements/${selectedEngagementId}/exports`, { cache: "no-store" }),
        ]);

        const parsedEngagement = await parseJsonResponseSafely(engResponse);
        if (getSafeResponseError(parsedEngagement, "Unable to load engagement detail.")) {
          return;
        }
        const engData = parsedEngagement.data as Record<string, unknown>;

        const parsedExports = await parseJsonResponseSafely<ExportRecord[]>(exportsResponse);
        if (getSafeResponseError(parsedExports, "Unable to load export list.")) {
          return;
        }
        const exportsData = parsedExports.data;
        const exportList: ExportRecord[] = Array.isArray(exportsData) ? exportsData : [];
        setExports(exportList);

        const deliverables =
          engData.deliverables && typeof engData.deliverables === "object"
            ? (engData.deliverables as {
                executiveReport?: string;
                onePageSummary?: string;
                deckOutline?: unknown[];
              })
            : undefined;

        const safe = filterClientSafeDeliverable({
          engagementId: selectedEngagementId,
          engagementTitle: client.name,
          status: typeof engData.status === "string" ? engData.status : "draft",
          deliverables,
          exportCount: exportList.length,
          updatedAt: typeof engData.updatedAt === "string" ? engData.updatedAt : undefined,
        });
        setDeliverable(safe);
      } catch {
        // Keep portal visible even if engagement detail fails
      }
    })();
  }, [selectedEngagementId, client]);

  const visibility = clientId ? getDefaultClientPortalVisibility(clientId) : null;
  const isDemo = clientId?.startsWith("DEMO-");

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-slate-400">Loading client portal...</p>
        </div>
      </main>
    );
  }

  if (error || !client) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-rose-800 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {error || "Client not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">

        {/* Portal header */}
        <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Client Portal</p>
                {isDemo && (
                  <span className="rounded-full border border-indigo-700 bg-indigo-950/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-indigo-300">
                    Demo
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-50">{client.name}</h1>
              {client.industry && (
                <p className="mt-1 text-sm text-slate-400">{client.industry}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${client.lifecycleStatus === "active" ? "border-emerald-700 bg-emerald-950/30 text-emerald-300" : "border-slate-700 text-slate-400"}`}>
                {client.lifecycleStatus || "active"}
              </span>
              <p className="text-xs text-slate-500">{client.engagementCount} engagement{client.engagementCount !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {isDemo && (
            <div className="mt-4 rounded-lg border border-indigo-800 bg-indigo-950/20 px-3 py-2 text-sm text-indigo-200">
              Demo Client Portal — Fictional sample data only. Not a real client account.
            </div>
          )}
        </header>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-1">
          {(["overview", "deliverables", "data-room", "feedback"] as const).map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 text-sm font-medium capitalize transition ${activeSection === section ? "border-b-2 border-cyan-500 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              {section === "data-room" ? "Data Room" : section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeSection === "overview" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Engagement Overview</h2>
            {engagements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
                <p className="text-sm text-slate-300">No active engagements yet.</p>
                <p className="mt-1 text-xs text-slate-500">Your consulting team will create an engagement when work begins.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {engagements.map((eng) => (
                  <div
                    key={eng.id}
                    className={`cursor-pointer rounded-xl border p-4 transition ${selectedEngagementId === eng.id ? "border-cyan-600 bg-cyan-950/20" : "border-slate-800 bg-slate-950/50 hover:border-slate-600"}`}
                    onClick={() => setSelectedEngagementId(eng.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{eng.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{eng.readableStatus}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${eng.status === "needs-review" || eng.status === "complete" ? "border-emerald-700 bg-emerald-950/30 text-emerald-300" : eng.status === "running" ? "border-cyan-700 bg-cyan-950/30 text-cyan-300" : "border-slate-700 text-slate-400"}`}>
                        {eng.readableStatus}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-800">
                      <div
                        className="h-full bg-cyan-600 transition-all"
                        style={{ width: `${eng.totalDepartments > 0 ? Math.round((eng.completedDepartments / eng.totalDepartments) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{eng.completedDepartments}/{eng.totalDepartments} departments complete</p>
                  </div>
                ))}
              </div>
            )}

            {/* Onboarding status */}
            {client.baseline && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-sm font-semibold text-slate-200">Company Baseline</p>
                <p className="mt-1 text-sm text-slate-400">
                  {client.baseline.goals?.engagementPurpose || "Company context has been captured for this engagement."}
                </p>
                {Array.isArray(client.baseline.availableDocuments) && client.baseline.availableDocuments.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Documents on file: {client.baseline.availableDocuments.slice(0, 4).join(", ")}
                    {client.baseline.availableDocuments.length > 4 ? ` +${client.baseline.availableDocuments.length - 4} more` : ""}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Deliverables */}
        {activeSection === "deliverables" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Executive Deliverables</h2>
            {!deliverable ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
                <p className="text-sm text-slate-300">No deliverables available yet.</p>
                <p className="mt-1 text-xs text-slate-500">Deliverables will appear here once the AI Workforce completes and a human review is done.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-xl border p-5 ${deliverable.isClientApproved ? "border-emerald-800 bg-emerald-950/20" : "border-amber-800 bg-amber-950/20"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-base font-semibold text-slate-100">{deliverable.title}</p>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${deliverable.isClientApproved ? "border-emerald-700 bg-emerald-950/40 text-emerald-200" : "border-amber-700 bg-amber-950/40 text-amber-200"}`}>
                      {deliverable.readinessLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{deliverable.readinessDisclaimer}</p>
                  {deliverable.safePreviewText && (
                    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Preview</p>
                      <p className="mt-1 text-sm text-slate-300">{deliverable.safePreviewText}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    {deliverable.hasExecutiveReport && <span className="rounded border border-slate-700 px-2 py-0.5">Executive Report</span>}
                    {deliverable.hasOnePageSummary && <span className="rounded border border-slate-700 px-2 py-0.5">One-Page Summary</span>}
                    {deliverable.hasDeckOutline && <span className="rounded border border-slate-700 px-2 py-0.5">Deck Outline</span>}
                  </div>
                  {deliverable.lastUpdated && (
                    <p className="mt-2 text-xs text-slate-500">Last updated: {new Date(deliverable.lastUpdated).toLocaleDateString()}</p>
                  )}
                </div>

                {/* Exports */}
                {exports.length > 0 && deliverable.isClientApproved && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-200">Available Downloads</p>
                    {exports.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                        <div>
                          <p className="text-sm text-slate-200">{exp.filename}</p>
                          <p className="text-xs text-slate-500">{exp.format.toUpperCase()} · {new Date(exp.generatedAt).toLocaleDateString()}</p>
                        </div>
                        <a
                          href={`/api/engagements/${selectedEngagementId}/exports/${exp.id}/download`}
                          className="rounded-lg border border-cyan-700 px-3 py-1 text-xs text-cyan-200 hover:border-cyan-500"
                          download
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {exports.length > 0 && !deliverable.isClientApproved && (
                  <div className="rounded-lg border border-amber-800 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
                    Downloads will be available after human review and client approval.
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Data Room */}
        {activeSection === "data-room" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Data Room</h2>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-sm text-slate-300">
                The Data Room holds documents and materials your consulting team needs to produce better work.
                Upload business plans, financials, brand guides, market research, and other supporting materials to improve AI Workforce output quality.
              </p>
              {visibility?.canUploadFiles ? (
                <button className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400">
                  Upload Document
                </button>
              ) : (
                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
                  File upload workflow coming soon — contact your consulting team to share documents.
                </div>
              )}
            </div>
            {client.baseline?.availableDocuments && client.baseline.availableDocuments.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-sm font-semibold text-slate-200">Documents on File</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {client.baseline.availableDocuments.map((doc) => (
                    <span key={doc} className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-xs text-slate-300">
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Feedback */}
        {activeSection === "feedback" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Feedback</h2>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-sm text-slate-300">
                Have questions about your deliverables or engagement progress? Use this space to share feedback or request changes.
              </p>
              <textarea
                className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder-slate-500"
                rows={4}
                placeholder="Share questions, feedback, or revision requests..."
                disabled
              />
              <p className="mt-2 text-xs text-slate-500">Feedback submission is coming soon. Contact your consulting team directly for now.</p>
              <button disabled className="mt-3 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-500 opacity-50 cursor-not-allowed">
                Submit Feedback (Coming Soon)
              </button>
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
