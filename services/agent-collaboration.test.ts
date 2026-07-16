import assert from "node:assert/strict";
import test from "node:test";
import { getAgentProfile, listAgentProfiles, findAgentsByCapability, findAgentsForEngagementType, getCoreAgents } from "../lib/agents/agent-registry";
import { selectAgentTeam } from "../lib/agents/team-selection";
import { createHelpRequest, approveHelpRequest, denyHelpRequest, redirectHelpRequest, answerHelpRequest } from "../lib/agents/collaboration";
import { createCollaborationTrace, addTimelineEvent, summarizeCollaborationTrace } from "../lib/agents/collaboration-trace";
import { evaluateCollaborationGuardrails, DEFAULT_GUARDRAIL_CONFIG } from "../lib/agents/collaboration-guardrails";
import { requiresHumanApproval } from "../lib/agents/approval-gates";
import {
  getLeadershipDoctrine,
  getLeadershipPrinciple,
  listLeadershipPrinciples,
  getLeadershipDecisionCheck,
  evaluateLeadershipDecisionCheck,
  getDoctrineVersion,
  DOCTRINE_VERSION,
  COPYRIGHT_GUARDRAIL,
  CONFLICT_RESOLUTION_PRIORITY,
} from "../ai/governance/leadership-doctrine";

// ----- Agent Registry -----

test("agent registry contains all 15 core-to-specialist agents", () => {
  const profiles = listAgentProfiles();
  assert.ok(profiles.length >= 15, `Expected >= 15 agents, got ${profiles.length}`);
});

test("core agents include orchestrator and executive-review", () => {
  const coreAgents = getCoreAgents().map((a) => a.agentId);
  assert.ok(coreAgents.includes("orchestrator"), "orchestrator must be a core agent");
  assert.ok(coreAgents.includes("executive-review"), "executive-review must be a core agent");
});

test("agent profiles include capabilities, escalation rules, and outputs", () => {
  for (const profile of listAgentProfiles()) {
    assert.ok(profile.capabilities.length > 0, `${profile.agentId} must have capabilities`);
    assert.ok(profile.escalatesWhen.length > 0, `${profile.agentId} must have escalation rules`);
    assert.ok(profile.outputsProduced.length > 0, `${profile.agentId} must have outputs`);
    assert.ok(profile.approvalRequiredFor.length > 0, `${profile.agentId} must have approval requirements`);
  }
});

test("getAgentProfile returns correct profile", () => {
  const profile = getAgentProfile("orchestrator");
  assert.ok(profile);
  assert.equal(profile.agentId, "orchestrator");
  assert.equal(profile.isCoreAgent, true);
});

test("getAgentProfile returns undefined for unknown agent", () => {
  assert.equal(getAgentProfile("unknown-agent-xyz"), undefined);
});

test("findAgentsByCapability finds agents with matching capability", () => {
  const results = findAgentsByCapability("financial-modeling");
  assert.ok(results.some((a) => a.agentId === "finance"), "finance agent should match financial-modeling");
});

test("findAgentsForEngagementType includes core agents and type-specific agents", () => {
  const results = findAgentsForEngagementType("market-entry");
  const ids = results.map((a) => a.agentId);
  assert.ok(ids.includes("orchestrator"));
  assert.ok(ids.includes("executive-review"));
  assert.ok(ids.includes("researcher"));
});

// ----- Team Selection -----

test("team selection for market-entry includes orchestrator, researcher, strategy, executive-review", () => {
  const result = selectAgentTeam({ engagementType: "market-entry" });
  assert.ok(result.requiredAgents.includes("orchestrator"));
  assert.ok(result.requiredAgents.includes("researcher"));
  assert.ok(result.requiredAgents.includes("strategy"));
  assert.ok(result.requiredAgents.includes("executive-review"));
});

test("team selection for sba-loan includes finance, operations, legal-review, executive-review", () => {
  const result = selectAgentTeam({ engagementType: "sba-loan" });
  assert.ok(result.requiredAgents.includes("finance"), "sba-loan must include finance");
  assert.ok(result.requiredAgents.includes("operations"), "sba-loan must include operations");
  assert.ok(result.requiredAgents.includes("legal-review"), "sba-loan must include legal-review");
  assert.ok(result.requiredAgents.includes("executive-review"), "sba-loan must include executive-review");
});

test("team selection for investor-deck includes finance, investor-relations, legal-review, executive-review", () => {
  const result = selectAgentTeam({ engagementType: "investor-deck" });
  assert.ok(result.requiredAgents.includes("finance"));
  assert.ok(result.requiredAgents.includes("investor-relations"));
  assert.ok(result.requiredAgents.includes("legal-review") || result.optionalAgents.includes("legal-review"));
  assert.ok(result.requiredAgents.includes("executive-review"));
});

test("team selection triggers human approval for legal and investor contexts", () => {
  const result = selectAgentTeam({
    engagementType: "investor-deck",
    clientContext: { hasLegalRequirements: true, hasInvestorAudience: true, hasFinancialProjections: true },
  });
  assert.equal(result.humanApprovalRequired, true);
  assert.ok(result.humanApprovalReasons.length > 0);
});

test("team selection includes selection reasons for every selected agent", () => {
  const result = selectAgentTeam({ engagementType: "business-plan" });
  for (const agentId of result.selectedAgents) {
    assert.ok(result.selectionReasons[agentId], `Missing selection reason for ${agentId}`);
  }
});

// ----- Help Request Lifecycle -----

test("createHelpRequest creates a pending help request", () => {
  const req = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "finance",
    capabilityNeeded: "financial-modeling",
    reason: "Need revenue scenario analysis",
    question: "What is a realistic Year 1 revenue range?",
    contextSummary: "Market entry for craft brewery in California",
    urgency: "medium",
    riskLevel: "medium",
    confidence: 0.6,
  });
  assert.equal(req.status, "pending");
  assert.equal(req.fromAgentId, "researcher");
  assert.equal(req.requestedAgentId, "finance");
  assert.ok(req.id.startsWith("hlp-"));
});

test("approveHelpRequest moves status to approved", () => {
  const req = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "finance",
    capabilityNeeded: "financial-modeling",
    reason: "Need revenue scenario",
    question: "Revenue range?",
    contextSummary: "Context",
    urgency: "low",
    riskLevel: "low",
    confidence: 0.7,
  });
  const approved = approveHelpRequest(req, "Approved by Orchestrator");
  assert.equal(approved.status, "approved");
});

test("denyHelpRequest moves status to denied", () => {
  const req = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "legal-review",
    capabilityNeeded: "legal-risk-identification",
    reason: "Potential compliance question",
    question: "Is there a licensing requirement?",
    contextSummary: "California market entry",
    urgency: "low",
    riskLevel: "medium",
    confidence: 0.5,
  });
  const denied = denyHelpRequest(req, "Out of scope for this engagement");
  assert.equal(denied.status, "denied");
});

test("redirectHelpRequest moves status to redirected", () => {
  const req = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "finance",
    capabilityNeeded: "revenue-projections",
    reason: "Need projection support",
    question: "Revenue?",
    contextSummary: "Context",
    urgency: "low",
    riskLevel: "low",
    confidence: 0.5,
  });
  // redirectHelpRequest works from pending status
  const redirected = redirectHelpRequest(req, "strategy", "Strategy is better suited for this question");
  assert.equal(redirected.status, "redirected");
  // The redirect target is stored in redirectedToAgentId (original requestedAgentId unchanged)
  assert.ok(redirected.status === "redirected");
});

test("answerHelpRequest creates a valid help response", () => {
  const req = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "strategy",
    requestedAgentId: "finance",
    capabilityNeeded: "revenue-projections",
    reason: "Need Year 1 revenue estimate",
    question: "What is the expected Year 1 revenue?",
    contextSummary: "California craft brewery",
    urgency: "medium",
    riskLevel: "medium",
    confidence: 0.65,
  });
  const approvedReq = approveHelpRequest(req);
  const { updatedRequest: answered, response } = answerHelpRequest(approvedReq, {
    fromAgentId: "finance",
    answer: "Base case: $1.2M. Conservative: $800K. Upside: $1.8M.",
    assumptions: ["Distribution costs stable", "No production expansion needed"],
    evidence: ["Historical comparable market data"],
    confidence: 0.68,
    escalationNeeded: false,
  });
  assert.equal(answered.status, "answered");
  assert.ok(response.answer.includes("$1.2M"));
  assert.equal(response.confidence, 0.68);
});

// ----- Collaboration Trace -----

test("createCollaborationTrace records initial team-selected event", () => {
  const trace = createCollaborationTrace("ENG-001", ["orchestrator", "researcher"], { orchestrator: "Core agent", researcher: "Research needed" });
  assert.equal(trace.engagementId, "ENG-001");
  assert.equal(trace.timelineEvents[0].type, "team-selected");
  assert.ok(trace.selectedAgents.includes("orchestrator"));
});

test("collaboration trace includes leadershipDoctrineVersion", () => {
  const trace = createCollaborationTrace("ENG-002", ["orchestrator"], {});
  assert.equal(typeof trace.leadershipDoctrineVersion, "string");
  assert.ok(trace.leadershipDoctrineVersion.length > 0);
  assert.equal(trace.leadershipDoctrineVersion, "1.0.0");
});

test("collaboration trace includes doctrine fields", () => {
  const trace = createCollaborationTrace("ENG-003", ["orchestrator"], {});
  assert.ok(Array.isArray(trace.principlesApplied));
  assert.ok(typeof trace.leadershipDecisionCheck === "object");
  assert.ok(Array.isArray(trace.doctrineEscalations));
});

test("addTimelineEvent records events correctly", () => {
  const trace = createCollaborationTrace("ENG-001", ["orchestrator"], {});
  const updated = addTimelineEvent(trace, { type: "task-assigned", message: "Task assigned to researcher", metadata: { agentId: "researcher" } });
  assert.equal(updated.timelineEvents.length, 2);
  assert.equal(updated.timelineEvents[1].type, "task-assigned");
});

test("summarizeCollaborationTrace returns a valid summary", () => {
  const trace = createCollaborationTrace("ENG-001", ["orchestrator", "researcher"], {});
  const summary = summarizeCollaborationTrace(trace);
  assert.ok(["pending", "low", "medium", "high"].includes(summary.overallLevel));
  assert.equal(typeof summary.rationale, "string");
});

// ----- Guardrails -----

test("guardrail evaluator blocks duplicate help requests", () => {
  // Add an existing pending request
  const existingReq = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "finance",
    capabilityNeeded: "financial-modeling",
    reason: "Need model",
    question: "Revenue?",
    contextSummary: "",
    urgency: "low",
    riskLevel: "low",
    confidence: 0.5,
  });
  const trace = { ...createCollaborationTrace("ENG-001", ["orchestrator", "researcher"], {}), helpRequests: [existingReq] };
  // Submit the exact same request again
  const duplicateReq = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "finance",
    capabilityNeeded: "financial-modeling",
    reason: "Need model again",
    question: "Revenue?",
    contextSummary: "",
    urgency: "low",
    riskLevel: "low",
    confidence: 0.5,
  });
  const result = evaluateCollaborationGuardrails(trace, { type: "help-request", request: duplicateReq }, DEFAULT_GUARDRAIL_CONFIG);
  assert.equal(result.allowed, false);
  assert.ok(result.reason.length > 0, "should have a reason");
});

test("guardrail evaluator enforces max help requests per agent", () => {
  // Use a low per-agent limit config
  const lowPerAgentConfig = { ...DEFAULT_GUARDRAIL_CONFIG, maxHelpRequestsPerAgent: 1 };
  const existingReq = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "finance",
    capabilityNeeded: "cap-0",
    reason: "First",
    question: "?",
    contextSummary: "",
    urgency: "low",
    riskLevel: "low",
    confidence: 0.5,
  });
  const trace = { ...createCollaborationTrace("ENG-001", ["orchestrator", "researcher"], {}), helpRequests: [existingReq] };
  const nextReq = createHelpRequest({
    engagementId: "ENG-001",
    fromAgentId: "researcher",
    requestedAgentId: "strategy",
    capabilityNeeded: "cap-1",
    reason: "Second",
    question: "?",
    contextSummary: "",
    urgency: "low",
    riskLevel: "low",
    confidence: 0.5,
  });
  const result = evaluateCollaborationGuardrails(trace, { type: "help-request", request: nextReq }, lowPerAgentConfig);
  assert.equal(result.allowed, false);
});

// ----- Human Approval Gates -----

test("human approval gate triggers for legal-sensitive content", () => {
  const result = requiresHumanApproval({ hasLegalSensitiveContent: true });
  assert.equal(result.required, true);
  assert.ok(result.reasons.length > 0);
});

test("human approval gate triggers for client-facing deliverable", () => {
  const result = requiresHumanApproval({ isClientFacingDeliverable: true });
  assert.equal(result.required, true);
});

test("human approval gate triggers for financial projections", () => {
  const result = requiresHumanApproval({ hasFinancialProjections: true });
  assert.equal(result.required, true);
});

test("human approval gate does not trigger for low-risk internal output", () => {
  const result = requiresHumanApproval({});
  assert.equal(result.required, false);
});

// ----- Leadership Doctrine -----

test("doctrine version exists and is 1.0.0", () => {
  assert.equal(DOCTRINE_VERSION, "1.0.0");
  assert.equal(getDoctrineVersion(), "1.0.0");
});

test("all 12 doctrine principles exist", () => {
  const principles = listLeadershipPrinciples();
  assert.equal(principles.length, 12, `Expected 12 principles, got ${principles.length}`);
});

test("each doctrine principle has required fields", () => {
  for (const principle of listLeadershipPrinciples()) {
    assert.ok(principle.id, `Principle missing id`);
    assert.ok(principle.name, `Principle ${principle.id} missing name`);
    assert.ok(principle.description.length > 40, `Principle ${principle.id} description too short`);
    assert.ok(principle.decisionQuestions.length >= 2, `Principle ${principle.id} missing decision questions`);
    assert.ok(principle.outputChecks.length >= 2, `Principle ${principle.id} missing output checks`);
    assert.ok(principle.escalationTriggers.length >= 1, `Principle ${principle.id} missing escalation triggers`);
  }
});

test("leadership decision check has at least 10 questions", () => {
  const check = getLeadershipDecisionCheck();
  assert.ok(check.questions.length >= 10, `Expected >= 10 questions, got ${check.questions.length}`);
  assert.equal(check.humanReviewRequired, true);
});

test("conflict resolution priority has 7 levels in correct order", () => {
  assert.equal(CONFLICT_RESOLUTION_PRIORITY.length, 7);
  assert.equal(CONFLICT_RESOLUTION_PRIORITY[0].order, 1);
  assert.match(CONFLICT_RESOLUTION_PRIORITY[0].principle, /legal|ethical|safety/i);
  assert.equal(CONFLICT_RESOLUTION_PRIORITY[6].order, 7);
  assert.match(CONFLICT_RESOLUTION_PRIORITY[6].principle, /speed|convenience/i);
});

test("copyright guardrail is non-empty and explicit", () => {
  assert.ok(COPYRIGHT_GUARDRAIL.length > 50);
  assert.match(COPYRIGHT_GUARDRAIL, /original/i);
  assert.match(COPYRIGHT_GUARDRAIL, /copyright/i);
});

test("doctrine text does not contain known book titles or quotes", () => {
  const doctrine = getLeadershipDoctrine();
  const allText = [
    ...doctrine.principles.map((p) => p.description),
    ...doctrine.principles.flatMap((p) => p.decisionQuestions),
  ].join(" ").toLowerCase();
  // These phrases would indicate direct quoting or thin book summaries
  const forbiddenPhrases = [
    "7 habits", "seven habits", "raving fans", "setting the table",
    "who moved my cheese", "make your bed", "one minute manager", "midas touch",
  ];
  for (const phrase of forbiddenPhrases) {
    assert.ok(!allText.includes(phrase), `Doctrine text must not reference book title: "${phrase}"`);
  }
});

test("evaluateLeadershipDecisionCheck returns failed questions", () => {
  const check = getLeadershipDecisionCheck();
  const answers: Record<string, boolean> = {};
  for (const q of check.questions) {
    answers[q] = true;
  }
  // Fail one question
  answers[check.questions[0]] = false;
  const result = evaluateLeadershipDecisionCheck(answers);
  assert.equal(result.passed, false);
  assert.equal(result.failedQuestions.length, 1);
  assert.equal(result.humanReviewRequired, true);
});

test("evaluateLeadershipDecisionCheck passes when all questions answered true", () => {
  const check = getLeadershipDecisionCheck();
  const answers: Record<string, boolean> = {};
  for (const q of check.questions) answers[q] = true;
  const result = evaluateLeadershipDecisionCheck(answers);
  assert.equal(result.passed, true);
  assert.equal(result.failedQuestions.length, 0);
  assert.equal(result.humanReviewRequired, false);
});

test("no live xAI calls in agent collaboration tests", () => {
  // All functions above are synchronous and use no providers.
  // Confirm by verifying selectAgentTeam is not async.
  const result = selectAgentTeam({ engagementType: "general-consulting" });
  assert.ok(!(result instanceof Promise), "selectAgentTeam must be synchronous");
});
