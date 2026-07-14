import {
  DeliverableTemplateSchema,
  type DeliverableTemplate,
  type DeliverableTemplateId,
} from "@/schemas/deliverable-template";
import type { DeliverableExportFormat } from "@/schemas/deliverable-export";

const CREATED_AT = "2026-07-14T00:00:00.000Z";

const BUILT_IN_TEMPLATES: DeliverableTemplate[] = [
  {
    id: "executive-standard",
    name: "Executive Standard",
    description: "Balanced executive format for internal and external review.",
    format: "any",
    brandName: "FullSendOS",
    tone: "Executive and direct",
    layout: "Structured section cards",
    sections: [
      "Executive Report",
      "One-Page Summary",
      "Deck Outline",
      "Sources Used",
      "Assumptions",
      "Open Questions",
      "Human Confirmations",
      "Confidence Summary",
      "Recommended Next Actions",
      "Export Metadata",
    ],
    includeMetadata: true,
    includeSources: true,
    includeAssumptions: true,
    includeOpenQuestions: true,
    includeHumanConfirmations: true,
    includeConfidenceSummary: true,
    createdAt: CREATED_AT,
    version: "1.0.0",
  },
  {
    id: "client-ready",
    name: "Client Ready",
    description: "Cleaner client-facing format with minimal internal framing.",
    format: "any",
    brandName: "FullSendOS",
    tone: "Clear and client-facing",
    layout: "Narrative blocks",
    sections: [
      "Executive Summary",
      "Recommendations",
      "Next Actions",
      "Sources Used",
      "Open Questions",
      "Export Metadata",
    ],
    includeMetadata: true,
    includeSources: true,
    includeAssumptions: false,
    includeOpenQuestions: true,
    includeHumanConfirmations: false,
    includeConfidenceSummary: false,
    createdAt: CREATED_AT,
    version: "1.0.0",
  },
  {
    id: "investor-brief",
    name: "Investor Brief",
    description: "Investor-oriented summary with opportunity and risk framing.",
    format: "any",
    brandName: "FullSendOS",
    tone: "Analytical and concise",
    layout: "Briefing memo",
    sections: [
      "Investment Thesis",
      "Opportunity Summary",
      "Risks",
      "Evidence",
      "Open Questions",
      "Next Actions",
      "Export Metadata",
    ],
    includeMetadata: true,
    includeSources: true,
    includeAssumptions: false,
    includeOpenQuestions: true,
    includeHumanConfirmations: false,
    includeConfidenceSummary: false,
    createdAt: CREATED_AT,
    version: "1.0.0",
  },
  {
    id: "internal-review",
    name: "Internal Review",
    description: "Operational internal format with full context and caveats.",
    format: "any",
    brandName: "FullSendOS",
    tone: "Operational and thorough",
    layout: "Detailed review sections",
    sections: [
      "Executive Report",
      "One-Page Summary",
      "Deck Outline",
      "Sources Used",
      "Assumptions",
      "Open Questions",
      "Human Confirmations",
      "Confidence Summary",
      "Recommended Next Actions",
      "Export Metadata",
    ],
    includeMetadata: true,
    includeSources: true,
    includeAssumptions: true,
    includeOpenQuestions: true,
    includeHumanConfirmations: true,
    includeConfidenceSummary: true,
    createdAt: CREATED_AT,
    version: "1.0.0",
  },
].map((template) => DeliverableTemplateSchema.parse(template));

export function listDeliverableTemplates(): DeliverableTemplate[] {
  return BUILT_IN_TEMPLATES;
}

export function getDefaultDeliverableTemplate(): DeliverableTemplate {
  return BUILT_IN_TEMPLATES[0];
}

export function resolveDeliverableTemplate(
  templateId: DeliverableTemplateId | undefined,
  format: DeliverableExportFormat,
): DeliverableTemplate | null {
  const template = templateId
    ? BUILT_IN_TEMPLATES.find((item) => item.id === templateId)
    : getDefaultDeliverableTemplate();

  if (!template) return null;
  if (template.format !== "any" && template.format !== format) return null;

  return template;
}
