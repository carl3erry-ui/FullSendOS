type ProjectCardProps = {
  id: string;
  companyName: string;
  objective: string;
  status: string;
  lifecycleStatus?: "active" | "archived" | "deleted";
  updatedAt?: string;
  completedDepartments: number;
  totalDepartments: number;
  runningProjectId: string | null;
  lifecycleUpdating: boolean;
  onRun: (projectId: string) => void;
  onOpen: (projectId: string) => void;
  onArchive: (projectId: string) => void;
  onRestore: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  isSelected: boolean;
};

function formatStatusLabel(value: string) {
  return value.replace(/-/g, " ");
}

function formatLifecycleLabel(value: "active" | "archived" | "deleted") {
  return `Lifecycle: ${value}`;
}

export function ProjectCard({
  id,
  companyName,
  objective,
  status,
  lifecycleStatus = "active",
  updatedAt,
  completedDepartments,
  totalDepartments,
  runningProjectId,
  lifecycleUpdating,
  onRun,
  onOpen,
  onArchive,
  onRestore,
  onDelete,
  isSelected,
}: ProjectCardProps) {
  const statusStyle =
    status === "complete"
      ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
      : status === "running"
        ? "border-cyan-700 bg-cyan-950/30 text-cyan-200"
        : status === "needs-review"
          ? "border-amber-700 bg-amber-950/30 text-amber-200"
          : status === "failed"
            ? "border-rose-700 bg-rose-950/30 text-rose-200"
            : "border-slate-700 text-slate-300";

  return (
    <div className={`rounded-xl border p-4 ${isSelected ? "border-cyan-600 bg-slate-900/80" : "border-slate-800 bg-slate-950/70"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-medium">{companyName}</h3>
          <p className="text-sm text-slate-400">{objective || "No objective provided yet"}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{formatLifecycleLabel(lifecycleStatus)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${statusStyle}`}>
            {formatStatusLabel(status)}
          </span>
          <button
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200"
            onClick={() => onOpen(id)}
          >
            Open
          </button>
          <button
            className="rounded-xl border border-cyan-700 px-3 py-2 text-sm text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRun(id)}
            disabled={Boolean(runningProjectId) || status === "running" || lifecycleStatus !== "active"}
            title={lifecycleStatus !== "active" ? "Restore this engagement before running workflow." : undefined}
          >
            {runningProjectId === id ? "Running..." : status === "running" ? "Running" : "Run Workflow"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {lifecycleStatus === "active" ? (
          <button
            className="rounded-lg border border-amber-700 px-2 py-1 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-50"
            onClick={() => onArchive(id)}
            disabled={lifecycleUpdating}
          >
            Archive
          </button>
        ) : (
          <button
            className="rounded-lg border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
            onClick={() => onRestore(id)}
            disabled={lifecycleUpdating}
          >
            Restore
          </button>
        )}
        {lifecycleStatus !== "deleted" && (
          <button
            className="rounded-lg border border-rose-700 px-2 py-1 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-50"
            onClick={() => onDelete(id)}
            disabled={lifecycleUpdating}
          >
            Soft-delete
          </button>
        )}
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
