import { DANGEROUS_PERMISSIONS } from "./permissions";
import type { AgentRegistry, PublicAgentMetadata } from "./registry";

export type DepartmentAgentMapping = {
  departmentId: string;
  primaryAgentId: string;
  supportingAgentIds: string[];
};

export type WorkforceTaskTemplate = {
  id: string;
  title: string;
  departmentId: string;
  agentId: string;
  objectiveTemplate: string;
  instructionsTemplate: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
};

export const WORKFORCE_DEPARTMENT_MAPPINGS: DepartmentAgentMapping[] = [
  {
    departmentId: "executive",
    primaryAgentId: "orchestrator",
    supportingAgentIds: ["executive-review", "project-manager"],
  },
  {
    departmentId: "intelligence",
    primaryAgentId: "researcher",
    supportingAgentIds: ["market-research"],
  },
  {
    departmentId: "strategy",
    primaryAgentId: "strategy",
    supportingAgentIds: ["finance", "sales-revenue"],
  },
  {
    departmentId: "brand",
    primaryAgentId: "brand-strategy",
    supportingAgentIds: ["creative-director", "website-digital"],
  },
  {
    departmentId: "operations",
    primaryAgentId: "operations",
    supportingAgentIds: ["project-manager"],
  },
  {
    departmentId: "legal",
    primaryAgentId: "legal-review",
    supportingAgentIds: [],
  },
  {
    departmentId: "investor-relations",
    primaryAgentId: "investor-relations",
    supportingAgentIds: ["finance", "executive-review"],
  },
  {
    departmentId: "quality-control",
    primaryAgentId: "quality-control",
    supportingAgentIds: [],
  },
  {
    departmentId: "publishing",
    primaryAgentId: "executive-review",
    supportingAgentIds: ["quality-control"],
  },
];

export const WORKFORCE_TASK_TEMPLATES: WorkforceTaskTemplate[] = [
  {
    id: "tmpl-executive-workplan",
    title: "Executive Workplan",
    departmentId: "executive",
    agentId: "orchestrator",
    objectiveTemplate: "Create an executive workplan for {{clientName}} based on current engagement goals.",
    instructionsTemplate: "Return a department-assigned plan with decision points and approval gates.",
    riskLevel: "high",
    requiresApproval: true,
  },
  {
    id: "tmpl-company-research",
    title: "Company Research Snapshot",
    departmentId: "intelligence",
    agentId: "researcher",
    objectiveTemplate: "Research {{clientName}} and summarize the most relevant engagement context.",
    instructionsTemplate: "List assumptions, unknowns, and recommended follow-up analysis.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-market-opportunity",
    title: "Market Opportunity Analysis",
    departmentId: "intelligence",
    agentId: "market-research",
    objectiveTemplate: "Assess market opportunity and target segments for {{clientName}}.",
    instructionsTemplate: "Return segment opportunities, risks, and confidence ratings.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-financial-review",
    title: "Financial Analysis Support",
    departmentId: "strategy",
    agentId: "finance",
    objectiveTemplate: "Review available financial context and frame decision-relevant insights.",
    instructionsTemplate: "Include assumptions, risks, and open questions. Do not provide certified accounting advice.",
    riskLevel: "high",
    requiresApproval: true,
  },
  {
    id: "tmpl-strategy-options",
    title: "Strategy Options",
    departmentId: "strategy",
    agentId: "strategy",
    objectiveTemplate: "Generate strategic options for {{clientName}} aligned to engagement goals.",
    instructionsTemplate: "Include recommendation, tradeoffs, and milestone implications.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-brand-positioning",
    title: "Brand Positioning Brief",
    departmentId: "brand",
    agentId: "brand-strategy",
    objectiveTemplate: "Develop positioning and messaging guidance for {{clientName}}.",
    instructionsTemplate: "Return audience framing, message pillars, and differentiation.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-campaign-concepts",
    title: "Campaign Concept Directions",
    departmentId: "brand",
    agentId: "creative-director",
    objectiveTemplate: "Create campaign direction concepts based on brand strategy.",
    instructionsTemplate: "Return concept options and risks, not production-ready assets.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-digital-optimization",
    title: "Website and Digital Optimization",
    departmentId: "brand",
    agentId: "website-digital",
    objectiveTemplate: "Identify digital journey and conversion improvements for {{clientName}}.",
    instructionsTemplate: "Include user journey, content priorities, and technical risks.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-ops-readiness",
    title: "Operational Readiness",
    departmentId: "operations",
    agentId: "operations",
    objectiveTemplate: "Assess operational readiness for the proposed strategy.",
    instructionsTemplate: "Return process gaps, staffing considerations, and implementation plan.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-legal-issue-spotting",
    title: "Legal Issue Spotting",
    departmentId: "legal",
    agentId: "legal-review",
    objectiveTemplate: "Identify legal issue areas related to this engagement plan.",
    instructionsTemplate: "Flag attorney-review requirements. Do not provide legal advice.",
    riskLevel: "high",
    requiresApproval: true,
  },
  {
    id: "tmpl-revenue-plan",
    title: "Revenue Growth Plan",
    departmentId: "strategy",
    agentId: "sales-revenue",
    objectiveTemplate: "Recommend revenue channel opportunities for {{clientName}}.",
    instructionsTemplate: "Return channels, pipeline ideas, pricing considerations, and risks.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-investor-narrative",
    title: "Investor Narrative Draft",
    departmentId: "investor-relations",
    agentId: "investor-relations",
    objectiveTemplate: "Draft investor narrative structure for {{clientName}}.",
    instructionsTemplate: "Include diligence needs, risk disclosures, and next actions.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-quality-review",
    title: "Cross-Department Quality Review",
    departmentId: "quality-control",
    agentId: "quality-control",
    objectiveTemplate: "Review current department outputs for consistency and evidence quality.",
    instructionsTemplate: "Return verdict, issues, and recommended fixes.",
    riskLevel: "medium",
    requiresApproval: false,
  },
  {
    id: "tmpl-executive-decision",
    title: "Executive Decision Summary",
    departmentId: "publishing",
    agentId: "executive-review",
    objectiveTemplate: "Create final executive decision summary for the engagement.",
    instructionsTemplate: "Synthesize departmental outputs, unresolved questions, and next actions.",
    riskLevel: "high",
    requiresApproval: true,
  },
];

function filterToRegisteredAgents<T extends { agentId: string }>(
  items: T[],
  availableAgentIds: Set<string>,
): T[] {
  return items.filter((item) => availableAgentIds.has(item.agentId));
}

function filterMappingsToRegisteredAgents(
  mappings: DepartmentAgentMapping[],
  availableAgentIds: Set<string>,
): DepartmentAgentMapping[] {
  return mappings
    .filter((mapping) => availableAgentIds.has(mapping.primaryAgentId))
    .map((mapping) => ({
      ...mapping,
      supportingAgentIds: mapping.supportingAgentIds.filter((agentId) =>
        availableAgentIds.has(agentId),
      ),
    }));
}

export function getPublicWorkforceCatalog(registry: AgentRegistry): {
  departmentMappings: DepartmentAgentMapping[];
  taskTemplates: WorkforceTaskTemplate[];
  availableAgents: PublicAgentMetadata[];
} {
  const availableAgents = registry.listPublicMetadata();
  const availableAgentIds = new Set(availableAgents.map((agent) => agent.id));

  return {
    departmentMappings: filterMappingsToRegisteredAgents(
      WORKFORCE_DEPARTMENT_MAPPINGS,
      availableAgentIds,
    ),
    taskTemplates: filterToRegisteredAgents(
      WORKFORCE_TASK_TEMPLATES,
      availableAgentIds,
    ),
    availableAgents,
  };
}

export function hasDangerousPermissions(permissions: string[]): boolean {
  return permissions.some((permission) =>
    DANGEROUS_PERMISSIONS.has(permission as Parameters<typeof DANGEROUS_PERMISSIONS.has>[0]),
  );
}
