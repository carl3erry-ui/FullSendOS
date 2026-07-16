/**
 * FullSendOS Agent Collaboration Framework v1
 * Collaboration trace model and helpers.
 *
 * The collaboration trace records every significant event in an engagement's
 * agent collaboration: team selection, task assignments, help requests,
 * responses, escalations, human approval gates, and guardrail events.
 *
 * No live AI calls. Deterministic. Safe for logging.
 * Must not expose secrets, raw provider payloads, or private client data.
 */

import type { AgentHelpRequest, AgentHelpResponse } from "./collaboration";

export type TimelineEventType =
  | "team-selected"
  | "task-assigned"
  | "help-requested"
  | "help-approved"
  | "help-denied"
  | "help-redirected"
  | "help-answered"
  | "escalation-raised"
  | "human-approval-required"
  | "human-approval-granted"
  | "human-approval-denied"
  | "executive-review-completed"
  | "guardrail-triggered"
  | "deliverable-status-updated";

export type TimelineEvent = {
  type: TimelineEventType;
  agentId?: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
};

export type EscalationRecord = {
  id: string;
  fromAgentId: string;
  reason: string;
  severity: "medium" | "high" | "critical";
  humanReviewRequired: boolean;
  resolvedAt?: string;
  createdAt: string;
};

export type HumanApprovalGate = {
  id: string;
  reason: string;
  context: string;
  status: "pending" | "approved" | "denied";
  approvedAt?: string;
  createdAt: string;
};

export type GuardrailEvent = {
  rule: string;
  triggeredBy: string;
  action: string;
  severity: "info" | "warning" | "blocked";
  timestamp: string;
};

export type CollaborationConfidenceSummary = {
  overallLevel: "high" | "medium" | "low" | "pending";
  score: number | null;
  rationale: string;
  openEscalations: number;
  unresolvedApprovalGates: number;
};

export type CollaborationTrace = {
  engagementId: string;
  createdAt: string;
  updatedAt: string;
  selectedAgents: string[];
  selectionReasons: Record<string, string>;
  assignedTasks: Array<{ agentId: string; taskTitle: string; assignedAt: string }>;
  helpRequests: AgentHelpRequest[];
  helpResponses: AgentHelpResponse[];
  escalations: EscalationRecord[];
  humanApprovalGates: HumanApprovalGate[];
  guardrailEvents: GuardrailEvent[];
  timelineEvents: TimelineEvent[];
  confidenceSummary: CollaborationConfidenceSummary;
  /** Leadership Doctrine governance fields */
  leadershipDoctrineVersion: string;
  principlesApplied: string[];
  leadershipDecisionCheck: Record<string, boolean>;
  doctrineEscalations: string[];
};

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter).padStart(6, "0")}`;
}

export function createCollaborationTrace(
  engagementId: string,
  selectedAgents: string[],
  selectionReasons: Record<string, string>,
): CollaborationTrace {
  const now = new Date().toISOString();
  return {
    engagementId,
    createdAt: now,
    updatedAt: now,
    selectedAgents,
    selectionReasons,
    assignedTasks: [],
    helpRequests: [],
    helpResponses: [],
    escalations: [],
    humanApprovalGates: [],
    guardrailEvents: [],
    timelineEvents: [
      {
        type: "team-selected",
        message: `Agent team selected: ${selectedAgents.join(", ")}`,
        metadata: { agentCount: selectedAgents.length },
        timestamp: now,
      },
    ],
    confidenceSummary: {
      overallLevel: "pending",
      score: null,
      rationale: "Collaboration not yet started.",
      openEscalations: 0,
      unresolvedApprovalGates: 0,
    },
    leadershipDoctrineVersion: "1.0.0",
    principlesApplied: [],
    leadershipDecisionCheck: {},
    doctrineEscalations: [],
  };
}

export function addTimelineEvent(
  trace: CollaborationTrace,
  event: Omit<TimelineEvent, "timestamp">,
): CollaborationTrace {
  const now = new Date().toISOString();
  return {
    ...trace,
    updatedAt: now,
    timelineEvents: [...trace.timelineEvents, { ...event, timestamp: now }],
  };
}

export function addHelpRequestToTrace(
  trace: CollaborationTrace,
  request: AgentHelpRequest,
): CollaborationTrace {
  const now = new Date().toISOString();
  return {
    ...trace,
    updatedAt: now,
    helpRequests: [...trace.helpRequests, request],
    timelineEvents: [
      ...trace.timelineEvents,
      {
        type: "help-requested",
        agentId: request.fromAgentId,
        message: `${request.fromAgentId} requested help from ${request.requestedAgentId}: ${request.capabilityNeeded}`,
        metadata: { requestId: request.id, urgency: request.urgency, riskLevel: request.riskLevel },
        timestamp: now,
      },
    ],
  };
}

export function addHelpResponseToTrace(
  trace: CollaborationTrace,
  updatedRequest: AgentHelpRequest,
  response: AgentHelpResponse,
): CollaborationTrace {
  const now = new Date().toISOString();
  const updatedRequests = trace.helpRequests.map((r) =>
    r.id === updatedRequest.id ? updatedRequest : r,
  );
  return {
    ...trace,
    updatedAt: now,
    helpRequests: updatedRequests,
    helpResponses: [...trace.helpResponses, response],
    timelineEvents: [
      ...trace.timelineEvents,
      {
        type: "help-answered",
        agentId: response.fromAgentId,
        message: `${response.fromAgentId} answered help request ${response.helpRequestId} (confidence: ${Math.round(response.confidence * 100)}%)`,
        metadata: { responseId: response.id, escalationNeeded: response.escalationNeeded },
        timestamp: now,
      },
    ],
  };
}

export function addEscalationToTrace(
  trace: CollaborationTrace,
  fromAgentId: string,
  reason: string,
  severity: EscalationRecord["severity"],
  humanReviewRequired: boolean,
): CollaborationTrace {
  const now = new Date().toISOString();
  const escalation: EscalationRecord = {
    id: nextId("esc"),
    fromAgentId,
    reason,
    severity,
    humanReviewRequired,
    createdAt: now,
  };
  return {
    ...trace,
    updatedAt: now,
    escalations: [...trace.escalations, escalation],
    timelineEvents: [
      ...trace.timelineEvents,
      {
        type: "escalation-raised",
        agentId: fromAgentId,
        message: `Escalation raised by ${fromAgentId}: ${reason}`,
        metadata: { escalationId: escalation.id, severity, humanReviewRequired },
        timestamp: now,
      },
    ],
  };
}

export function addHumanApprovalGate(
  trace: CollaborationTrace,
  reason: string,
  context: string,
): CollaborationTrace {
  const now = new Date().toISOString();
  const gate: HumanApprovalGate = {
    id: nextId("gate"),
    reason,
    context,
    status: "pending",
    createdAt: now,
  };
  return {
    ...trace,
    updatedAt: now,
    humanApprovalGates: [...trace.humanApprovalGates, gate],
    timelineEvents: [
      ...trace.timelineEvents,
      {
        type: "human-approval-required",
        message: `Human approval required: ${reason}`,
        metadata: { gateId: gate.id },
        timestamp: now,
      },
    ],
  };
}

export function summarizeCollaborationTrace(trace: CollaborationTrace): CollaborationConfidenceSummary {
  const openEscalations = trace.escalations.filter((e) => !e.resolvedAt).length;
  const unresolvedGates = trace.humanApprovalGates.filter((g) => g.status === "pending").length;
  const totalRequests = trace.helpRequests.length;
  const answeredRequests = trace.helpRequests.filter((r) => r.status === "answered").length;
  const deniedRequests = trace.helpRequests.filter((r) => r.status === "denied").length;

  const avgConfidence =
    trace.helpResponses.length > 0
      ? trace.helpResponses.reduce((sum, r) => sum + r.confidence, 0) / trace.helpResponses.length
      : null;

  let level: CollaborationConfidenceSummary["overallLevel"] = "pending";
  let rationale = "Collaboration not yet started.";

  if (trace.timelineEvents.length > 1) {
    if (openEscalations > 0 || unresolvedGates > 0) {
      level = "low";
      rationale = `${openEscalations} open escalations and ${unresolvedGates} unresolved approval gates require attention.`;
    } else if (avgConfidence !== null && avgConfidence >= 0.75) {
      level = "high";
      rationale = `All help requests resolved with average confidence ${Math.round(avgConfidence * 100)}%.`;
    } else if (avgConfidence !== null && avgConfidence >= 0.55) {
      level = "medium";
      rationale = `Collaboration complete with average confidence ${Math.round(avgConfidence * 100)}%. Some assumptions may need validation.`;
    } else if (totalRequests > 0 && answeredRequests > 0) {
      level = "medium";
      rationale = `${answeredRequests} of ${totalRequests} help requests answered.`;
    } else {
      level = "pending";
      rationale = "Collaboration in progress.";
    }
  }

  if (deniedRequests > 0) {
    rationale += ` ${deniedRequests} help request(s) were denied — review for gaps.`;
  }

  return {
    overallLevel: level,
    score: avgConfidence !== null ? Math.round(avgConfidence * 100) / 100 : null,
    rationale,
    openEscalations,
    unresolvedApprovalGates: unresolvedGates,
  };
}
