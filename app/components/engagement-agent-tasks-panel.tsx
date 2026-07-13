"use client";

import { useEffect, useState } from "react";
import type { AgentTaskSummary, PublicAgentMetadata } from "./agent-task-client";
import { fetchAgents, fetchTasks, fetchTaskDetail } from "./agent-task-client";
import { TasksList } from "./tasks-list";
import { TaskDetailPanel } from "./task-detail-panel";
import { EngagementTaskCreationModal } from "./engagement-task-creation-modal";

type EngagementAgentTasksPanelProps = {
  engagementId: string;
  engagementName?: string;
  engagementObjective?: string;
};

export function EngagementAgentTasksPanel({
  engagementId,
  engagementName,
  engagementObjective,
}: EngagementAgentTasksPanelProps) {
  const [tasks, setTasks] = useState<AgentTaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [agents, setAgents] = useState<PublicAgentMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load agents on mount
  useEffect(() => {
    (async () => {
      try {
        setIsLoadingAgents(true);
        setAgents(await fetchAgents());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load agents.";
        setError(message);
      } finally {
        setIsLoadingAgents(false);
      }
    })();
  }, []);

  // Load engagement-linked tasks
  const loadEngagementTasks = async () => {
    try {
      setIsLoadingTasks(true);
      setError(null);
      const allTasks = await fetchTasks({ engagementId });
      setTasks(allTasks);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load engagement tasks.";
      setError(message);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadEngagementTasks();
  }, [engagementId]);

  const handleTaskCreated = () => {
    setShowCreateModal(false);
    loadEngagementTasks();
  };

  const handleTaskCompleted = () => {
    // Refresh task list and detail
    loadEngagementTasks();
    if (selectedTaskId) {
      // The task detail panel will auto-refresh via its own useEffect
    }
  };

  if (isLoadingTasks && isLoadingAgents) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
        <div className="text-sm text-slate-400">Loading agent tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-700 bg-rose-950/30 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {tasks.length === 0 && !selectedTaskId ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-6 text-center">
          <p className="text-sm text-slate-400">
            No agent tasks have been created for this engagement yet.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 rounded-lg border border-cyan-700 bg-cyan-950/30 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-950/50"
          >
            Create Agent Task
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-300">Tasks</h4>
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg border border-cyan-700 bg-cyan-950/20 px-3 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-950/40"
              >
                + New
              </button>
            </div>
            <TasksList
              tasks={tasks}
              isLoading={isLoadingTasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
            />
          </div>

          {selectedTaskId && (
            <div className="lg:col-span-2">
              <TaskDetailPanel
                taskId={selectedTaskId}
                onTaskCompleted={handleTaskCompleted}
              />
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <EngagementTaskCreationModal
          agents={agents}
          engagementId={engagementId}
          engagementName={engagementName}
          engagementObjective={engagementObjective}
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
