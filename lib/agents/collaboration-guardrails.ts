/**
 * FullSendOS Agent Collaboration Framework v1
 * Collaboration guardrails — deterministic evaluator.
 *
 * Prevents runaway collaboration, circular requests, duplicate requests,
 * cost overruns, and other uncontrolled agent behavior.
 *
 * No live AI calls. All rules are local and deterministic.
 */

import type { CollaborationTrace } from "./collaboration-trace";
import type { AgentHelpRequest } from "./collaboration";

export type CollaborationGuardrailConfig = {
  maxSelectedAgents: number;
  maxHelpRequestsPerAgent: number;
  maxTotalHelpRequests: number;
  maxCollaborationRounds: number;
  maxEstimatedCostLevel: "low" | "medium" | "high" | "critical";
  preventCircularRequests: boolean;
  preventDuplicateHelpRequests: boolean;
  requireHumanApprovalForLegal: boolean;
  requireHumanApprovalForFinancial: boolean;
  requireHumanApprovalForClientFacing: boolean;
};

export type GuardrailEvaluation = {
  allowed: boolean;
  reason: string;
  severity: "info" | "warning" | "blocked";
  humanApprovalRequired: boolean;
  guardrailEvent: {
    rule: string;
    triggeredBy: string;
    action: string;
    severity: "info" | "warning" | "blocked";
    timestamp: string;
  };
};

export const DEFAULT_GUARDRAIL_CONFIG: CollaborationGuardrailConfig = {
  maxSelectedAgents: 10,
  maxHelpRequestsPerAgent: 5,
  maxTotalHelpRequests: 20,
  maxCollaborationRounds: 3,
  maxEstimatedCostLevel: "high",
  preventCircularRequests: true,
  preventDuplicateHelpRequests: true,
  requireHumanApprovalForLegal: true,
  requireHumanApprovalForFinancial: true,
  requireHumanApprovalForClientFacing: true,
};

const COST_RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

export type NextAction =
  | { type: "add-agent"; agentId: string; costRiskLevel?: "low" | "medium" | "high" | "critical" }
  | { type: "help-request"; request: AgentHelpRequest }
  | { type: "deliver-client-facing" }
  | { type: "deliver-investor-facing" }
  | { type: "deliver-legal-output" }
  | { type: "deliver-financial-output" };

export function evaluateCollaborationGuardrails(
  trace: CollaborationTrace,
  nextAction: NextAction,
  config: CollaborationGuardrailConfig = DEFAULT_GUARDRAIL_CONFIG,
): GuardrailEvaluation {
  const now = new Date().toISOString();

  // --- Team size check ---
  if (nextAction.type === "add-agent") {
    if (trace.selectedAgents.length >= config.maxSelectedAgents) {
      return {
        allowed: false,
        reason: `Cannot add agent "${nextAction.agentId}": team already has ${trace.selectedAgents.length} agents (max ${config.maxSelectedAgents}).`,
        severity: "blocked",
        humanApprovalRequired: false,
        guardrailEvent: {
          rule: "maxSelectedAgents",
          triggeredBy: nextAction.agentId,
          action: "blocked",
          severity: "blocked",
          timestamp: now,
        },
      };
    }

    // Cost risk check
    if (nextAction.costRiskLevel) {
      const actionCost = COST_RISK_ORDER[nextAction.costRiskLevel] ?? 0;
      const maxCost = COST_RISK_ORDER[config.maxEstimatedCostLevel] ?? 2;
      if (actionCost > maxCost) {
        return {
          allowed: false,
          reason: `Cannot add agent "${nextAction.agentId}": cost risk "${nextAction.costRiskLevel}" exceeds configured max "${config.maxEstimatedCostLevel}".`,
          severity: "blocked",
          humanApprovalRequired: true,
          guardrailEvent: {
            rule: "maxEstimatedCostLevel",
            triggeredBy: nextAction.agentId,
            action: "blocked",
            severity: "blocked",
            timestamp: now,
          },
        };
      }
    }
  }

  // --- Help request guardrails ---
  if (nextAction.type === "help-request") {
    const req = nextAction.request;

    // Total help requests check
    if (trace.helpRequests.length >= config.maxTotalHelpRequests) {
      return {
        allowed: false,
        reason: `Total help requests (${trace.helpRequests.length}) has reached the maximum (${config.maxTotalHelpRequests}). Escalate to human review.`,
        severity: "blocked",
        humanApprovalRequired: true,
        guardrailEvent: {
          rule: "maxTotalHelpRequests",
          triggeredBy: req.fromAgentId,
          action: "blocked",
          severity: "blocked",
          timestamp: now,
        },
      };
    }

    // Per-agent help request check
    const agentRequests = trace.helpRequests.filter((r) => r.fromAgentId === req.fromAgentId).length;
    if (agentRequests >= config.maxHelpRequestsPerAgent) {
      return {
        allowed: false,
        reason: `Agent "${req.fromAgentId}" has reached the maximum help requests per agent (${config.maxHelpRequestsPerAgent}).`,
        severity: "blocked",
        humanApprovalRequired: false,
        guardrailEvent: {
          rule: "maxHelpRequestsPerAgent",
          triggeredBy: req.fromAgentId,
          action: "blocked",
          severity: "blocked",
          timestamp: now,
        },
      };
    }

    // Circular request check
    if (config.preventCircularRequests) {
      const isCircular = trace.helpRequests.some(
        (r) => r.fromAgentId === req.requestedAgentId && r.requestedAgentId === req.fromAgentId,
      );
      if (isCircular) {
        return {
          allowed: false,
          reason: `Circular help request detected: ${req.fromAgentId} → ${req.requestedAgentId} mirrors an existing ${req.requestedAgentId} → ${req.fromAgentId} request.`,
          severity: "blocked",
          humanApprovalRequired: false,
          guardrailEvent: {
            rule: "preventCircularRequests",
            triggeredBy: req.fromAgentId,
            action: "blocked",
            severity: "blocked",
            timestamp: now,
          },
        };
      }
    }

    // Duplicate request check
    if (config.preventDuplicateHelpRequests) {
      const isDuplicate = trace.helpRequests.some(
        (r) =>
          r.fromAgentId === req.fromAgentId &&
          r.requestedAgentId === req.requestedAgentId &&
          r.capabilityNeeded === req.capabilityNeeded &&
          r.status !== "denied" &&
          r.status !== "expired",
      );
      if (isDuplicate) {
        return {
          allowed: false,
          reason: `Duplicate help request: ${req.fromAgentId} already has a pending/active request to ${req.requestedAgentId} for "${req.capabilityNeeded}".`,
          severity: "blocked",
          humanApprovalRequired: false,
          guardrailEvent: {
            rule: "preventDuplicateHelpRequests",
            triggeredBy: req.fromAgentId,
            action: "blocked",
            severity: "blocked",
            timestamp: now,
          },
        };
      }
    }
  }

  // --- Client/investor/legal/financial delivery guardrails ---
  if (
    nextAction.type === "deliver-client-facing" ||
    nextAction.type === "deliver-investor-facing" ||
    nextAction.type === "deliver-legal-output" ||
    nextAction.type === "deliver-financial-output"
  ) {
    const needsApproval =
      (nextAction.type === "deliver-client-facing" && config.requireHumanApprovalForClientFacing) ||
      (nextAction.type === "deliver-investor-facing" && config.requireHumanApprovalForClientFacing) ||
      (nextAction.type === "deliver-legal-output" && config.requireHumanApprovalForLegal) ||
      (nextAction.type === "deliver-financial-output" && config.requireHumanApprovalForFinancial);

    if (needsApproval) {
      const label =
        nextAction.type === "deliver-legal-output" ? "legal output" :
        nextAction.type === "deliver-financial-output" ? "financial output" :
        nextAction.type === "deliver-investor-facing" ? "investor-facing materials" :
        "client-facing deliverable";

      return {
        allowed: false,
        reason: `Human approval is required before delivering ${label}. This is a governance guardrail and cannot be bypassed.`,
        severity: "blocked",
        humanApprovalRequired: true,
        guardrailEvent: {
          rule: `requireHumanApprovalFor_${nextAction.type}`,
          triggeredBy: "guardrail-system",
          action: "human-approval-required",
          severity: "blocked",
          timestamp: now,
        },
      };
    }
  }

  // --- All good ---
  return {
    allowed: true,
    reason: "Action is within guardrail bounds.",
    severity: "info",
    humanApprovalRequired: false,
    guardrailEvent: {
      rule: "none",
      triggeredBy: "guardrail-system",
      action: "allowed",
      severity: "info",
      timestamp: now,
    },
  };
}
