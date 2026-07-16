/**
 * FullSendOS Agent Collaboration Framework v1
 * Dynamic team selection — deterministic, no live AI calls.
 *
 * Selects the right specialist agents for an engagement based on type, keywords,
 * and requested deliverables. The Orchestrator and Executive Review are always
 * included unless explicitly excluded.
 *
 * Human approval is required before any client-facing delivery.
 */

import { listAgentProfiles, getCoreAgents, findAgentsForEngagementType } from "./agent-registry";

export type TeamSelectionInput = {
  engagementType: string;
  title?: string;
  description?: string;
  requestedDeliverables?: string[];
  clientContext?: {
    industry?: string;
    hasLegalRequirements?: boolean;
    hasFinancialProjections?: boolean;
    hasInvestorAudience?: boolean;
  };
  riskFlags?: string[];
};

export type TeamSelectionOutput = {
  selectedAgents: string[];
  requiredAgents: string[];
  optionalAgents: string[];
  selectionReasons: Record<string, string>;
  missingInformation: string[];
  humanApprovalRequired: boolean;
  humanApprovalReasons: string[];
};

/** Engagement type to required + recommended agent mappings. */
const ENGAGEMENT_TEAM_MAP: Record<
  string,
  { required: string[]; recommended: string[] }
> = {
  "market-entry": {
    required: ["orchestrator", "researcher", "strategy", "executive-review"],
    recommended: ["market-research", "brand-strategy", "quality-control"],
  },
  "business-plan": {
    required: ["orchestrator", "researcher", "strategy", "finance", "operations", "executive-review"],
    recommended: ["market-research", "brand-strategy", "quality-control", "legal-review"],
  },
  "investor-deck": {
    required: ["orchestrator", "researcher", "finance", "investor-relations", "strategy", "executive-review"],
    recommended: ["brand-strategy", "creative-director", "legal-review", "quality-control"],
  },
  "sba-loan": {
    required: ["orchestrator", "finance", "operations", "legal-review", "executive-review"],
    recommended: ["researcher", "strategy", "quality-control"],
  },
  "brand-strategy": {
    required: ["orchestrator", "brand-strategy", "researcher", "executive-review"],
    recommended: ["creative-director", "website-digital", "quality-control"],
  },
  "website-strategy": {
    required: ["orchestrator", "website-digital", "brand-strategy", "executive-review"],
    recommended: ["creative-director", "quality-control"],
  },
  "operations-review": {
    required: ["orchestrator", "operations", "executive-review"],
    recommended: ["finance", "legal-review", "quality-control"],
  },
  "financial-analysis": {
    required: ["orchestrator", "finance", "executive-review"],
    recommended: ["researcher", "operations", "legal-review", "quality-control"],
  },
  "general-consulting": {
    required: ["orchestrator", "researcher", "strategy", "executive-review"],
    recommended: ["finance", "quality-control"],
  },
};

const DELIVERABLE_AGENT_HINTS: Record<string, string[]> = {
  "investor-deck": ["investor-relations", "finance", "legal-review"],
  "financial-model": ["finance"],
  "brand-guide": ["brand-strategy", "creative-director"],
  "market-research": ["researcher", "market-research"],
  "operations-plan": ["operations"],
  "website-strategy": ["website-digital"],
  "expansion-plan": ["strategy", "finance"],
  "sba-application": ["finance", "operations", "legal-review"],
};

const SELECTION_REASONS: Record<string, string> = {
  orchestrator: "Always required — owns team composition and help-request approval.",
  "executive-review": "Always required — synthesizes final deliverables and owns client-readiness gate.",
  researcher: "Provides market intelligence and validated research for all strategy-based engagements.",
  "market-research": "Provides segment-specific market analysis.",
  finance: "Provides financial modeling, revenue scenarios, and cost-structure analysis.",
  strategy: "Develops growth strategy, positioning, and go-to-market plan.",
  "brand-strategy": "Develops brand positioning, voice, and messaging framework.",
  "creative-director": "Guides creative concepts and content strategy.",
  "website-digital": "Develops digital channel strategy and website architecture.",
  operations: "Analyzes operational structure, constraints, and process improvement opportunities.",
  "legal-review": "Reviews for legal sensitivity and compliance risk.",
  "investor-relations": "Develops investor narrative and fundraising strategy.",
  "quality-control": "Reviews all output for consistency, accuracy, and completeness.",
  "project-manager": "Coordinates timeline and tracks deliverable status.",
  "sales-revenue": "Develops revenue growth and sales channel strategy.",
};

function normalizeEngagementType(input: string): string {
  const lower = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const aliases: Record<string, string> = {
    "sba": "sba-loan",
    "sba-application": "sba-loan",
    "loan-application": "sba-loan",
    "investor": "investor-deck",
    "pitch-deck": "investor-deck",
    "fundraising": "investor-deck",
    "brand": "brand-strategy",
    "branding": "brand-strategy",
    "website": "website-strategy",
    "digital": "website-strategy",
    "operations": "operations-review",
    "ops-review": "operations-review",
    "financial": "financial-analysis",
    "finance": "financial-analysis",
    "market": "market-entry",
    "expansion": "market-entry",
  };

  return aliases[lower] || ENGAGEMENT_TEAM_MAP[lower] ? (ENGAGEMENT_TEAM_MAP[lower] ? lower : "general-consulting") : "general-consulting";
}

export function selectAgentTeam(input: TeamSelectionInput): TeamSelectionOutput {
  const normalizedType = normalizeEngagementType(input.engagementType);
  const mapping = ENGAGEMENT_TEAM_MAP[normalizedType] || ENGAGEMENT_TEAM_MAP["general-consulting"];

  const requiredSet = new Set(mapping.required);
  const optionalSet = new Set(mapping.recommended);

  // Add agents based on requested deliverables
  for (const deliverable of input.requestedDeliverables || []) {
    const hints = DELIVERABLE_AGENT_HINTS[deliverable.toLowerCase()] || [];
    for (const agentId of hints) {
      if (!requiredSet.has(agentId)) {
        optionalSet.add(agentId);
      }
    }
  }

  // Add legal-review if client has legal requirements
  if (input.clientContext?.hasLegalRequirements) {
    requiredSet.add("legal-review");
    optionalSet.delete("legal-review");
  }

  // Add investor-relations if investor audience
  if (input.clientContext?.hasInvestorAudience) {
    requiredSet.add("investor-relations");
    optionalSet.delete("investor-relations");
  }

  // Add finance if financial projections needed
  if (input.clientContext?.hasFinancialProjections) {
    requiredSet.add("finance");
    optionalSet.delete("finance");
  }

  const selectedAgents = [...new Set([...requiredSet, ...optionalSet])];

  const selectionReasons: Record<string, string> = {};
  for (const agentId of selectedAgents) {
    selectionReasons[agentId] = SELECTION_REASONS[agentId] || `Selected for ${normalizedType} engagement type.`;
  }

  const missingInformation: string[] = [];
  if (!input.clientContext?.industry) {
    missingInformation.push("Client industry context is not specified — research quality may be reduced.");
  }
  if (!input.description && !input.title) {
    missingInformation.push("Engagement description is missing — team selection may be suboptimal.");
  }

  const humanApprovalReasons: string[] = [];
  if (requiredSet.has("legal-review")) humanApprovalReasons.push("Legal-sensitive output requires human attorney review.");
  if (requiredSet.has("investor-relations") || input.clientContext?.hasInvestorAudience) {
    humanApprovalReasons.push("Investor-facing materials require human approval before distribution.");
  }
  if (requiredSet.has("finance") && (input.clientContext?.hasFinancialProjections || normalizedType === "sba-loan" || normalizedType === "investor-deck")) {
    humanApprovalReasons.push("Financial projections require human validation before client delivery.");
  }

  return {
    selectedAgents,
    requiredAgents: [...requiredSet],
    optionalAgents: [...optionalSet],
    selectionReasons,
    missingInformation,
    humanApprovalRequired: humanApprovalReasons.length > 0,
    humanApprovalReasons,
  };
}
