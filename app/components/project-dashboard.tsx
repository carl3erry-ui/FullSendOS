"use client";

import { useEffect, useState } from "react";

type ProjectSummary = {
  id: string;
  companyName: string;
  objective: string;
  status: string;
  updatedAt?: string;
  completedDepartments: number;
  totalDepartments: number;
};

type ProjectFormState = {
  companyName: string;
  objective: string;
  contactName: string;
  industry: string;
  website: string;
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
  const [busy, setBusy] = useState(false);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const data = await response.json();
    setProjects(data);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/projects", {
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
      if (!response.ok) {
        throw new Error("Unable to create project");
      }
      setForm(initialForm);
      await loadProjects();
    } finally {
      setBusy(false);
    }
  }

  async function handleRun(projectId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/run`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Workflow could not be started");
      }
      await loadProjects();
    } finally {
      setBusy(false);
    }
  }

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

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Start a new project</h2>
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                placeholder="Company name"
                value={form.companyName}
                onChange={(event) => setForm({ ...form, companyName: event.target.value })}
                required
              />
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                placeholder="Objective"
                value={form.objective}
                onChange={(event) => setForm({ ...form, objective: event.target.value })}
                required
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder="Contact name"
                  value={form.contactName}
                  onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                />
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                  placeholder="Industry"
                  value={form.industry}
                  onChange={(event) => setForm({ ...form, industry: event.target.value })}
                />
              </div>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
                placeholder="Website"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
              <button className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950" disabled={busy}>
                {busy ? "Working..." : "Create project"}
              </button>
            </form>
          </div>

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

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent projects</h2>
            <span className="text-sm text-slate-400">{projects.length} tracked</span>
          </div>
          <div className="mt-6 space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-medium">{project.companyName}</h3>
                    <p className="text-sm text-slate-400">{project.objective || "No objective provided yet"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {project.status}
                    </span>
                    <button className="rounded-xl border border-cyan-700 px-3 py-2 text-sm text-cyan-300" onClick={() => handleRun(project.id)} disabled={busy}>
                      Run
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                  <span>{project.completedDepartments}/{project.totalDepartments} departments</span>
                  <span>{project.updatedAt ? new Date(project.updatedAt).toLocaleString() : "Just created"}</span>
                </div>
              </div>
            ))}
            {!projects.length && <p className="text-sm text-slate-400">No projects yet. Create your first engagement to begin.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
