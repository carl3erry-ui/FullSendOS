"use client";

import type { CollaborationTrace } from "@/lib/agents/collaboration-trace";

type CollaborationTracePanelProps = {
  trace: CollaborationTrace;
  showGuardrailEvents?: boolean;
};

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "border-amber-700 bg-amber-950/30 text-amber-200",
    approved: "border-emerald-700 bg-emerald-950/30 text-emerald-200",
    denied: "border-rose-700 bg-rose-950/30 text-rose-200",
    redirected: "border-indigo-700 bg-indigo-950/30 text-indigo-200",
    answered: "border-cyan-700 bg-cyan-950/30 text-cyan-200",
    expired: "border-slate-700 bg-slate-950/30 text-slate-400",
    high: "border-rose-700 bg-rose-950/30 text-rose-200",
    critical: "border-red-700 bg-red-950/30 text-red-200",
    medium: "border-amber-700 bg-amber-950/30 text-amber-200",
    low: "border-emerald-700 bg-emerald-950/30 text-emerald-200",
  };
  const cls = colors[status] || "border-slate-700 bg-slate-900/40 text-slate-300";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls}`}>
      {status}
    </span>
  );
}

function TimelineEntry({ type, message, timestamp }: { type: string; message: string; timestamp: string }) {
  const icons: Record<string, string> = {
    "team-selected": "👥",
    "task-assigned": "📋",
    "help-requested": "❓",
    "help-approved": "✅",
    "help-denied": "🚫",
    "help-redirected": "↪️",
    "help-answered": "💬",
    "escalation-raised": "⚠️",
    "human-approval-required": "🔒",
    "human-approval-granted": "✅",
    "human-approval-denied": "🚫",
    "executive-review-completed": "📊",
    "guardrail-triggered": "🛡️",
    "deliverable-status-updated": "📄",
  };
  const icon = icons[type] || "•";
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200">{message}</p>
        <p className="mt-0.5 text-xs text-slate-500">{new Date(timestamp).toLocaleString()}</p>
      </div>
    </li>
  );
}

export function CollaborationTracePanel({
  trace,
  showGuardrailEvents = false,
}: CollaborationTracePanelProps) {
  const confidence = trace.confidenceSummary;
  const pendingGates = trace.humanApprovalGates.filter((g) => g.status === "pending");

  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400">Agent Collaboration Trace</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">Engagement {trace.engagementId}</h3>
          <p className="mt-1 text-xs text-slate-500">Internal view — not for client delivery</p>
          <p className="mt-1 text-xs text-indigo-300">Leadership Doctrine v{trace.leadershipDoctrineVersion}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Confidence</p>
          <p className={`text-lg font-bold ${confidence.overallLevel === "high" ? "text-emerald-300" : confidence.overallLevel === "medium" ? "text-amber-300" : confidence.overallLevel === "low" ? "text-rose-300" : "text-slate-400"}`}>
            {confidence.overallLevel.toUpperCase()}
            {confidence.score !== null ? ` (${Math.round(confidence.score * 100)}%)` : ""}
          </p>
        </div>
      </div>

      {/* Human Approval Gates */}
      {pendingGates.length > 0 && (
        <div className="rounded-xl border border-amber-700 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            {pendingGates.length} Pending Human Approval Gate{pendingGates.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-2 space-y-2">
            {pendingGates.map((gate) => (
              <li key={gate.id} className="text-sm text-amber-100">
                <span className="font-medium">{gate.reason}</span>
                {gate.context && <span className="ml-2 text-amber-200/80">— {gate.context}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence rationale */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Confidence Rationale</p>
        <p className="mt-1 text-sm text-slate-300">{confidence.rationale}</p>
        {confidence.openEscalations > 0 && (
          <p className="mt-1 text-xs text-amber-300">{confidence.openEscalations} open escalation{confidence.openEscalations > 1 ? "s" : ""}</p>
        )}
        {confidence.unresolvedApprovalGates > 0 && (
          <p className="mt-1 text-xs text-amber-300">{confidence.unresolvedApprovalGates} unresolved approval gate{confidence.unresolvedApprovalGates > 1 ? "s" : ""}</p>
        )}
      </div>

      {/* Selected Team */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Agent Team ({trace.selectedAgents.length})
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {trace.selectedAgents.map((agentId) => (
            <div key={agentId} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
              <p className="text-sm font-medium text-slate-200">{agentId}</p>
              {trace.selectionReasons[agentId] && (
                <p className="mt-0.5 text-xs text-slate-500">{trace.selectionReasons[agentId]}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Help Requests */}
      {trace.helpRequests.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Help Requests ({trace.helpRequests.length})
          </p>
          <div className="space-y-2">
            {trace.helpRequests.map((req) => (
              <div key={req.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">{req.fromAgentId}</span>
                  <span className="text-xs text-slate-500">→</span>
                  <span className="text-xs font-semibold text-cyan-300">{req.requestedAgentId}</span>
                  <StatusPill status={req.status} />
                  <StatusPill status={req.urgency} />
                </div>
                <p className="mt-1 text-sm text-slate-200">{req.question}</p>
                {req.deniedReason && (
                  <p className="mt-1 text-xs text-rose-300">Denied: {req.deniedReason}</p>
                )}
                {req.redirectedToAgentId && (
                  <p className="mt-1 text-xs text-indigo-300">Redirected to: {req.redirectedToAgentId}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Escalations */}
      {trace.escalations.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            Escalations ({trace.escalations.length})
          </p>
          <div className="space-y-2">
            {trace.escalations.map((esc) => (
              <div key={esc.id} className="rounded-lg border border-amber-900 bg-amber-950/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-200">{esc.fromAgentId}</span>
                  <StatusPill status={esc.severity} />
                  {esc.humanReviewRequired && (
                    <span className="rounded-full border border-rose-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-rose-200">Needs Human</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-amber-100">{esc.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Guardrail Events */}
      {showGuardrailEvents && trace.guardrailEvents.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Guardrail Events
          </p>
          <div className="space-y-1">
            {trace.guardrailEvents.map((event, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-950/50 px-3 py-1">
                <span className="text-xs text-slate-400">{event.rule}</span>
                <span className="text-xs text-slate-500">→</span>
                <span className={`text-xs font-medium ${event.severity === "blocked" ? "text-rose-300" : event.severity === "warning" ? "text-amber-300" : "text-slate-300"}`}>
                  {event.action}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Timeline ({trace.timelineEvents.length} events)
        </p>
        <ul className="space-y-1 divide-y divide-slate-800/50 rounded-xl border border-slate-800 bg-slate-950/40 px-3">
          {trace.timelineEvents.map((event, index) => (
            <TimelineEntry
              key={index}
              type={event.type}
              message={event.message}
              timestamp={event.timestamp}
            />
          ))}
        </ul>
      </section>
    </section>
  );
}
