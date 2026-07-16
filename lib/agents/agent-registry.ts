/**
 * FullSendOS Agent Collaboration Framework v1
 * Agent Capability Registry — statically defined profiles for each specialist agent.
 *
 * Rules:
 * - Agents cannot freely call each other without Orchestrator approval.
 * - All collaboration is logged.
 * - Human approval is required before client-facing delivery.
 * - This registry is deterministic and local — no live AI calls.
 */

export type CostRiskLevel = "low" | "medium" | "high" | "critical";

export type AgentCapabilityProfile = {
  /** Unique ID matching the existing agent registry. */
  agentId: string;
  /** Display name. */
  name: string;
  /** Which department area this agent primarily serves. */
  department: string;
  /** Functional role label. */
  role: string;
  /** Human-readable description. */
  description: string;
  /** What this agent can produce or do. */
  capabilities: string[];
  /** Engagement types where this agent is most useful. */
  bestUseCases: string[];
  /** Inputs the agent requires to operate well. */
  inputsNeeded: string[];
  /** Outputs this agent produces. */
  outputsProduced: string[];
  /** Other agents or capabilities this agent can ask for help with. */
  canHelpWith: string[];
  /** When this agent should escalate rather than answer. */
  escalatesWhen: string[];
  /** Output types that require explicit human approval before proceeding. */
  approvalRequiredFor: string[];
  /** Preferred provider (may be overridden). */
  defaultProviderPreference: "xai" | "mock";
  /** Cost risk rating for budgeting guardrails. */
  costRiskLevel: CostRiskLevel;
  /** True if this agent must be present in every engagement. */
  isCoreAgent: boolean;
};

const AGENT_PROFILES: AgentCapabilityProfile[] = [
  {
    agentId: "orchestrator",
    name: "Orchestrator",
    department: "executive",
    role: "engagement-planner",
    description: "Plans and coordinates the engagement. Approves or denies help requests. Owns the team composition decision.",
    capabilities: ["engagement-planning", "team-selection", "task-routing", "help-request-approval", "workflow-orchestration"],
    bestUseCases: ["all-engagement-types"],
    inputsNeeded: ["engagement-brief", "client-context", "requested-deliverables"],
    outputsProduced: ["team-selection-plan", "task-assignments", "collaboration-instructions"],
    canHelpWith: ["strategic-direction", "scope-clarification", "escalation-routing"],
    escalatesWhen: ["engagement-scope-exceeds-current-agents", "conflicting-agent-outputs", "critical-risk-detected"],
    approvalRequiredFor: ["team-selection-changes", "scope-expansion"],
    defaultProviderPreference: "xai",
    costRiskLevel: "medium",
    isCoreAgent: true,
  },
  {
    agentId: "project-manager",
    name: "Project Manager",
    department: "executive",
    role: "project-coordinator",
    description: "Tracks deliverable status, flags blockers, and maintains timeline awareness.",
    capabilities: ["timeline-tracking", "deliverable-status", "blocker-identification", "milestone-planning"],
    bestUseCases: ["multi-phase-engagements", "complex-deliverables"],
    inputsNeeded: ["team-composition", "deliverable-list", "timeline"],
    outputsProduced: ["project-status-summary", "blocker-report"],
    canHelpWith: ["timeline", "scope-clarification", "priority-ordering"],
    escalatesWhen: ["critical-path-blocked", "timeline-at-risk"],
    approvalRequiredFor: ["timeline-extension", "scope-change"],
    defaultProviderPreference: "xai",
    costRiskLevel: "low",
    isCoreAgent: false,
  },
  {
    agentId: "researcher",
    name: "Research Analyst",
    department: "intelligence",
    role: "market-researcher",
    description: "Produces validated market and industry research with claims, evidence, and unknowns.",
    capabilities: ["market-research", "industry-analysis", "trend-identification", "competitor-mapping", "data-validation"],
    bestUseCases: ["market-entry", "business-plan", "investor-deck", "brand-strategy", "general-consulting"],
    inputsNeeded: ["industry", "geography", "business-context", "research-questions"],
    outputsProduced: ["research-summary", "market-context", "trends", "metrics", "claims", "unknowns"],
    canHelpWith: ["data-sourcing", "market-sizing", "competitor-identification"],
    escalatesWhen: ["insufficient-primary-data", "conflicting-market-signals", "high-uncertainty-threshold-exceeded"],
    approvalRequiredFor: ["publishing-research-externally", "making-market-size-projections-client-facing"],
    defaultProviderPreference: "xai",
    costRiskLevel: "medium",
    isCoreAgent: false,
  },
  {
    agentId: "market-research",
    name: "Market Research Specialist",
    department: "intelligence",
    role: "market-research-specialist",
    description: "Provides deeper market research focus for specific segments, verticals, or geographies.",
    capabilities: ["deep-market-analysis", "segment-sizing", "buyer-persona-research", "channel-analysis"],
    bestUseCases: ["market-entry", "investor-deck", "brand-strategy"],
    inputsNeeded: ["target-market", "segment-definition", "geography"],
    outputsProduced: ["market-segment-analysis", "buyer-profile", "channel-landscape"],
    canHelpWith: ["market-sizing", "persona-development", "geography-analysis"],
    escalatesWhen: ["market-data-unavailable", "conflicting-segment-definitions"],
    approvalRequiredFor: ["external-market-claims"],
    defaultProviderPreference: "xai",
    costRiskLevel: "medium",
    isCoreAgent: false,
  },
  {
    agentId: "finance",
    name: "Financial Analyst",
    department: "finance",
    role: "financial-analyst",
    description: "Builds financial models, revenue scenarios, cost structures, and ROI analyses.",
    capabilities: ["financial-modeling", "revenue-scenario-planning", "cost-structure-analysis", "roi-analysis", "financial-projection"],
    bestUseCases: ["business-plan", "investor-deck", "sba-loan", "financial-analysis"],
    inputsNeeded: ["business-model", "revenue-drivers", "cost-structure", "historical-financials"],
    outputsProduced: ["financial-model", "scenario-analysis", "roi-summary", "financial-risks"],
    canHelpWith: ["revenue-projections", "cost-estimates", "financial-risk-assessment"],
    escalatesWhen: ["missing-critical-financial-data", "projections-exceed-reasonable-bounds", "legal-financial-compliance-question"],
    approvalRequiredFor: ["client-facing-financial-projections", "investor-facing-financial-models", "loan-document-numbers"],
    defaultProviderPreference: "xai",
    costRiskLevel: "high",
    isCoreAgent: false,
  },
  {
    agentId: "strategy",
    name: "Strategy Advisor",
    department: "strategy",
    role: "strategy-advisor",
    description: "Develops growth strategy, market positioning, go-to-market plans, and strategic recommendations.",
    capabilities: ["strategic-planning", "market-positioning", "go-to-market", "growth-strategy", "competitive-positioning"],
    bestUseCases: ["market-entry", "business-plan", "general-consulting", "brand-strategy"],
    inputsNeeded: ["market-research", "competitor-landscape", "business-objectives", "constraints"],
    outputsProduced: ["strategic-thesis", "positioning-statement", "go-to-market-plan", "90-day-action-plan"],
    canHelpWith: ["strategic-tradeoffs", "prioritization", "decision-frameworks"],
    escalatesWhen: ["conflicting-strategic-signals", "major-assumption-invalidated"],
    approvalRequiredFor: ["client-facing-strategic-recommendations"],
    defaultProviderPreference: "xai",
    costRiskLevel: "medium",
    isCoreAgent: false,
  },
  {
    agentId: "brand-strategy",
    name: "Brand Strategist",
    department: "brand",
    role: "brand-strategist",
    description: "Develops brand positioning, voice, messaging, and visual direction.",
    capabilities: ["brand-positioning", "brand-voice", "messaging-strategy", "visual-direction", "brand-architecture"],
    bestUseCases: ["brand-strategy", "market-entry", "investor-deck"],
    inputsNeeded: ["business-overview", "target-customers", "competitive-landscape", "brand-brief"],
    outputsProduced: ["brand-essence", "positioning-statement", "messaging-framework", "visual-direction"],
    canHelpWith: ["tone-of-voice", "brand-differentiation", "messaging-review"],
    escalatesWhen: ["brand-conflicts-with-legal-requirements", "brand-voice-undefined"],
    approvalRequiredFor: ["client-facing-brand-guidelines"],
    defaultProviderPreference: "xai",
    costRiskLevel: "low",
    isCoreAgent: false,
  },
  {
    agentId: "creative-director",
    name: "Creative Director",
    department: "brand",
    role: "creative-director",
    description: "Guides creative direction, visual concepts, and content strategy.",
    capabilities: ["creative-direction", "content-strategy", "campaign-concepts", "visual-concept-development"],
    bestUseCases: ["brand-strategy", "website-strategy"],
    inputsNeeded: ["brand-brief", "target-audience", "channel-strategy"],
    outputsProduced: ["creative-brief", "campaign-concepts", "content-framework"],
    canHelpWith: ["content-development", "campaign-ideation", "visual-concept"],
    escalatesWhen: ["brand-guidelines-missing", "approval-chain-unclear"],
    approvalRequiredFor: ["client-facing-creative-assets"],
    defaultProviderPreference: "xai",
    costRiskLevel: "low",
    isCoreAgent: false,
  },
  {
    agentId: "website-digital",
    name: "Website/Digital Strategist",
    department: "brand",
    role: "digital-strategist",
    description: "Designs website strategy, user flows, content hierarchy, and conversion architecture.",
    capabilities: ["website-strategy", "content-hierarchy", "conversion-optimization", "user-experience"],
    bestUseCases: ["website-strategy", "brand-strategy"],
    inputsNeeded: ["brand-brief", "target-audience", "business-goals"],
    outputsProduced: ["website-strategy", "sitemap", "homepage-wireframe", "cta-recommendations"],
    canHelpWith: ["digital-channel-strategy", "content-structure"],
    escalatesWhen: ["technical-infrastructure-questions-outside-scope"],
    approvalRequiredFor: ["client-facing-website-specifications"],
    defaultProviderPreference: "xai",
    costRiskLevel: "low",
    isCoreAgent: false,
  },
  {
    agentId: "operations",
    name: "Operations Analyst",
    department: "operations",
    role: "operations-analyst",
    description: "Analyzes operational structure, processes, and constraints to identify improvements.",
    capabilities: ["operational-analysis", "process-mapping", "constraint-identification", "sop-review"],
    bestUseCases: ["operations-review", "business-plan", "sba-loan"],
    inputsNeeded: ["business-model", "current-processes", "team-structure", "constraints"],
    outputsProduced: ["operational-assessment", "bottleneck-analysis", "improvement-recommendations"],
    canHelpWith: ["process-optimization", "org-design", "operational-risk"],
    escalatesWhen: ["legal-compliance-question", "financial-implications-of-ops-changes"],
    approvalRequiredFor: ["operational-restructuring-recommendations"],
    defaultProviderPreference: "xai",
    costRiskLevel: "low",
    isCoreAgent: false,
  },
  {
    agentId: "legal-review",
    name: "Legal Review",
    department: "legal",
    role: "legal-reviewer",
    description: "Reviews output for legal sensitivity, compliance risks, and regulatory exposure. Requires human attorney review before client delivery.",
    capabilities: ["legal-risk-identification", "compliance-check", "regulatory-flag", "liability-review"],
    bestUseCases: ["investor-deck", "sba-loan", "business-plan", "operations-review"],
    inputsNeeded: ["draft-deliverable", "jurisdiction", "industry-context"],
    outputsProduced: ["legal-risk-summary", "compliance-flags", "recommended-caveats"],
    canHelpWith: ["legal-language-review", "disclaimer-recommendations", "risk-flagging"],
    escalatesWhen: ["all-legal-conclusions-require-licensed-attorney-review"],
    approvalRequiredFor: ["all-legal-output-before-client-delivery"],
    defaultProviderPreference: "mock",
    costRiskLevel: "high",
    isCoreAgent: false,
  },
  {
    agentId: "sales-revenue",
    name: "Sales/Revenue Strategist",
    department: "strategy",
    role: "revenue-strategist",
    description: "Develops go-to-market, revenue growth, and sales strategies.",
    capabilities: ["sales-strategy", "revenue-modeling", "channel-strategy", "gtm-planning"],
    bestUseCases: ["market-entry", "business-plan", "investor-deck"],
    inputsNeeded: ["target-market", "pricing-model", "distribution-channels"],
    outputsProduced: ["sales-strategy", "revenue-roadmap", "channel-plan"],
    canHelpWith: ["pricing-strategy", "sales-channel-optimization"],
    escalatesWhen: ["financial-projections-conflict-with-market-data"],
    approvalRequiredFor: ["revenue-projections-in-investor-materials"],
    defaultProviderPreference: "xai",
    costRiskLevel: "medium",
    isCoreAgent: false,
  },
  {
    agentId: "investor-relations",
    name: "Investor Relations",
    department: "investor-relations",
    role: "investor-relations-advisor",
    description: "Develops investor narrative, pitch materials, and fundraising strategy.",
    capabilities: ["investor-narrative", "pitch-deck-strategy", "fundraising-strategy", "term-sheet-context"],
    bestUseCases: ["investor-deck", "sba-loan"],
    inputsNeeded: ["financial-model", "business-overview", "growth-strategy", "market-opportunity"],
    outputsProduced: ["investor-narrative", "pitch-story", "fundraising-strategy"],
    canHelpWith: ["investor-positioning", "term-sheet-structuring-context", "raise-strategy"],
    escalatesWhen: ["securities-law-questions", "specific-legal-terms-in-term-sheets"],
    approvalRequiredFor: ["all-investor-materials-before-distribution"],
    defaultProviderPreference: "xai",
    costRiskLevel: "high",
    isCoreAgent: false,
  },
  {
    agentId: "quality-control",
    name: "Quality Control",
    department: "quality-control",
    role: "quality-reviewer",
    description: "Reviews all output for consistency, accuracy, completeness, and internal contradictions.",
    capabilities: ["consistency-review", "accuracy-check", "completeness-check", "contradiction-detection"],
    bestUseCases: ["all-engagement-types"],
    inputsNeeded: ["all-department-outputs", "engagement-brief"],
    outputsProduced: ["quality-review-report", "revision-recommendations", "consistency-check"],
    canHelpWith: ["output-validation", "cross-department-consistency"],
    escalatesWhen: ["critical-inconsistencies-detected", "confidence-below-threshold"],
    approvalRequiredFor: ["issuing-pass-verdict-on-client-facing-deliverables"],
    defaultProviderPreference: "xai",
    costRiskLevel: "medium",
    isCoreAgent: false,
  },
  {
    agentId: "executive-review",
    name: "Executive Review",
    department: "executive",
    role: "executive-reviewer",
    description: "Synthesizes all department outputs into final executive deliverables. Always runs last. Requires human approval before client delivery.",
    capabilities: ["executive-synthesis", "report-writing", "one-page-summary", "deck-outline", "final-review"],
    bestUseCases: ["all-engagement-types"],
    inputsNeeded: ["all-validated-department-outputs", "quality-control-sign-off"],
    outputsProduced: ["executive-report", "one-page-summary", "deck-outline", "client-readiness-assessment"],
    canHelpWith: ["final-synthesis", "executive-communication", "board-presentation-structure"],
    escalatesWhen: ["department-outputs-contradictory", "critical-unknowns-unresolved"],
    approvalRequiredFor: ["all-final-deliverables-before-client-delivery"],
    defaultProviderPreference: "xai",
    costRiskLevel: "medium",
    isCoreAgent: true,
  },
];

const profileMap = new Map<string, AgentCapabilityProfile>(
  AGENT_PROFILES.map((p) => [p.agentId, p]),
);

export function getAgentProfile(agentId: string): AgentCapabilityProfile | undefined {
  return profileMap.get(agentId);
}

export function listAgentProfiles(): AgentCapabilityProfile[] {
  return [...AGENT_PROFILES];
}

export function findAgentsByCapability(capability: string): AgentCapabilityProfile[] {
  const lower = capability.toLowerCase();
  return AGENT_PROFILES.filter((profile) =>
    profile.capabilities.some((c) => c.toLowerCase().includes(lower)),
  );
}

export function findAgentsForEngagementType(engagementType: string): AgentCapabilityProfile[] {
  const lower = engagementType.toLowerCase();
  return AGENT_PROFILES.filter((profile) =>
    profile.bestUseCases.includes("all-engagement-types") ||
    profile.bestUseCases.some((u) => u.toLowerCase().includes(lower)),
  );
}

export function getCoreAgents(): AgentCapabilityProfile[] {
  return AGENT_PROFILES.filter((profile) => profile.isCoreAgent);
}

export const AGENT_REGISTRY_EXPORT = {
  getAgentProfile,
  listAgentProfiles,
  findAgentsByCapability,
  findAgentsForEngagementType,
  getCoreAgents,
};
