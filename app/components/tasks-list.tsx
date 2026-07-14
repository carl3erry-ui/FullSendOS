"use client";

import type { AgentTaskSummary } from "./agent-task-client";

type TasksListProps = {
  tasks: AgentTaskSummary[];
  isLoading: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
};

function getStatusColor(status: string): string {
  switch (status) {
    case "queued":
      return "border-slate-600 bg-slate-900/30 text-slate-300";
    case "running":
      return "border-cyan-700 bg-cyan-950/30 text-cyan-300";
    case "completed":
      return "border-emerald-700 bg-emerald-950/30 text-emerald-300";
    case "failed":
      return "border-rose-700 bg-rose-950/30 text-rose-300";
    default:
      return "border-slate-700 bg-slate-900/20 text-slate-400";
  }
}

function getApprovalColor(status: string): string {
  switch (status) {
    case "not_required":
      return "bg-slate-900/50 text-slate-400";
    case "pending":
      return "bg-amber-950/50 text-amber-300";
    case "approved":
      return "bg-emerald-950/50 text-emerald-300";
    case "rejected":
      return "bg-rose-950/50 text-rose-300";
    case "revision_requested":
      return "bg-amber-950/50 text-amber-300";
    default:
      return "bg-slate-900/50 text-slate-400";
  }
}

export function TasksList({
  tasks,
  isLoading,
  selectedTaskId,
  onSelectTask,
}: TasksListProps) {
  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading tasks...</div>;
  }

  if (!tasks.length) {
    return <div className="text-sm text-slate-400">No tasks yet.</div>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onSelectTask(task.id)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            selectedTaskId === task.id
              ? "border-cyan-600 bg-cyan-950/30"
              : "border-slate-700 bg-slate-900/30 hover:bg-slate-900/50"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-slate-100">{task.title}</h4>
              <p className="truncate text-xs text-slate-400">{task.objective}</p>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${getStatusColor(task.status)}`}>
                {task.status}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${getApprovalColor(task.approvalStatus)}`}>
                {task.approvalStatus === "not_required"
                  ? "—"
                  : task.approvalStatus}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Created {new Date(task.createdAt).toLocaleString()}
          </div>
        </button>
      ))}
    </div>
  );
}
