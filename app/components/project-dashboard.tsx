"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardSummary } from "./dashboard-summary";
import { ProjectCard } from "./project-card";
import { ProjectForm, type ProjectFormState } from "./project-form";
import { ProjectWorkspace } from "./project-workspace";
import { getApiErrorMessage, getApiFieldErrors } from "./api-error";
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

export function ProjectDashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
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

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await loadProjects({ clearError: true });
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load engagements.";
        setError(message);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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
        throw new Error(getApiErrorMessage(data, "Unable to create engagement."));
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

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">FullSendOS Alpha</p>
          <h1 className="mt-3 text-4xl font-semibold">Consulting OS dashboard</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Create a new engagement, launch the workflow, and monitor where the system stands across research, strategy, and publishing.
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
            <h2 className="text-xl font-semibold">Workflow overview</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">Research and evidence gathering</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">Competitor and customer analysis</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">Strategy, brand, and website synthesis</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">Publishing-ready executive report</div>
            </div>
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
