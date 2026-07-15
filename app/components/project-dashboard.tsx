"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardSummary } from "./dashboard-summary";
import { ProjectCard } from "./project-card";
import { ProjectForm, type ProjectFormState } from "./project-form";
import { ProjectWorkspace } from "./project-workspace";
import { AIWorkforceSection } from "./ai-workforce-section";
import { HumanInputCenter } from "./human-input-center";
import { DataRoomPanel } from "./data-room-panel";
import { ClientOnboardingWizard } from "./client-onboarding-wizard";
import { FirstRunDashboard } from "./first-run-dashboard";
import { GuidedTour } from "./guided-tour";
import { formatApiError, getApiErrorMessage, getApiFieldErrors } from "./api-error";
import type { ClientBaseline } from "@/schemas/client-baseline";
import {
  createPollController,
  hasRunningProjects,
  resolveRunTimeoutMessage,
  shouldStopPolling,
  WORKFLOW_POLL_INTERVAL_MS,
  WORKFLOW_POST_TIMEOUT_MS,
} from "./workflow-recovery";

type ProjectSummary = {
  id: string;
  clientId?: string | null;
  companyName: string;
  objective: string;
  status: string;
  lifecycleStatus?: "active" | "archived" | "deleted";
  archivedAt?: string | null;
  deletedAt?: string | null;
  updatedAt?: string;
  activeRunId?: string | null;
  activeRunUpdatedAt?: string | null;
  lastRunError?: string | null;
  completedDepartments: number;
  totalDepartments: number;
};

const initialForm: ProjectFormState = {
  companyName: "",
  objective: "",
  contactName: "",
  industry: "",
  website: "",
};

type ClientSummary = {
  id: string;
  name: string;
  industry: string;
  website: string;
  primaryContact: string;
  lifecycleStatus?: "active" | "archived" | "deleted";
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  engagementCount: number;
  lastActivityAt: string | null;
};

type ClientDetail = {
  id: string;
  name: string;
  industry: string;
  website: string;
  primaryContact: string;
  lifecycleStatus?: "active" | "archived" | "deleted";
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  engagementCount: number;
  engagements: ProjectSummary[];
  baseline?: ClientBaseline;
};

type ClientFormState = {
  name: string;
  industry: string;
  website: string;
  primaryContact: string;
};

const initialClientForm: ClientFormState = {
  name: "",
  industry: "",
  website: "",
  primaryContact: "",
};

const engagementDeliverables = [
  { id: "market-research", label: "Market Research" },
  { id: "financial-model", label: "Financial Model" },
  { id: "investor-deck", label: "Investor Deck" },
  { id: "brand-strategy", label: "Brand Strategy" },
  { id: "expansion-plan", label: "Expansion Plan" },
];

const executivePipeline = [
  "Research",
  "Competitors",
  "Customers",
  "Strategy",
  "Brand",
  "Website",
  "Publishing",
];

export function ProjectDashboard() {
  const [view, setView] = useState<"engagements" | "ai-workforce" | "human-input">("engagements");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [clientForm, setClientForm] = useState<ClientFormState>(initialClientForm);
  const [clientObjective, setClientObjective] = useState("");
  const [requestedDeliverables, setRequestedDeliverables] = useState<string[]>(engagementDeliverables.map((item) => item.id));
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isCreatingClientEngagement, setIsCreatingClientEngagement] = useState(false);
  const [isClientLoading, setIsClientLoading] = useState(true);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [runningProjectId, setRunningProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [updatingLifecycleId, setUpdatingLifecycleId] = useState<string | null>(null);

  const pollControllerRef = useRef<ReturnType<typeof createPollController> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function lifecycleQueryString() {
    const params = new URLSearchParams();
    if (showArchived) params.set("includeArchived", "true");
    if (showDeleted) params.set("includeDeleted", "true");
    return params.toString();
  }

  async function loadProjects(options: { clearError?: boolean } = {}) {
    const shouldClearError = options.clearError ?? true;
    if (shouldClearError) setError(null);
    const query = lifecycleQueryString();
    const response = await fetch(query ? `/api/engagements?${query}` : "/api/engagements", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Unable to load engagements.");
    }

    const nextProjects = Array.isArray(data) ? data : [];
    setProjects(nextProjects);

    if (!selectedProjectId && nextProjects.length > 0) {
      setSelectedProjectId(nextProjects[0].id);
    }

    return nextProjects;
  }

  async function loadClients(options: { clearError?: boolean } = {}) {
    const shouldClearError = options.clearError ?? true;
    if (shouldClearError) setError(null);
    const query = lifecycleQueryString();
    const response = await fetch(query ? `/api/clients?${query}` : "/api/clients", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Unable to load clients.");
    }

    const nextClients = Array.isArray(data) ? data : [];
    setClients(nextClients);

    if (!selectedClientId && nextClients.length > 0) {
      setSelectedClientId(nextClients[0].id);
    }

    return nextClients;
  }

  async function loadClientDetail(clientId: string, options: { clearError?: boolean } = {}) {
    const shouldClearError = options.clearError ?? true;
    if (shouldClearError) setError(null);

    const query = lifecycleQueryString();
    const response = await fetch(query ? `/api/clients/${clientId}?${query}` : `/api/clients/${clientId}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Unable to load client workspace.");
    }

    setSelectedClient(data as ClientDetail);
    return data as ClientDetail;
  }

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await Promise.all([loadProjects({ clearError: true }), loadClients({ clearError: true })]);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load engagements.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
          setIsClientLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [showArchived, showDeleted]);

  useEffect(() => {
    if (!selectedClientId) {
      setSelectedClient(null);
      setShowOnboardingWizard(false);
      return;
    }

    let active = true;
    setIsClientLoading(true);
    setShowOnboardingWizard(false);

    (async () => {
      try {
        const detail = await loadClientDetail(selectedClientId, { clearError: false });
        if (!active) return;
        setSelectedClient(detail);
      } catch (clientError) {
        if (!active) return;
        const message = clientError instanceof Error ? clientError.message : "Unable to load client workspace.";
        setError(message);
      } finally {
        if (active) setIsClientLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedClientId, showArchived, showDeleted]);

  const hasRunning = useMemo(() => hasRunningProjects(projects), [projects]);

  useEffect(() => {
    if (!hasRunning) {
      pollControllerRef.current?.stop();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const controller = createPollController(async () => {
      const refreshed = await loadProjects({ clearError: false });
      if (shouldStopPolling(refreshed)) {
        controller.stop();
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    });

    pollControllerRef.current = controller;
    pollTimerRef.current = setInterval(() => {
      void controller.tick().catch(() => {
        // Keep polling active even if one cycle fails.
      });
    }, WORKFLOW_POLL_INTERVAL_MS);

    return () => {
      controller.stop();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [hasRunning]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          contactName: form.contactName || undefined,
          industry: form.industry || undefined,
          website: form.website || undefined,
          objective: form.objective,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(formatApiError(data, "Unable to create engagement.", { includeFieldErrors: true }));
      }

      setForm(initialForm);
      await loadProjects({ clearError: true });
      setNotice(`Engagement ${data?.id || "created"} successfully.`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create engagement.";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateClient(event: React.FormEvent) {
    event.preventDefault();
    setIsCreatingClient(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clientForm.name,
          industry: clientForm.industry || undefined,
          website: clientForm.website || undefined,
          primaryContact: clientForm.primaryContact || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(formatApiError(data, "Unable to create client.", { includeFieldErrors: true }));
      }

      setClientForm(initialClientForm);
      setSelectedClientId(data.id);
      await Promise.all([loadClients({ clearError: false }), loadClientDetail(data.id, { clearError: false })]);
      setNotice(`Client ${data?.name || "created"} successfully.`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create client.";
      setError(message);
    } finally {
      setIsCreatingClient(false);
    }
  }

  async function handleCreateClientEngagement(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedClient) {
      setError("Select a client before creating a client-linked engagement.");
      return;
    }

    if (!requestedDeliverables.length) {
      setError("Select at least one deliverable before starting an engagement.");
      return;
    }

    setIsCreatingClientEngagement(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          companyName: selectedClient.name,
          contactName: selectedClient.primaryContact || undefined,
          industry: selectedClient.industry || undefined,
          website: selectedClient.website || undefined,
          objective: clientObjective,
          requestedDeliverables,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const details = getApiFieldErrors(data);
        const base = getApiErrorMessage(data, "Unable to create client engagement.");
        throw new Error(details.length ? `${base} ${details.slice(0, 3).join(" | ")}` : base);
      }

      setClientObjective("");
      setSelectedProjectId(data.id);
      await Promise.all([
        loadProjects({ clearError: false }),
        loadClients({ clearError: false }),
        loadClientDetail(selectedClient.id, { clearError: false }),
      ]);
      setNotice(`Engagement ${data?.id || "created"} for ${selectedClient.name}.`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create client engagement.";
      setError(message);
    } finally {
      setIsCreatingClientEngagement(false);
    }
  }

  async function handleRun(projectId: string) {
    setRunningProjectId(projectId);
    setError(null);
    setNotice(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WORKFLOW_POST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`/api/engagements/${projectId}/run`, { method: "POST", signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json();

      if (!response.ok) {
        const details = getApiFieldErrors(data);
        const base = getApiErrorMessage(data, "Workflow could not be started.");
        const detailSuffix = details.length ? ` ${details.slice(0, 3).join(" | ")}` : "";
        throw new Error(`${base}${detailSuffix}`);
      }

      await loadProjects({ clearError: false });
      setNotice(`Workflow running for ${projectId}.`);
    } catch (runError) {
      const isTimeoutAbort = runError instanceof Error && runError.name === "AbortError";

      if (isTimeoutAbort) {
        try {
          const refreshedProjects = await loadProjects({ clearError: false });
          const refreshedProject = refreshedProjects.find((project) => project.id === projectId) || null;
          const recoveryMessage = resolveRunTimeoutMessage(refreshedProject);

          if (recoveryMessage) {
            setError(recoveryMessage);
          } else {
            setNotice(`Workflow running for ${projectId}.`);
          }
        } catch {
          setError("Workflow request timed out and project state could not be retrieved.");
        }
      } else {
        const message = runError instanceof Error ? runError.message : "Workflow could not be started.";
        setError(message);
      }
    } finally {
      setRunningProjectId(null);
    }
  }

  async function handleClientLifecycle(clientId: string, action: "archive" | "restore" | "delete") {
    if (action === "delete") {
      const confirmed = window.confirm(
        "Soft-delete this client? This hides the client from default views and preserves all linked engagements, Data Room files, and historical work products.",
      );
      if (!confirmed) return;
    }

    setUpdatingLifecycleId(`client:${clientId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, "Unable to update client lifecycle state."));
      }

      await Promise.all([
        loadClients({ clearError: false }),
        loadProjects({ clearError: false }),
        selectedClientId ? loadClientDetail(selectedClientId, { clearError: false }) : Promise.resolve(null),
      ]);
      setNotice(`Client ${action}d successfully.`);
    } catch (lifecycleError) {
      const message = lifecycleError instanceof Error ? lifecycleError.message : "Unable to update client lifecycle state.";
      setError(message);
    } finally {
      setUpdatingLifecycleId(null);
    }
  }

  async function handleEngagementLifecycle(projectId: string, action: "archive" | "restore" | "delete") {
    if (action === "delete") {
      const confirmed = window.confirm(
        "Soft-delete this engagement? This hides it from default lists and preserves all linked artifacts, Data Room evidence, human input history, and workflow audit data.",
      );
      if (!confirmed) return;
    }

    setUpdatingLifecycleId(`engagement:${projectId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/engagements/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, "Unable to update engagement lifecycle state."));
      }

      await Promise.all([
        loadProjects({ clearError: false }),
        loadClients({ clearError: false }),
        selectedClientId ? loadClientDetail(selectedClientId, { clearError: false }) : Promise.resolve(null),
      ]);
      setNotice(`Engagement ${action}d successfully.`);
    } catch (lifecycleError) {
      const message = lifecycleError instanceof Error ? lifecycleError.message : "Unable to update engagement lifecycle state.";
      setError(message);
    } finally {
      setUpdatingLifecycleId(null);
    }
  }

  const completeCount = projects.filter((project) => project.status === "complete").length;
  const readyForReviewProjects = projects.filter(
    (project) => project.status === "needs-review" || project.status === "complete",
  );
  const actionRequiredProjects = projects.filter((project) => project.status === "failed" || project.status === "draft");
  const latestExecutiveBriefs = [...readyForReviewProjects]
    .sort((left, right) => {
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 3);
  const recentWorkProducts = readyForReviewProjects.filter((project) => {
    if (!project.updatedAt) return false;
    const ageMs = Date.now() - new Date(project.updatedAt).getTime();
    return ageMs <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const selectedProjectStep = selectedProject ? Math.max(0, Math.min(selectedProject.completedDepartments, executivePipeline.length)) : 0;
  const selectedClientBaseline = selectedClient?.baseline || null;
  const baselineScore = selectedClientBaseline
    ? [
        selectedClientBaseline.companyOverview.companyName,
        selectedClientBaseline.companyOverview.industry,
        selectedClientBaseline.customers.targetCustomers,
        selectedClientBaseline.goals.engagementPurpose,
        selectedClientBaseline.availableDocuments.length ? "docs" : "",
      ].filter((item) => Boolean(String(item).trim())).length
    : 0;
  const baselinePercent = Math.round((baselineScore / 5) * 100);
  const needsOnboarding = !selectedClientBaseline || baselinePercent < 60;
  const estimatedMinutes = {
    min: Math.round(6 + requestedDeliverables.length * 1.2),
    max: Math.round(10 + requestedDeliverables.length * 1.6),
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-8 shadow-2xl shadow-slate-950/50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400">FullSendOS Executive OS</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-50">Client Command Center</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Manage client baselines, deploy the AI Workforce, review decision-ready deliverables, and export executive reports.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-right">
              <button
                onClick={() => {
                  setSelectedClientId(null);
                  setClientForm(initialClientForm);
                }}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow shadow-cyan-900/30 hover:bg-cyan-400"
              >
                + Onboard Client
              </button>
              <button
                onClick={() => setShowGuidedTour(true)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:border-slate-500"
              >
                Take Guided Tour
              </button>
            </div>
          </div>
        </header>

        {showGuidedTour && (
          <GuidedTour
            onClose={() => setShowGuidedTour(false)}
            onViewDemo={async () => {
              setShowGuidedTour(false);
              try {
                await Promise.all([loadClients({ clearError: false }), loadProjects({ clearError: false })]);
              } catch {
                // Refresh if needed
              }
            }}
          />
        )}

        {/* View Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setView("engagements")}
            className={`px-4 py-2 text-sm font-medium ${
              view === "engagements"
                ? "border-b-2 border-cyan-500 text-cyan-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Engagements
          </button>
          <button
            onClick={() => setView("ai-workforce")}
            className={`px-4 py-2 text-sm font-medium ${
              view === "ai-workforce"
                ? "border-b-2 border-cyan-500 text-cyan-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            AI Workforce
          </button>
          <button
            onClick={() => setView("human-input")}
            className={`px-4 py-2 text-sm font-medium ${
              view === "human-input"
                ? "border-b-2 border-cyan-500 text-cyan-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Human Input / Action Center
          </button>
        </div>

        {/* AI Workforce View */}
        {view === "ai-workforce" && <AIWorkforceSection />}

        {/* Human Input View */}
        {view === "human-input" && <HumanInputCenter />}

        {/* Engagements View */}
        {view === "engagements" && (
          <>
            {/* First-run empty state */}
            {!isLoading && !isClientLoading && clients.length === 0 && projects.length === 0 && (
              <FirstRunDashboard
                onCreateClient={() => {
                  // Scroll/focus client creation form
                  const el = document.getElementById("client-create-form");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                onCreateEngagement={() => {
                  // Scroll to quick engagement form as a fallback
                  const el = document.getElementById("client-create-form");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                onTakeTour={() => setShowGuidedTour(true)}
                onViewDemo={async () => {
                  // Reload clients and projects after demo seed
                  try {
                    await Promise.all([loadClients({ clearError: false }), loadProjects({ clearError: false })]);
                  } catch {
                    // If reload fails the user can refresh
                  }
                }}
              />
            )}

            <DashboardSummary
              activeClients={clients.length}
              readyForReview={readyForReviewProjects.length}
              actionRequired={actionRequiredProjects.length}
              recentWorkProducts={recentWorkProducts}
              engagementsInProgress={projects.filter((p) => p.status === "running" || p.status === "in-progress").length}
            />

            {(error || notice) && (
              <section className="space-y-3">
                {error && (
                  <div className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{error}</div>
                )}
                {notice && (
                  <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">{notice}</div>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-sm font-medium text-slate-400">Visibility filters</p>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                  />
                  Show archived
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={showDeleted}
                    onChange={(event) => setShowDeleted(event.target.checked)}
                  />
                  Show deleted
                </label>
              </div>
            </section>

            <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">AI Workforce Pipeline</h2>
            <p className="mt-2 text-sm text-slate-400">
              {selectedProject ? `${selectedProject.companyName} — ${selectedProject.status.replace(/-/g, " ")}.` : "Select an engagement to track the AI Workforce stage by stage."}
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-200">
              {executivePipeline.map((stage, index) => {
                const isComplete = selectedProject ? index < selectedProjectStep : false;
                const isRunningStage = selectedProject?.status === "running" && index === selectedProjectStep;
                const isFailedStage = selectedProject?.status === "failed" && index === selectedProjectStep;
                const statusLabel = isComplete
                  ? "Complete"
                  : isRunningStage
                    ? "Running"
                    : isFailedStage
                      ? "Failed"
                      : "Waiting";

                const statusClass = isComplete
                  ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-200"
                  : isRunningStage
                    ? "border-cyan-700/70 bg-cyan-950/30 text-cyan-200"
                    : isFailedStage
                      ? "border-rose-700/70 bg-rose-950/30 text-rose-200"
                      : "border-slate-800 bg-slate-950/70 text-slate-300";

                return (
                  <div key={stage} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${statusClass}`}>
                    <span>{stage}</span>
                    <span className="text-xs uppercase tracking-[0.18em]">{statusLabel}</span>
                  </div>
                );
              })}
            </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-xl font-semibold">Decision Queue</h2>
                <p className="mt-2 text-sm text-slate-400">Focus on work products ready for leadership review, then clear blockers.</p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Ready for review</p>
                <div className="mt-2 space-y-2">
                  {!latestExecutiveBriefs.length && <p className="text-sm text-slate-400">No executive briefs are ready yet.</p>}
                  {latestExecutiveBriefs.map((project) => (
                    <button
                      key={`brief-${project.id}`}
                      className="w-full rounded-lg border border-emerald-900/70 bg-emerald-950/20 px-3 py-2 text-left hover:border-emerald-700"
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <p className="text-sm font-medium text-emerald-100">{project.companyName}</p>
                      <p className="mt-1 text-xs text-emerald-200/80">{project.id}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Action required</p>
                <div className="mt-2 space-y-2">
                  {!actionRequiredProjects.length && <p className="text-sm text-slate-400">No action-required engagements.</p>}
                  {actionRequiredProjects.slice(0, 3).map((project) => (
                    <button
                      key={`action-${project.id}`}
                      className="w-full rounded-lg border border-amber-900/70 bg-amber-950/20 px-3 py-2 text-left hover:border-amber-700"
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <p className="text-sm font-medium text-amber-100">{project.companyName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-amber-200/80">{project.status}</p>
                    </button>
                  ))}
                </div>
              </div>
              </div>
              </div>
            </section>

            <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Client Command Centers</h2>
              <span className="text-sm text-slate-400">{clients.length} total</span>
            </div>

            <form id="client-create-form" className="mt-4 space-y-3" onSubmit={handleCreateClient}>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                placeholder="Client name"
                value={clientForm.name}
                onChange={(event) => setClientForm((previous) => ({ ...previous, name: event.target.value }))}
                required
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder="Industry"
                  value={clientForm.industry}
                  onChange={(event) => setClientForm((previous) => ({ ...previous, industry: event.target.value }))}
                />
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder="Primary contact"
                  value={clientForm.primaryContact}
                  onChange={(event) => setClientForm((previous) => ({ ...previous, primaryContact: event.target.value }))}
                />
              </div>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                placeholder="Website"
                value={clientForm.website}
                onChange={(event) => setClientForm((previous) => ({ ...previous, website: event.target.value }))}
              />
              <button
                className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreatingClient || Boolean(runningProjectId)}
              >
                {isCreatingClient ? "Creating client..." : "Create client"}
              </button>
            </form>

            <div className="mt-5 space-y-2">
              {!clients.length && (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-slate-300">Start your first client command center.</p>
                  <p className="mt-1 text-xs text-slate-500">Create a client to begin onboarding, build a baseline, and deploy the AI Workforce.</p>
                </div>
              )}
              {clients.map((client) => (
                <div
                  key={client.id}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selectedClientId === client.id
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setSelectedClientId(client.id)}>
                      <p className="text-sm font-medium text-slate-100">
                        {client.name}
                        {client.id.startsWith("DEMO-APEX-BREW") && (
                          <span className="ml-2 rounded-full border border-indigo-700 bg-indigo-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-indigo-300">Demo</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {client.engagementCount} engagement{client.engagementCount === 1 ? "" : "s"}
                        {client.lastActivityAt ? ` | activity ${new Date(client.lastActivityAt).toLocaleString()}` : ""}
                      </p>
                    </button>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      {client.lifecycleStatus || "active"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(client.lifecycleStatus || "active") === "active" ? (
                      <button
                        className="rounded-lg border border-amber-700 px-2 py-1 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50"
                        onClick={() => handleClientLifecycle(client.id, "archive")}
                        disabled={Boolean(updatingLifecycleId)}
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        className="rounded-lg border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
                        onClick={() => handleClientLifecycle(client.id, "restore")}
                        disabled={Boolean(updatingLifecycleId)}
                      >
                        Restore
                      </button>
                    )}
                    {(client.lifecycleStatus || "active") !== "deleted" && (
                      <button
                        className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-50"
                        onClick={() => handleClientLifecycle(client.id, "delete")}
                        disabled={Boolean(updatingLifecycleId)}
                      >
                        Soft-delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Client Command Center</h2>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-300">
              Select client → build baseline → upload documents → create engagement → deploy AI Workforce → review deliverables
            </p>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm font-semibold text-slate-100">Data Room</p>
              <p className="mt-1 text-sm text-slate-400">
                The Data Room is the source of truth for the AI Workforce. Upload business plans, financials, pitch decks, brand guides, SOPs, and other documents to improve output quality.
              </p>
            </div>
            {isClientLoading && <p className="mt-4 text-sm text-slate-400">Loading client command center...</p>}
            {!isClientLoading && !selectedClient && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-300">Select a client to open its command center.</p>
                <p className="mt-1 text-xs text-slate-500">Baseline, Data Room, engagements, AI recommendations, and next steps live here.</p>
              </div>
            )}

            {!isClientLoading && selectedClient && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold">{selectedClient.name}</p>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      {selectedClient.lifecycleStatus || "active"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    {selectedClient.industry || "Industry not set"}
                    {selectedClient.website ? ` | ${selectedClient.website}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedClient.engagementCount} engagement{selectedClient.engagementCount === 1 ? "" : "s"} linked
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedClient.lifecycleStatus || "active") === "active" ? (
                      <button
                        className="rounded-lg border border-amber-700 px-2 py-1 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50"
                        onClick={() => handleClientLifecycle(selectedClient.id, "archive")}
                        disabled={Boolean(updatingLifecycleId)}
                      >
                        Archive client
                      </button>
                    ) : (
                      <button
                        className="rounded-lg border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
                        onClick={() => handleClientLifecycle(selectedClient.id, "restore")}
                        disabled={Boolean(updatingLifecycleId)}
                      >
                        Restore client
                      </button>
                    )}
                    {(selectedClient.lifecycleStatus || "active") !== "deleted" && (
                      <button
                        className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-50"
                        onClick={() => handleClientLifecycle(selectedClient.id, "delete")}
                        disabled={Boolean(updatingLifecycleId)}
                      >
                        Soft-delete client
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">Company Baseline</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Onboarding captures company context, customer profile, and operating constraints before running AI workflows.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Baseline completion</p>
                      <p className="text-lg font-semibold text-cyan-100">{baselinePercent}%</p>
                    </div>
                  </div>

                  {needsOnboarding ? (
                    <div className="mt-3 rounded-lg border border-amber-700/60 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
                      Complete onboarding to establish a stronger baseline before launching engagements.
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-emerald-700/60 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
                      Baseline is ready for engagement planning and AI execution.
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-cyan-700 px-3 py-2 text-xs text-cyan-200 hover:border-cyan-500"
                      onClick={() => setShowOnboardingWizard((previous) => !previous)}
                    >
                      {showOnboardingWizard ? "Hide onboarding wizard" : "Complete onboarding"}
                    </button>
                    <button
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
                      onClick={() => {
                        window.location.assign(`/clients/new/onboarding?clientId=${selectedClient.id}`);
                      }}
                    >
                      Open full-page onboarding
                    </button>
                  </div>

                  {showOnboardingWizard && selectedClientBaseline && (
                    <div className="mt-3">
                      <ClientOnboardingWizard
                        clientId={selectedClient.id}
                        clientName={selectedClient.name}
                        initialBaseline={selectedClientBaseline}
                        onSaved={(baseline) => setSelectedClient((previous) => (previous ? { ...previous, baseline } : previous))}
                        onComplete={(baseline) => {
                          setSelectedClient((previous) => (previous ? { ...previous, baseline } : previous));
                          setNotice("Client baseline saved. Next step: upload documents and create engagement.");
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm font-semibold text-slate-100">Next Steps</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className={`rounded-lg border px-3 py-2 text-sm ${needsOnboarding ? "border-amber-700 bg-amber-950/20 text-amber-100" : "border-emerald-700 bg-emerald-950/20 text-emerald-100"}`}>
                      {needsOnboarding ? "Complete onboarding" : "Onboarding complete"}
                    </div>
                    <div className={`rounded-lg border px-3 py-2 text-sm ${selectedClient.engagementCount === 0 ? "border-amber-700 bg-amber-950/20 text-amber-100" : "border-emerald-700 bg-emerald-950/20 text-emerald-100"}`}>
                      {selectedClient.engagementCount === 0 ? "Create first engagement" : "Engagement created"}
                    </div>
                    <div className="rounded-lg border border-cyan-800 bg-cyan-950/20 px-3 py-2 text-sm text-cyan-100">
                      Upload documents
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                      Run AI Workforce and review deliverables
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm font-semibold text-slate-100">AI Recommendations</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Suggested engagement tracks inferred from baseline context.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedClientBaseline?.recommendedEngagementTypes || ["Executive Baseline Discovery Sprint"]).slice(0, 4).map((item) => (
                      <span key={item} className="rounded-full border border-cyan-800 bg-cyan-950/25 px-2 py-1 text-xs text-cyan-200">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Client Data Room</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Source files for this client. Upload business plans, financials, pitch decks, market research, brand guides, SOPs, and other documents. The AI Workforce reads these to produce better deliverables.
                    </p>
                  </div>
                  {!needsOnboarding && selectedClient.engagementCount > 0 && (
                    <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
                      Data Room is ready. After upload, run the engagement workflow and generate exports.
                    </div>
                  )}
                  <DataRoomPanel ownerId={selectedClient.id} scope="client" />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-200">Current engagements</p>
                  {!selectedClient.engagements.length && <p className="text-sm text-slate-400">No engagements linked to this client yet.</p>}
                  {selectedClient.engagements.map((engagement) => (
                    <div key={engagement.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{engagement.id}</p>
                          <p className="text-xs text-slate-400">{engagement.objective || "Objective not specified"}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            {(engagement.lifecycleStatus || "active").toUpperCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                            onClick={() => setSelectedProjectId(engagement.id)}
                          >
                            Open
                          </button>
                          <button
                            className="rounded-lg border border-cyan-600 px-2 py-1 text-xs text-cyan-200 hover:border-cyan-400 disabled:opacity-50"
                            onClick={() => handleRun(engagement.id)}
                            disabled={Boolean(runningProjectId) || (engagement.lifecycleStatus || "active") !== "active"}
                          >
                            {runningProjectId === engagement.id ? "Running..." : "Run"}
                          </button>
                          {(engagement.lifecycleStatus || "active") === "active" ? (
                            <button
                              className="rounded-lg border border-amber-700 px-2 py-1 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50"
                              onClick={() => handleEngagementLifecycle(engagement.id, "archive")}
                              disabled={Boolean(updatingLifecycleId)}
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              className="rounded-lg border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
                              onClick={() => handleEngagementLifecycle(engagement.id, "restore")}
                              disabled={Boolean(updatingLifecycleId)}
                            >
                              Restore
                            </button>
                          )}
                          {(engagement.lifecycleStatus || "active") !== "deleted" && (
                            <button
                              className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-50"
                              onClick={() => handleEngagementLifecycle(engagement.id, "delete")}
                              disabled={Boolean(updatingLifecycleId)}
                            >
                              Soft-delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <form className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4" onSubmit={handleCreateClientEngagement}>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">New engagement</p>
                    <p className="mt-1 text-xs text-slate-400">Define objective, confirm deliverables, and start from this client workspace.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Objective</label>
                    <textarea
                      className="min-h-[88px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                      placeholder="Expand into North Carolina with a CEO-ready recommendation."
                      value={clientObjective}
                      onChange={(event) => setClientObjective(event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Deliverables</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {engagementDeliverables.map((deliverable) => {
                        const checked = requestedDeliverables.includes(deliverable.id);
                        return (
                          <label
                            key={deliverable.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                              checked ? "border-cyan-600 bg-cyan-950/30 text-cyan-100" : "border-slate-700 bg-slate-950 text-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setRequestedDeliverables((previous) =>
                                  previous.includes(deliverable.id)
                                    ? previous.filter((item) => item !== deliverable.id)
                                    : [...previous, deliverable.id],
                                );
                              }}
                            />
                            {deliverable.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                    Estimated time: <span className="font-semibold text-slate-100">{estimatedMinutes.min}-{estimatedMinutes.max} minutes</span>
                  </div>

                  <button
                    className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCreatingClientEngagement || Boolean(runningProjectId) || requestedDeliverables.length === 0}
                  >
                    {isCreatingClientEngagement ? "Starting engagement..." : "Start engagement"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>

            <ProjectWorkspace project={selectedProject} runningProjectId={runningProjectId} onRun={handleRun} />

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Engagements</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{projects.length} tracked</span>
              <button
                className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:border-slate-500"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    await loadProjects();
                  } catch (refreshError) {
                    const message = refreshError instanceof Error ? refreshError.message : "Unable to refresh engagements.";
                    setError(message);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {isLoading && <p className="text-sm text-slate-400">Loading engagements...</p>}
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                companyName={project.companyName}
                objective={project.objective}
                status={project.status}
                lifecycleStatus={project.lifecycleStatus || "active"}
                updatedAt={project.updatedAt}
                completedDepartments={project.completedDepartments}
                totalDepartments={project.totalDepartments}
                runningProjectId={runningProjectId}
                lifecycleUpdating={Boolean(updatingLifecycleId)}
                onRun={handleRun}
                onOpen={setSelectedProjectId}
                onArchive={(projectId) => handleEngagementLifecycle(projectId, "archive")}
                onRestore={(projectId) => handleEngagementLifecycle(projectId, "restore")}
                onDelete={(projectId) => handleEngagementLifecycle(projectId, "delete")}
                isSelected={project.id === selectedProjectId}
              />
            ))}
            {!isLoading && !projects.length && (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-300">No engagements yet.</p>
                <p className="mt-1 text-xs text-slate-500">Create a client first, then start an engagement to deploy the AI Workforce.</p>
              </div>
            )}
            {!isLoading && completeCount > 0 && (
              <p className="text-sm text-emerald-300">{completeCount} engagement{completeCount === 1 ? "" : "s"} completed and ready for delivery.</p>
            )}
            </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-xl font-semibold">Quick Engagement</h2>
              <p className="mt-2 text-sm text-slate-400">
                For unassigned work that cannot be attached to an existing client. Primary flow: create client → onboard → engage.
              </p>
              <div className="mt-4">
                <ProjectForm
                  form={form}
                  isCreating={isCreating}
                  isRunInProgress={Boolean(runningProjectId)}
                  isSecondary
                  onSubmit={handleCreate}
                  onFieldChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
