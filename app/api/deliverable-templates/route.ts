import { NextResponse } from "next/server";
import { listDeliverableTemplates } from "@/services/deliverable-template-service";

export async function GET() {
  try {
    const templates = listDeliverableTemplates().map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      format: template.format,
      brandName: template.brandName,
      tone: template.tone,
      layout: template.layout,
      sections: template.sections,
      includeMetadata: template.includeMetadata,
      includeSources: template.includeSources,
      includeAssumptions: template.includeAssumptions,
      includeOpenQuestions: template.includeOpenQuestions,
      includeHumanConfirmations: template.includeHumanConfirmations,
      includeConfidenceSummary: template.includeConfidenceSummary,
      createdAt: template.createdAt,
    }));

    return NextResponse.json(templates);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load deliverable templates.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
