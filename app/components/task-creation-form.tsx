"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage, getApiFieldErrors } from "./api-error";
import {
  type PublicAgentMetadata,
  createTask,
  mapFieldErrors,
  type TaskCreationFormData,
} from "./agent-task-client";

type TaskCreationFormProps = {
  agents: PublicAgentMetadata[];
  onTaskCreated: () => void;
};

export function TaskCreationForm({ agents, onTaskCreated }: TaskCreationFormProps) {
  const [formData, setFormData] = useState<TaskCreationFormData>({
    agentId: agents[0]?.id || "",
    title: "",
    objective: "",
    instructions: "",
    context: "",
    engagementId: "",
    priority: "medium" as "low" | "medium" | "high" | "critical",
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

      // Reset form and notify parent
      setFormData({
        agentId: agents[0]?.id || "",
        title: "",
        objective: "",
        instructions: "",
        context: "",
        engagementId: "",
        priority: "medium",
        provider: agents[0]?.defaultProvider === "mock" ? "mock" : "xai",
      });

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-700 bg-rose-950/30 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

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
          placeholder="e.g., Market Analysis for Q3"
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
          placeholder="What should this agent accomplish?"
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
          Instructions
        </label>
        <textarea
          value={formData.instructions}
          onChange={(e) =>
            setFormData({ ...formData, instructions: e.target.value })
          }
          placeholder="Additional guidance for the agent (optional)"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-500"
          rows={3}
        />
      </div>

      {/* Context */}
      <div>
        <label className="block text-sm font-medium text-slate-300">
          Context
        </label>
        <textarea
          value={formData.context}
          onChange={(e) => setFormData({ ...formData, context: e.target.value })}
          placeholder="Background information or constraints (optional)"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-500"
          rows={3}
        />
      </div>

      {/* Engagement ID */}
      <div>
        <label className="block text-sm font-medium text-slate-300">
          Engagement ID
        </label>
        <input
          type="text"
          value={formData.engagementId}
          onChange={(e) =>
            setFormData({ ...formData, engagementId: e.target.value })
          }
          placeholder="Link to an existing engagement (optional)"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-500"
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

      {/* Submit Button */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg border border-cyan-700 bg-cyan-950/30 px-4 py-2 font-medium text-cyan-300 hover:bg-cyan-950/50 disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Task"}
        </button>
      </div>
    </form>
  );
}
