type WorkspaceProject = {
  id: string;
  companyName: string;
  objective: string;
  status: string;
  updatedAt?: string;
  completedDepartments: number;
  totalDepartments: number;
};

type ProjectWorkspaceProps = {
  project: WorkspaceProject | null;
  runningProjectId: string | null;
  onRun: (projectId: string) => void;
};

export function ProjectWorkspace({ project, runningProjectId, onRun }: ProjectWorkspaceProps) {
  if (!project) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold">Engagement workspace</h2>
        <p className="mt-4 text-sm text-slate-400">Select an engagement from the list below to view workspace details.</p>
      </section>
    );
  }

  const progressText = `${project.completedDepartments}/${project.totalDepartments} departments`;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Engagement workspace</p>
          <h2 className="mt-2 text-2xl font-semibold">{project.companyName}</h2>
          <p className="mt-2 text-sm text-slate-300">{project.objective || "No objective defined."}</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
          {project.status}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Engagement ID</p>
          <p className="mt-2 break-all text-sm text-slate-200">{project.id}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Progress</p>
          <p className="mt-2 text-sm text-slate-200">{progressText}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Last update</p>
          <p className="mt-2 text-sm text-slate-200">
            {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : "Not available"}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-xl border border-cyan-700 px-3 py-2 text-sm text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onRun(project.id)}
          disabled={Boolean(runningProjectId) || project.status === "running"}
        >
          {runningProjectId === project.id ? "Running..." : project.status === "running" ? "In Progress" : "Run engagement workflow"}
        </button>
      </div>
    </section>
  );
}