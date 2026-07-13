"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage, getApiFieldErrors } from "./api-error";
import {
  type PublicAgentMetadata,
  createTask,
  mapFieldErrors,
  type TaskCreationFormData,
} from "./agent-task-client";

type EngagementTaskCreationModalProps = {
  agents: PublicAgentMetadata[];
  engagementId: string;
  engagementName?: string;
  engagementObjective?: string;
  onClose: () => void;
  onTaskCreated: () => void;
};

export function EngagementTaskCreationModal({
  agents,
  engagementId,
  engagementName,
  engagementObjective,
  onClose,
  onTaskCreated,
}: EngagementTaskCreationModalProps) {
  const [formData, setFormData] = useState<TaskCreationFormData>({
    agentId: agents[0]?.id || "",
    title: "",
    objective: engagementObjective || "",
    instructions: "",
    context: engagementName ? `Engagement: ${engagementName}` : "",
    engagementId,
    priority: "medium",
    provider: agents[0]?.defaultProvider === "mock" ? "mock" : "xai",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!formData.agentId && agents[0]?.id) {
      setFormData((current) => ({
        ...current,
        agentId: agents[0]?.id || "",
        provider: agents[0]?.defaultProvider === "mock" ? "mock" : "xai",
      }));
    }
  }, [agents, formData.agentId]);

  const selectedAgent = agents.find((agent) => agent.id === formData.agentId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    try {
      setIsSubmitting(true);
      await createTask(formData);
      onTaskCreated();
    } catch (err) {
      const payload = err instanceof Error ? (err as Error & { payload?: unknown }).payload : undefined;
      const errors = getApiFieldErrors(payload);
      if (errors.length > 0) {
        setFieldErrors(mapFieldErrors(errors));
      }

      if (payload) {
        setError(getApiErrorMessage(payload, "Failed to create task."));
        return;
      }

      const message = err instanceof Error ? err.message : "An error occurred.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-slate-100">Create Agent Task</h2>
        <p className="mt-1 text-sm text-slate-400">
          Create a new agent task for this engagement
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-700 bg-rose-950/30 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {/* Engagement Info Display */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm">
            <p className="text-slate-400">
              <span className="font-medium text-slate-300">Engagement:</span> {engagementName || engagementId}
            </p>
            {engagementObjective && (
              <p className="mt-1 text-slate-400">
                <span className="font-medium text-slate-300">Objective:</span> {engagementObjective}
              </p>
            )}
          </div>

          {/* Agent Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Agent *
            </label>
            <select
              value={formData.agentId}
              onChange={(e) => {
                const nextAgent = agents.find((agent) => agent.id === e.target.value) ?? null;
                setFormData({
                  ...formData,
                  agentId: e.target.value,
                  provider: nextAgent?.defaultProvider === "mock" ? "mock" : formData.provider,
                });
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
              required
            >
              <option value="">Select an agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.role})
                </option>
              ))}
            </select>
            {fieldErrors.agentId && (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.agentId}</p>
            )}
            {selectedAgent?.description && (
              <p className="mt-1 text-xs text-slate-400">{selectedAgent.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Provider
            </label>
            <select
              value={formData.provider}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  provider: e.target.value === "mock" ? "mock" : "xai",
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
            >
              <option value="xai">
                xAI {selectedAgent ? `(default for ${selectedAgent.name})` : ""}
              </option>
              <option value="mock">Mock</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Competitive Landscape Research"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-500"
              required
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.title}</p>
            )}
          </div>

          {/* Objective */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Objective *
            </label>
            <textarea
              value={formData.objective}
              onChange={(e) =>
                setFormData({ ...formData, objective: e.target.value })
              }
              placeholder="What should this agent accomplish for this engagement?"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-500"
              rows={4}
              required
            />
            {fieldErrors.objective && (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.objective}</p>
            )}
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Instructions (Optional)
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) =>
                setFormData({ ...formData, instructions: e.target.value })
              }
              placeholder="Additional guidance for the agent"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-500"
              rows={2}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  priority: e.target.value as "low" | "medium" | "high" | "critical",
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-cyan-700 bg-cyan-950/30 px-4 py-2 font-medium text-cyan-300 hover:bg-cyan-950/50 disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
