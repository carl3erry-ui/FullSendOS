"use client";

import type { PublicAgentMetadata } from "./agent-task-client";

type AgentsListProps = {
  agents: PublicAgentMetadata[];
  isLoading: boolean;
};

export function AgentsList({ agents, isLoading }: AgentsListProps) {
  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading agents...</div>;
  }

  if (!agents.length) {
    return <div className="text-sm text-slate-400">No agents registered.</div>;
  }

  return (
    <div className="space-y-4">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
        >
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-cyan-300">{agent.name}</h3>
              <p className="text-xs text-slate-500">v{agent.version}</p>
            </div>
            <span className="rounded-full bg-emerald-950/50 px-2 py-1 text-xs text-emerald-300">
              {agent.enabled ? "enabled" : "disabled"}
            </span>
          </div>

          <p className="mb-3 text-sm text-slate-300">{agent.description}</p>

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Role: </span>
              <span className="text-slate-200">{agent.role}</span>
            </div>
            <div>
              <span className="text-slate-400">Provider: </span>
              <span className="text-slate-200">{agent.defaultProvider}</span>
              <span className="ml-2 text-slate-400">Model: </span>
              <span className="text-slate-200">{agent.defaultModel}</span>
            </div>
            <div>
              <span className="text-slate-400">Approval: </span>
              <span className="text-slate-200">
                {agent.requiresApproval ? "Required" : "Not required"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Capabilities: </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
