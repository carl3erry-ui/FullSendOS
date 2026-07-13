"use client";

import { useEffect, useState } from "react";
import {
  type AgentTaskSummary,
  type PublicAgentMetadata,
  fetchAgents,
  fetchTaskDetail,
  fetchTasks,
} from "./agent-task-client";
import { AgentsList } from "./agents-list";
import { TaskCreationForm } from "./task-creation-form";
import { TasksList } from "./tasks-list";
import { TaskDetailPanel } from "./task-detail-panel";

type Tab = "agents" | "create-task" | "tasks";

export function AIWorkforceSection() {
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [agents, setAgents] = useState<PublicAgentMetadata[]>([]);
  const [tasks, setTasks] = useState<AgentTaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Load tasks when tasks tab is active
  useEffect(() => {
    if (activeTab !== "tasks") return;

    (async () => {
      try {
        setIsLoadingTasks(true);
        setTasks(await fetchTasks());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load tasks.";
        setError(message);
      } finally {
        setIsLoadingTasks(false);
      }
    })();
  }, [activeTab]);

  const handleTaskCreated = () => {
    setActiveTab("tasks");
    // Refresh tasks after creation
    (async () => {
      try {
        setTasks(await fetchTasks());
      } catch {
        // Silent fail, tasks will show on next manual refresh
      }
    })();
  };

  const handleTaskCompleted = () => {
    // Refresh task detail
    if (selectedTaskId) {
      (async () => {
        try {
          const data = await fetchTaskDetail(selectedTaskId);
          setTasks((prev) =>
            prev.map((task) =>
              task.id === selectedTaskId
                ? {
                    ...task,
                    ...data.task,
                    error: data.task.error ?? null,
                    output: data.task.output,
                  }
                : task,
            ),
          );
        } catch {
          // Silent fail
        }
      })();
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">AI Workforce</h2>
        <p className="text-sm text-slate-400">Manage agents, create tasks, and review results</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-700 bg-rose-950/30 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab("agents")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "agents"
              ? "border-b-2 border-cyan-500 text-cyan-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Agents
        </button>
        <button
          onClick={() => setActiveTab("create-task")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "create-task"
              ? "border-b-2 border-cyan-500 text-cyan-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Create Task
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "tasks"
              ? "border-b-2 border-cyan-500 text-cyan-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Tasks
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "agents" && (
          <AgentsList agents={agents} isLoading={isLoadingAgents} />
        )}

        {activeTab === "create-task" && (
          <TaskCreationForm agents={agents} onTaskCreated={handleTaskCreated} />
        )}

        {activeTab === "tasks" && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <TasksList
                tasks={tasks}
                isLoading={isLoadingTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
              />
            </div>
            {selectedTaskId && (
              <div>
                <TaskDetailPanel
                  taskId={selectedTaskId}
                  onTaskCompleted={handleTaskCompleted}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
