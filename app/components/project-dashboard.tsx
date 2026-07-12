"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardSummary } from "./dashboard-summary";
import { ProjectCard } from "./project-card";
import { ProjectForm, type ProjectFormState } from "./project-form";
import { ProjectWorkspace } from "./project-workspace";
import { formatApiError, getApiErrorMessage, getApiFieldErrors } from "./api-error";
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
  createdAt: string;
  updatedAt: string;
  engagementCount: number;
  engagements: ProjectSummary[];
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
  const [runningProjectId, setRunningProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pollControllerRef = useRef<ReturnType<typeof createPollController> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadProjects(options: { clearError?: boolean } = {}) {
    const shouldClearError = options.clearError ?? true;
    if (shouldClearError) setError(null);
    const response = await fetch("/api/engagements", { cache: "no-store" });
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
    const response = await fetch("/api/clients", { cache: "no-store" });
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

    const response = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setSelectedClient(null);
      return;
    }

    let active = true;
    setIsClientLoading(true);

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
  }, [selectedClientId]);

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

  const completeCount = projects.filter((project) => project.status === "complete").length;
  const runningCount = projects.filter((project) => project.status === "running").length;
  const reviewCount = projects.filter((project) => project.status === "needs-review").length;
  const avgProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, project) => {
            if (!project.totalDepartments) return sum;
            return sum + project.completedDepartments / project.totalDepartments;
          }, 0) /
            projects.length *
            100,
        )
      : 0;

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const selectedProjectStep = selectedProject ? Math.max(0, Math.min(selectedProject.completedDepartments, executivePipeline.length)) : 0;
  const estimatedMinutes = {
    min: Math.round(6 + requestedDeliverables.length * 1.2),
    max: Math.round(10 + requestedDeliverables.length * 1.6),
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">FullSendOS Alpha</p>
          <h1 className="mt-3 text-4xl font-semibold">Executive workspace</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Select a client, launch an engagement, and follow workflow progress from intake to publishing without leaving this workspace.
          </p>
        </header>

        <DashboardSummary
          projectCount={projects.length}
          runningCount={runningCount}
          reviewCount={reviewCount}
          avgProgress={avgProgress}
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

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <ProjectForm
            form={form}
            isCreating={isCreating}
            isRunInProgress={Boolean(runningProjectId)}
            onSubmit={handleCreate}
            onFieldChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Executive office</h2>
            <p className="mt-2 text-sm text-slate-400">
              {selectedProject ? `Engagement ${selectedProject.id} is ${selectedProject.status}.` : "Choose an engagement to monitor workflow stage by stage."}
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
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Select client</h2>
              <span className="text-sm text-slate-400">{clients.length} total</span>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleCreateClient}>
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
              {!clients.length && <p className="text-sm text-slate-400">No clients yet. Create your first client above.</p>}
              {clients.map((client) => (
                <button
                  key={client.id}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selectedClientId === client.id
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                  }`}
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <p className="text-sm font-medium text-slate-100">{client.name}</p>
                  <p className="text-xs text-slate-400">
                    {client.engagementCount} engagement{client.engagementCount === 1 ? "" : "s"}
                    {client.lastActivityAt ? ` | activity ${new Date(client.lastActivityAt).toLocaleString()}` : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Client workspace</h2>
            {isClientLoading && <p className="mt-4 text-sm text-slate-400">Loading client workspace...</p>}
            {!isClientLoading && !selectedClient && (
              <p className="mt-4 text-sm text-slate-400">Select a client to view associated engagements.</p>
            )}

            {!isClientLoading && selectedClient && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-lg font-semibold">{selectedClient.name}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {selectedClient.industry || "Industry not set"}
                    {selectedClient.website ? ` | ${selectedClient.website}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedClient.engagementCount} engagement{selectedClient.engagementCount === 1 ? "" : "s"} linked
                  </p>
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
                            disabled={Boolean(runningProjectId)}
                          >
                            {runningProjectId === engagement.id ? "Running..." : "Run"}
                          </button>
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
            <h2 className="text-xl font-semibold">Recent engagements</h2>
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
                updatedAt={project.updatedAt}
                completedDepartments={project.completedDepartments}
                totalDepartments={project.totalDepartments}
                runningProjectId={runningProjectId}
                onRun={handleRun}
                onOpen={setSelectedProjectId}
                isSelected={project.id === selectedProjectId}
              />
            ))}
            {!isLoading && !projects.length && <p className="text-sm text-slate-400">No engagements yet. Create your first engagement to begin.</p>}
            {!isLoading && completeCount > 0 && (
              <p className="text-sm text-emerald-300">{completeCount} engagement{completeCount === 1 ? "" : "s"} completed and ready for delivery.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
