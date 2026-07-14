"use client";

import { useEffect, useState } from "react";
import {
  type TaskApprovalAction,
  type TaskDetailResponse,
  fetchTaskDetail,
  runTask,
  submitTaskApproval,
  resumeWorkflow,
} from "./agent-task-client";
import {
  OrchestratorOutputRenderer,
  ResearchOutputRenderer,
  QualityControlOutputRenderer,
  GenericOutputRenderer,
} from "./output-renderers";

type TaskDetailPanelProps = {
  taskId: string;
  onTaskCompleted: () => void;
};

export function TaskDetailPanel({ taskId, onTaskCompleted }: TaskDetailPanelProps) {
  const [task, setTask] = useState<TaskDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [approvalInProgress, setApprovalInProgress] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showApprovalForm, setShowApprovalForm] = useState<"reject" | "revision" | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadTaskDetail();
  }, [taskId]);

  const loadTaskDetail = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setTask(await fetchTaskDetail(taskId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunTask = async () => {
    if (!task) return;

    try {
      setIsRunning(true);
      setError(null);
      await runTask(taskId);

      // Reload task detail
      await loadTaskDetail();
      onTaskCompleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred.";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleResumeWorkflow = async () => {
    if (!task) return;
    const engagementId = task.task.engagementId;
    if (!engagementId) return;

    try {
      setIsResuming(true);
      setResumeMessage(null);
      setError(null);
      await resumeWorkflow(engagementId, task.task.pauseStateId);
      setResumeMessage({ type: "success", text: "Workflow resumed — agent task executed." });
      await loadTaskDetail();
      onTaskCompleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resume workflow.";
      setResumeMessage({ type: "error", text: message });
    } finally {
      setIsResuming(false);
    }
  };

  const handleApproval = async (action: TaskApprovalAction) => {
    if (!task) return;

    try {
      setApprovalInProgress(true);
      setError(null);
      await submitTaskApproval(taskId, action, approvalNotes);

      // Reload task detail and reset form
      setShowApprovalForm(null);
      setApprovalNotes("");
      await loadTaskDetail();
      onTaskCompleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred.";
      setError(message);
    } finally {
      setApprovalInProgress(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
        <div className="text-sm text-slate-400">Loading task details...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
        <div className="text-sm text-slate-400">Task not found.</div>
      </div>
    );
  }

  const showGenericOutput =
    task.agent.role !== "engagement-planner" &&
    task.agent.role !== "researcher" &&
    task.agent.role !== "quality-control";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 max-h-[80vh] overflow-y-auto">
      <div className="mb-4 space-y-3">
        <div>
          <h3 className="font-semibold text-cyan-300">{task.task.title}</h3>
          <p className="text-xs text-slate-500">{task.agent.name}</p>
        </div>

        {error && (
          <div className="rounded border border-rose-700 bg-rose-950/30 p-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="space-y-1 text-xs text-slate-300">
          <div>
            <span className="text-slate-500">Objective: </span>
            <span>{task.task.objective}</span>
          </div>
          {task.task.instructions && (
            <div>
              <span className="text-slate-500">Instructions: </span>
              <span>{task.task.instructions}</span>
            </div>
          )}
          <div>
            <span className="text-slate-500">Status: </span>
            <span className="font-medium">{task.task.status}</span>
          </div>
          <div>
            <span className="text-slate-500">Approval: </span>
            <span className="font-medium">{task.task.approvalStatus}</span>
          </div>
          <div>
            <span className="text-slate-500">Priority: </span>
            <span>{task.task.priority}</span>
          </div>
          <div>
            <span className="text-slate-500">Provider: </span>
            <span>{task.task.provider} / {task.task.model}</span>
          </div>
          {task.task.usage && (
            <div>
              <span className="text-slate-500">Tokens: </span>
              <span>
                {task.task.usage.input_tokens || 0} in, {task.task.usage.output_tokens || 0} out
              </span>
            </div>
          )}
          {task.task.estimatedCost && (
            <div>
              <span className="text-slate-500">Est. Cost: </span>
              <span>${task.task.estimatedCost.toFixed(4)}</span>
            </div>
          )}
          <div>
            <span className="text-slate-500">Created: </span>
            <span>{new Date(task.task.createdAt).toLocaleString()}</span>
          </div>
          {task.task.completedAt && (
            <div>
              <span className="text-slate-500">Completed: </span>
              <span>{new Date(task.task.completedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {task.task.error && (
        <div className="mb-4 rounded border border-rose-700 bg-rose-950/20 p-2">
          <p className="text-xs font-medium text-rose-300">Error:</p>
          <p className="text-xs text-rose-200">{task.task.error}</p>
        </div>
      )}

      {task.task.status === "queued" && (
        <button
          onClick={handleRunTask}
          disabled={isRunning}
          className="mb-4 w-full rounded-lg border border-cyan-700 bg-cyan-950/30 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-950/50 disabled:opacity-60"
        >
          {isRunning ? "Running..." : "Run Task"}
        </button>
      )}

      {task.task.approvalStatus === "pending" && (
        <div className="mb-4 space-y-2">
          <button
            onClick={() => handleApproval("approve")}
            disabled={approvalInProgress}
            className="w-full rounded-lg border border-emerald-700 bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-60"
          >
            {approvalInProgress ? "Processing..." : "Approve"}
          </button>
          <button
            onClick={() => setShowApprovalForm("reject")}
            disabled={approvalInProgress}
            className="w-full rounded-lg border border-rose-700 bg-rose-950/30 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-950/50 disabled:opacity-60"
          >
            Reject
          </button>
          <button
            onClick={() => setShowApprovalForm("revision")}
            disabled={approvalInProgress}
            className="w-full rounded-lg border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-300 hover:bg-amber-950/50 disabled:opacity-60"
          >
            Request Revision
          </button>
        </div>
      )}

      {showApprovalForm && (        <div className="mb-4 rounded border border-slate-700 bg-slate-900/50 p-3">
          <textarea
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Add notes..."
            className="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder-slate-500"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleApproval(showApprovalForm)}
              disabled={approvalInProgress}
              className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-60"
            >
              {approvalInProgress ? "..." : "Confirm"}
            </button>
            <button
              onClick={() => {
                setShowApprovalForm(null);
                setApprovalNotes("");
              }}
              disabled={approvalInProgress}
              className="flex-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resume Workflow — shown only when task is approved and linked to a paused workflow */}
      {task.task.approvalStatus === "approved" &&
        task.task.hasPausedWorkflow === true &&
        task.task.engagementId && (
          <div className="mb-4">
            {resumeMessage && (
              <div
                className={`mb-2 rounded border p-2 text-xs ${
                  resumeMessage.type === "success"
                    ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
                    : "border-rose-700 bg-rose-950/30 text-rose-200"
                }`}
              >
                {resumeMessage.text}
              </div>
            )}
            <button
              onClick={handleResumeWorkflow}
              disabled={isResuming}
              data-testid="resume-workflow-button"
              className="w-full rounded-lg border border-violet-700 bg-violet-950/30 px-3 py-2 text-sm font-medium text-violet-300 hover:bg-violet-950/50 disabled:opacity-60"
            >
              {isResuming ? "Resuming workflow…" : "Resume Workflow"}
            </button>
          </div>
        )}

      {Boolean(task.task.output) && (
        <div className="mt-4 space-y-3 rounded border border-slate-700 bg-slate-800/50 p-3">
          {task.agent.role === "engagement-planner" && (
            <div>
              <h4 className="mb-3 font-medium text-cyan-300">Orchestrator Output</h4>
              <OrchestratorOutputRenderer data={task.task.output} />
            </div>
          )}
          {task.agent.role === "researcher" && (
            <div>
              <h4 className="mb-3 font-medium text-cyan-300">Research Output</h4>
              <ResearchOutputRenderer data={task.task.output} />
            </div>
          )}
          {task.agent.role === "quality-control" && (
            <div>
              <h4 className="mb-3 font-medium text-cyan-300">Quality Control Output</h4>
              <QualityControlOutputRenderer data={task.task.output} />
            </div>
          )}
          {showGenericOutput && (
            <div>
              <h4 className="mb-3 font-medium text-cyan-300">Output</h4>
              <GenericOutputRenderer data={task.task.output} />
            </div>
          )}
        </div>
      )}

      {Array.isArray(task.task.sources) && task.task.sources.length > 0 && (
        <div className="mt-4 rounded border border-slate-700 bg-slate-800/50 p-3">
          <h4 className="mb-2 font-medium text-cyan-300">Sources Used</h4>
          <ul className="space-y-1 text-xs text-slate-300">
            {task.task.sources.map((source) => (
              <li key={source} className="rounded border border-slate-700 bg-slate-900/50 px-2 py-1">
                {source}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
