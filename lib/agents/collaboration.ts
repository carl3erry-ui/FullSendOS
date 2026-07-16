/**
 * FullSendOS Agent Collaboration Framework v1
 * Structured help request and response models.
 *
 * Rules:
 * - Agents cannot freely call each other without Orchestrator approval.
 * - All help requests must go through the Orchestrator.
 * - All collaboration is logged.
 * - No live AI calls in this model.
 */

import { randomBytes } from "node:crypto";

export type HelpRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "redirected"
  | "answered"
  | "expired";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type AgentHelpRequest = {
  id: string;
  engagementId: string;
  fromAgentId: string;
  requestedAgentId: string;
  capabilityNeeded: string;
  reason: string;
  question: string;
  contextSummary: string;
  urgency: UrgencyLevel;
  riskLevel: RiskLevel;
  confidence: number;
  status: HelpRequestStatus;
  deniedReason?: string;
  redirectedToAgentId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentHelpResponse = {
  id: string;
  helpRequestId: string;
  fromAgentId: string;
  toAgentId: string;
  answer: string;
  assumptions: string[];
  evidence: string[];
  confidence: number;
  escalationNeeded: boolean;
  escalationReason?: string;
  createdAt: string;
};

function generateId(prefix: string): string {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

export function createHelpRequest(
  input: Omit<AgentHelpRequest, "id" | "status" | "createdAt" | "updatedAt">,
): AgentHelpRequest {
  const now = new Date().toISOString();
  return {
    ...input,
    id: generateId("hlp"),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export function approveHelpRequest(request: AgentHelpRequest): AgentHelpRequest {
  if (request.status !== "pending") {
    throw new Error(`Cannot approve help request with status "${request.status}".`);
  }
  return { ...request, status: "approved", updatedAt: new Date().toISOString() };
}

export function denyHelpRequest(request: AgentHelpRequest, reason: string): AgentHelpRequest {
  if (request.status !== "pending") {
    throw new Error(`Cannot deny help request with status "${request.status}".`);
  }
  return {
    ...request,
    status: "denied",
    deniedReason: reason,
    updatedAt: new Date().toISOString(),
  };
}

export function redirectHelpRequest(
  request: AgentHelpRequest,
  toAgentId: string,
): AgentHelpRequest {
  if (request.status !== "pending") {
    throw new Error(`Cannot redirect help request with status "${request.status}".`);
  }
  return {
    ...request,
    status: "redirected",
    redirectedToAgentId: toAgentId,
    updatedAt: new Date().toISOString(),
  };
}

export function answerHelpRequest(
  request: AgentHelpRequest,
  responseInput: Omit<AgentHelpResponse, "id" | "helpRequestId" | "toAgentId" | "createdAt">,
): { updatedRequest: AgentHelpRequest; response: AgentHelpResponse } {
  if (request.status !== "approved") {
    throw new Error(`Cannot answer a help request that is not approved (current status: "${request.status}").`);
  }
  const now = new Date().toISOString();
  const response: AgentHelpResponse = {
    ...responseInput,
    id: generateId("rsp"),
    helpRequestId: request.id,
    toAgentId: request.fromAgentId,
    createdAt: now,
  };
  const updatedRequest: AgentHelpRequest = {
    ...request,
    status: "answered",
    updatedAt: now,
  };
  return { updatedRequest, response };
}
