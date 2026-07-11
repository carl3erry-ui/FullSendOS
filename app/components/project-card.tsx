type ProjectCardProps = {
  id: string;
  companyName: string;
  objective: string;
  status: string;
  updatedAt?: string;
  completedDepartments: number;
  totalDepartments: number;
  runningProjectId: string | null;
  onRun: (projectId: string) => void;
};

export function ProjectCard({
  id,
  companyName,
  objective,
  status,
  updatedAt,
  completedDepartments,
  totalDepartments,
  runningProjectId,
  onRun,
}: ProjectCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-medium">{companyName}</h3>
          <p className="text-sm text-slate-400">{objective || "No objective provided yet"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            {status}
          </span>
          <button
            className="rounded-xl border border-cyan-700 px-3 py-2 text-sm text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRun(id)}
            disabled={Boolean(runningProjectId) || status === "running"}
          >
            {runningProjectId === id ? "Running..." : status === "running" ? "In Progress" : "Run"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
        <span>
          {completedDepartments}/{totalDepartments} departments
        </span>
        <span>{updatedAt ? new Date(updatedAt).toLocaleString() : "Just created"}</span>
      </div>
    </div>
  );
}
