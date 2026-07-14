import type { ZodType } from "zod";
import type { AIProvider } from "../../ai/provider";
import type { BaseAgent } from "../base-agent";
import {
  ProjectManagerOutputSchema,
  MarketResearchOutputSchema,
  FinanceOutputSchema,
  StrategyOutputSchema,
  BrandStrategyOutputSchema,
  CreativeDirectorOutputSchema,
  WebsiteDigitalOutputSchema,
  OperationsOutputSchema,
  LegalReviewOutputSchema,
  SalesRevenueOutputSchema,
  InvestorRelationsOutputSchema,
  ExecutiveReviewOutputSchema,
} from "../output-schemas";
import { AgentPermissions } from "../permissions";
import type { AgentDefinition, AgentTask, ProviderName } from "../types";

function nowIso() {
  return "2026-07-13T00:00:00.000Z";
}

type WorkforceDefinitionConfig = {
  id: string;
  name: string;
  department: string;
  role: string;
  roleSummary: string;
  description: string;
  capabilities: string[];
  permissions: string[];
  outputSchema: ZodType<unknown>;
  outputSchemaName: string;
  typicalTasks: string[];
  workflowStepMapping: string[];
  requiresApproval: boolean;
  approvalReason: string;
  approvalMode: "none" | "pre_execution" | "post_execution";
  riskLevel: "low" | "medium" | "high" | "critical";
  supportsDataRoomMetadata: boolean;
  requiresHumanReview: boolean;
  inputRequiredFields: string[];
  inputOptionalFields: string[];
  systemPrompt: string;
  defaultProvider?: ProviderName;
  allowedProviders?: ProviderName[];
};

function createDefinition(config: WorkforceDefinitionConfig): AgentDefinition {
  const defaultProvider = config.defaultProvider ?? "xai";
  const allowedProviders = config.allowedProviders ?? ["xai", "mock"];

  return {
    id: config.id,
    name: config.name,
    department: config.department,
    description: config.description,
    role: config.role,
    roleSummary: config.roleSummary,
    version: "1.0.0",
    capabilities: config.capabilities,
    allowedTools: config.permissions,
    permissions: config.permissions,
    defaultProvider,
    allowedProviders,
    defaultModel: process.env.XAI_DEFAULT_MODEL ?? "grok-4.5",
    systemPrompt: config.systemPrompt,
    outputSchema: config.outputSchema,
    requiresApproval: config.requiresApproval,
    approvalRequirements: {
      required: config.requiresApproval,
      reason: config.approvalReason,
      mode: config.approvalMode,
    },
    riskLevel: config.riskLevel,
    inputContract: {
      description: "Task objective and engagement-safe context.",
      requiredFields: config.inputRequiredFields,
      optionalFields: config.inputOptionalFields,
    },
    outputContract: {
      description: "Structured consulting output for downstream review.",
      schemaName: config.outputSchemaName,
      safeFields: Object.keys((config.outputSchema as unknown as { shape?: Record<string, unknown> }).shape || {}),
    },
    typicalTasks: config.typicalTasks,
    workflowStepMapping: config.workflowStepMapping,
    supportsDataRoomMetadata: config.supportsDataRoomMetadata,
    requiresHumanReview: config.requiresHumanReview,
    maximumIterations: 3,
    timeoutMs: 90_000,
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

class WorkforceAgent<TOutput> implements BaseAgent<TOutput> {
  readonly definition: AgentDefinition;
  private readonly schema: ZodType<TOutput>;

  constructor(definition: AgentDefinition, schema: ZodType<TOutput>) {
    this.definition = definition;
    this.schema = schema;
  }

  validateTask(task: AgentTask): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!task.objective || task.objective.trim().length === 0) {
      errors.push("task.objective is required.");
    }
    if (task.agentId !== this.definition.id) {
      errors.push(`task.agentId must be \"${this.definition.id}\".`);
    }
    return { valid: errors.length === 0, errors };
  }

  buildSystemPrompt(_task: AgentTask): string {
    return this.definition.systemPrompt;
  }

  buildMessages(task: AgentTask): Array<{ role: "user" | "assistant"; content: string }> {
    return [
      {
        role: "user",
        content:
          `Objective: ${task.objective}\n` +
          `Instructions: ${task.instructions || "none"}\n` +
          "Return strict JSON only that conforms to your output schema.",
      },
    ];
  }

  async execute(task: AgentTask, provider: AIProvider): Promise<TOutput> {
    const messages = this.buildMessages(task);
    return provider.generateStructuredResult(
      {
        systemPrompt: this.buildSystemPrompt(task),
        userPrompt: messages[0].content,
        metadata: { agentId: this.definition.id },
      },
      this.schema,
    );
  }

  parseOutput(raw: string): TOutput {
    return this.schema.parse(JSON.parse(raw));
  }

  validateOutput(output: unknown): output is TOutput {
    return this.schema.safeParse(output).success;
  }
}

export const projectManagerDefinition = createDefinition({
  id: "project-manager",
  name: "Project Manager Agent",
  department: "operations",
  role: "project-manager",
  roleSummary: "Translates strategic direction into milestones, owners, and dependencies.",
  description: "Produces implementation sequencing and delivery coordination plans.",
  capabilities: ["planning", "milestones", "dependency-mapping"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.CREATE_OPERATIONS_RECOMMENDATION,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  outputSchema: ProjectManagerOutputSchema,
  outputSchemaName: "ProjectManagerOutputSchema",
  typicalTasks: ["Build milestone plan", "Flag blockers and owners"],
  workflowStepMapping: ["strategy", "operations"],
  requiresApproval: false,
  approvalReason: "Planning output supports implementation; approval may be requested by workflow.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["constraints", "timeline"],
  systemPrompt: "You are the Project Manager Agent. Return implementation plans in strict JSON.",
});

export const marketResearchDefinition = createDefinition({
  id: "market-research",
  name: "Market Research Agent",
  department: "intelligence",
  role: "market-researcher",
  roleSummary: "Analyzes market structure, demand signals, and segment opportunities.",
  description: "Produces structured market opportunity assessments for strategy teams.",
  capabilities: ["market-segmentation", "demand-analysis", "competitive-context"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_MARKET_ANALYSIS,
  ],
  outputSchema: MarketResearchOutputSchema,
  outputSchemaName: "MarketResearchOutputSchema",
  typicalTasks: ["Analyze market opportunity", "Map target segments"],
  workflowStepMapping: ["intelligence", "strategy"],
  requiresApproval: false,
  approvalReason: "Analytical output is validated by QC and executive review.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["geography", "audience"],
  systemPrompt: "You are the Market Research Agent. Return only validated structured analysis in JSON.",
});

export const financeDefinition = createDefinition({
  id: "finance",
  name: "Finance Agent",
  department: "finance",
  role: "finance-analyst",
  roleSummary: "Builds financial analysis hypotheses and risk framing for decision support.",
  description: "Produces non-certified financial analysis support with explicit assumptions and risks.",
  capabilities: ["revenue-modeling", "cost-analysis", "cashflow-framing"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_FINANCIAL_ANALYSIS,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  outputSchema: FinanceOutputSchema,
  outputSchemaName: "FinanceOutputSchema",
  typicalTasks: ["Review uploaded financial summary", "Draft acquisition evaluation"],
  workflowStepMapping: ["strategy", "publishing"],
  requiresApproval: true,
  approvalReason: "Financial recommendations can influence consequential decisions.",
  approvalMode: "post_execution",
  riskLevel: "high",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["financialMetadata", "constraints"],
  systemPrompt:
    "You are the Finance Agent. Provide analytical support only. Do not claim certified accounting advice. Return strict JSON only.",
});

export const strategyDefinition = createDefinition({
  id: "strategy",
  name: "Strategy Agent",
  department: "strategy",
  role: "strategy-advisor",
  roleSummary: "Generates strategic options and recommends tradeoff-aware direction.",
  description: "Transforms research into decision-ready strategic recommendations.",
  capabilities: ["option-generation", "tradeoff-analysis", "decision-support"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_STRATEGY_RECOMMENDATION,
  ],
  outputSchema: StrategyOutputSchema,
  outputSchemaName: "StrategyOutputSchema",
  typicalTasks: ["Review strategy for gaps", "Draft strategic options"],
  workflowStepMapping: ["strategy"],
  requiresApproval: false,
  approvalReason: "Strategy remains advisory before executive decision.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["researchSummary"],
  systemPrompt: "You are the Strategy Agent. Provide explicit tradeoffs and decision requirements in JSON.",
});

export const brandStrategyDefinition = createDefinition({
  id: "brand-strategy",
  name: "Brand Strategy Agent",
  department: "brand",
  role: "brand-strategist",
  roleSummary: "Defines positioning, messaging, and differentiation guidance.",
  description: "Produces brand direction aligned with market and strategy inputs.",
  capabilities: ["positioning", "messaging", "voice-definition"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.CREATE_BRAND_RECOMMENDATION,
  ],
  outputSchema: BrandStrategyOutputSchema,
  outputSchemaName: "BrandStrategyOutputSchema",
  typicalTasks: ["Create brand positioning brief", "Refine narrative"],
  workflowStepMapping: ["creative"],
  requiresApproval: false,
  approvalReason: "Brand recommendations are subject to client and executive review.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["audience", "existingBrandContext"],
  systemPrompt: "You are the Brand Strategy Agent. Return practical, structured brand guidance in JSON.",
});

export const creativeDirectorDefinition = createDefinition({
  id: "creative-director",
  name: "Creative Director Agent",
  department: "creative",
  role: "creative-director",
  roleSummary: "Shapes creative direction and campaign concept recommendations.",
  description: "Translates brand strategy into campaign and asset direction.",
  capabilities: ["creative-direction", "campaign-concepts", "asset-planning"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.CREATE_BRAND_RECOMMENDATION,
  ],
  outputSchema: CreativeDirectorOutputSchema,
  outputSchemaName: "CreativeDirectorOutputSchema",
  typicalTasks: ["Draft campaign concepts", "Define visual concept direction"],
  workflowStepMapping: ["creative"],
  requiresApproval: false,
  approvalReason: "Creative output remains draft unless approved by humans.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["brandContext", "campaignGoals"],
  systemPrompt: "You are the Creative Director Agent. Provide structured concepts, not final publishing actions.",
});

export const websiteDigitalDefinition = createDefinition({
  id: "website-digital",
  name: "Website / Digital Agent",
  department: "website",
  role: "website-digital-analyst",
  roleSummary: "Assesses digital journey and conversion opportunities.",
  description: "Produces website and digital growth recommendations.",
  capabilities: ["journey-analysis", "conversion-assessment", "seo-framing"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.CREATE_WEBSITE_RECOMMENDATION,
  ],
  outputSchema: WebsiteDigitalOutputSchema,
  outputSchemaName: "WebsiteDigitalOutputSchema",
  typicalTasks: ["Evaluate website/digital presence", "Recommend conversion improvements"],
  workflowStepMapping: ["creative", "publishing"],
  requiresApproval: false,
  approvalReason: "Digital recommendations remain advisory.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["websiteMetadata"],
  systemPrompt: "You are the Website / Digital Agent. Return structured recommendations only in JSON.",
});

export const operationsDefinition = createDefinition({
  id: "operations",
  name: "Operations Agent",
  department: "operations",
  role: "operations-advisor",
  roleSummary: "Identifies process, staffing, and implementation readiness gaps.",
  description: "Builds operational readiness recommendations and implementation plans.",
  capabilities: ["process-assessment", "readiness-planning", "execution-design"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_OPERATIONS_RECOMMENDATION,
  ],
  outputSchema: OperationsOutputSchema,
  outputSchemaName: "OperationsOutputSchema",
  typicalTasks: ["Build operations readiness checklist", "Assess operational gaps"],
  workflowStepMapping: ["strategy", "publishing"],
  requiresApproval: false,
  approvalReason: "Operations output supports execution planning.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["orgConstraints"],
  systemPrompt: "You are the Operations Agent. Produce practical implementation guidance in JSON.",
});

export const legalReviewDefinition = createDefinition({
  id: "legal-review",
  name: "Legal Review Agent",
  department: "legal",
  role: "legal-issue-spotter",
  roleSummary: "Flags legal and compliance issues for licensed attorney review.",
  description: "Identifies legal issue areas and required attorney escalation points.",
  capabilities: ["issue-spotting", "compliance-flagging", "risk-escalation"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_LEGAL_RISK_REVIEW,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  outputSchema: LegalReviewOutputSchema,
  outputSchemaName: "LegalReviewOutputSchema",
  typicalTasks: ["Identify legal/licensing issues", "Flag attorney-review needs"],
  workflowStepMapping: ["strategy", "publishing"],
  requiresApproval: true,
  approvalReason: "Legal-related outputs must be reviewed by humans before action.",
  approvalMode: "post_execution",
  riskLevel: "high",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["contractMetadata", "complianceContext"],
  systemPrompt:
    "You are the Legal Review Agent. You are not a lawyer and must not provide legal advice. Only identify issues for attorney review. Return strict JSON.",
});

export const salesRevenueDefinition = createDefinition({
  id: "sales-revenue",
  name: "Sales / Revenue Agent",
  department: "sales",
  role: "revenue-strategist",
  roleSummary: "Builds channel, pricing, and pipeline opportunity recommendations.",
  description: "Produces structured revenue growth recommendations.",
  capabilities: ["channel-analysis", "pipeline-planning", "pricing-inputs"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.CREATE_SALES_RECOMMENDATION,
  ],
  outputSchema: SalesRevenueOutputSchema,
  outputSchemaName: "SalesRevenueOutputSchema",
  typicalTasks: ["Map sales channels", "Recommend revenue opportunities"],
  workflowStepMapping: ["strategy", "publishing"],
  requiresApproval: false,
  approvalReason: "Sales recommendations remain advisory before execution.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["segmentContext", "pricingContext"],
  systemPrompt: "You are the Sales / Revenue Agent. Produce structured growth guidance in JSON.",
});

export const investorRelationsDefinition = createDefinition({
  id: "investor-relations",
  name: "Investor Relations Agent",
  department: "investor-relations",
  role: "investor-relations-advisor",
  roleSummary: "Prepares investor narrative and diligence-readiness recommendations.",
  description: "Supports fundraising preparation and investor communication structure.",
  capabilities: ["narrative-development", "diligence-readiness", "risk-disclosure-framing"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_INVESTOR_MATERIALS,
  ],
  outputSchema: InvestorRelationsOutputSchema,
  outputSchemaName: "InvestorRelationsOutputSchema",
  typicalTasks: ["Build investor narrative", "Outline diligence needs"],
  workflowStepMapping: ["publishing"],
  requiresApproval: false,
  approvalReason: "Investor draft output requires executive review before external use.",
  approvalMode: "none",
  riskLevel: "medium",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["fundraisingGoals"],
  systemPrompt: "You are the Investor Relations Agent. Return structured investor-ready planning content in JSON.",
});

export const executiveReviewDefinition = createDefinition({
  id: "executive-review",
  name: "Executive Review Agent",
  department: "executive-review",
  role: "executive-reviewer",
  roleSummary: "Builds final decision summary and approval recommendation.",
  description: "Synthesizes cross-department output into final executive recommendation.",
  capabilities: ["executive-synthesis", "decision-framing", "final-recommendation"],
  permissions: [
    AgentPermissions.READ_ENGAGEMENT_CONTEXT,
    AgentPermissions.READ_CLIENT_PROFILE,
    AgentPermissions.READ_DATA_ROOM_METADATA,
    AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT,
    AgentPermissions.CREATE_EXECUTIVE_SUMMARY,
    AgentPermissions.REQUEST_HUMAN_APPROVAL,
  ],
  outputSchema: ExecutiveReviewOutputSchema,
  outputSchemaName: "ExecutiveReviewOutputSchema",
  typicalTasks: ["Create executive recommendation", "Prepare final decision summary"],
  workflowStepMapping: ["publishing"],
  requiresApproval: true,
  approvalReason: "Final recommendations require explicit human authorization.",
  approvalMode: "post_execution",
  riskLevel: "high",
  supportsDataRoomMetadata: true,
  requiresHumanReview: true,
  inputRequiredFields: ["objective"],
  inputOptionalFields: ["qcSummary", "departmentOutputs"],
  systemPrompt: "You are the Executive Review Agent. Produce final structured recommendations in JSON for human decision-makers.",
});

export const workforceDefinitions: AgentDefinition[] = [
  projectManagerDefinition,
  marketResearchDefinition,
  financeDefinition,
  strategyDefinition,
  brandStrategyDefinition,
  creativeDirectorDefinition,
  websiteDigitalDefinition,
  operationsDefinition,
  legalReviewDefinition,
  salesRevenueDefinition,
  investorRelationsDefinition,
  executiveReviewDefinition,
];

export const workforceSchemas: Record<string, ZodType<unknown>> = {
  "project-manager": ProjectManagerOutputSchema,
  "market-research": MarketResearchOutputSchema,
  finance: FinanceOutputSchema,
  strategy: StrategyOutputSchema,
  "brand-strategy": BrandStrategyOutputSchema,
  "creative-director": CreativeDirectorOutputSchema,
  "website-digital": WebsiteDigitalOutputSchema,
  operations: OperationsOutputSchema,
  "legal-review": LegalReviewOutputSchema,
  "sales-revenue": SalesRevenueOutputSchema,
  "investor-relations": InvestorRelationsOutputSchema,
  "executive-review": ExecutiveReviewOutputSchema,
};

export function createWorkforceAgentInstance(agentId: string): BaseAgent<unknown> {
  const definition = workforceDefinitions.find((item) => item.id === agentId);
  const schema = workforceSchemas[agentId];
  if (!definition || !schema) {
    throw new Error(`Unknown workforce agent id: ${agentId}`);
  }
  return new WorkforceAgent(definition, schema as ZodType<unknown>);
}
