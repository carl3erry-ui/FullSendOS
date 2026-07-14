import { createHash, randomBytes } from "node:crypto";
import type { EngagementDetail } from "@/app/components/work-product-model";
import {
  DeliverableExportSchema,
  type DeliverableExport,
  type DeliverableExportFormat,
} from "@/schemas/deliverable-export";

const UNSAFE_PATTERN = /(storagePath|textExtracted|rawProviderResponse|systemPrompt|apiKey|diagnosticTrace|stack|token|secret|hidden reasoning)/i;

type BuildDeliverableExportParams = {
  engagementId: string;
  clientId?: string;
  engagementTitle: string;
  clientName?: string;
  sourceWorkProductId?: string;
  detail: EngagementDetail;
  format: DeliverableExportFormat;
};

type SectionBundle = {
  executiveReport: string;
  onePageSummary: string;
  deckOutline: string;
  sourcesUsed: string;
  assumptions: string;
  openQuestions: string;
  humanConfirmations: string;
  confidenceSummary: string;
  recommendedNextActions: string;
  exportMetadata: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function safeText(input: unknown, fallback = "Not available"): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  if (UNSAFE_PATTERN.test(trimmed)) return fallback;
  return trimmed;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeDetail(detail: EngagementDetail): EngagementDetail {
  const serialized = JSON.stringify(detail, (_key, value) => {
    if (typeof value === "string" && UNSAFE_PATTERN.test(value)) return "[redacted]";
    return value;
  });

  return JSON.parse(serialized) as EngagementDetail;
}

function buildSections(params: BuildDeliverableExportParams): SectionBundle {
  const detail = sanitizeDetail(params.detail);
  const deliverables = detail.deliverables || {};
  const evidenceSummary = deliverables.evidenceSummary;
  const evidenceReferences = Array.isArray(deliverables.evidenceReferences) ? deliverables.evidenceReferences : [];

  const executiveReport = safeText(deliverables.executiveReport, "No executive report recorded.");
  const onePageSummary = safeText(deliverables.onePageSummary, "No one-page summary recorded.");

  const deckOutlineItems = Array.isArray(deliverables.deckOutline) ? deliverables.deckOutline : [];
  const deckOutline = deckOutlineItems.length === 0
    ? "No deck outline recorded."
    : deckOutlineItems
        .map((slide, index) => {
          const slideNum = slide.slide ?? index + 1;
          const title = safeText(slide.title, "Untitled slide");
          const purpose = safeText(slide.purpose, "No key message provided.");
          const points = Array.isArray(slide.keyPoints) && slide.keyPoints.length > 0
            ? slide.keyPoints.map((point) => `- ${safeText(point, "Structured value")}`).join("\n")
            : "- No supporting points recorded.";
          return `Slide ${slideNum}: ${title}\nKey message: ${purpose}\n${points}`;
        })
        .join("\n\n");

  const sourcesUsed = evidenceReferences.length === 0
    ? "No sources recorded."
    : evidenceReferences
        .map((reference) => {
          const label = safeText(reference.citationLabel, "Source");
          const title = safeText(reference.title, "Untitled source");
          const description = safeText(reference.description, "No description provided.");
          const excerpt = reference.excerptPreview ? ` Excerpt: ${safeText(reference.excerptPreview, "Unavailable")}` : "";
          return `- ${label}: ${title}. ${description}.${excerpt}`;
        })
        .join("\n");

  const assumptions = Array.isArray(evidenceSummary?.assumptions) && evidenceSummary.assumptions.length > 0
    ? evidenceSummary.assumptions
        .map((assumption) => `- ${safeText(assumption.statement, "Assumption unavailable")}`)
        .join("\n")
    : "No assumptions recorded.";

  const openQuestions = Array.isArray(evidenceSummary?.openQuestions) && evidenceSummary.openQuestions.length > 0
    ? evidenceSummary.openQuestions
        .map((question) => {
          const why = question.whyItMatters ? ` Why it matters: ${safeText(question.whyItMatters, "Not provided")}.` : "";
          return `- ${safeText(question.question, "Question unavailable")}.${why}`;
        })
        .join("\n")
    : "No open questions recorded.";

  const humanConfirmations = Array.isArray(evidenceSummary?.humanConfirmations) && evidenceSummary.humanConfirmations.length > 0
    ? evidenceSummary.humanConfirmations
        .map((confirmation) => `- ${safeText(confirmation.citationLabel, "Human confirmation")}: ${safeText(confirmation.description, "No details provided.")}`)
        .join("\n")
    : "No human confirmations recorded.";

  const confidence = evidenceSummary?.confidenceSummary;
  const confidenceSummary = confidence
    ? `Level: ${confidence.level.toUpperCase()}${typeof confidence.score === "number" ? ` (${Math.round(confidence.score * 100)}%)` : ""}. ${safeText(confidence.rationale, "No rationale provided.")}`
    : "No confidence summary recorded.";

  const recommendedNextActions = Array.isArray(evidenceSummary?.recommendedNextActions) && evidenceSummary.recommendedNextActions.length > 0
    ? evidenceSummary.recommendedNextActions.map((action) => `- ${safeText(action, "Next action unavailable")}`).join("\n")
    : "No recommended next actions recorded.";

  const metadataLines = [
    `Generated by: FullSendOS`,
    `Generated at: ${nowIso()}`,
    `Engagement: ${safeText(params.engagementTitle, params.engagementId)}`,
    `Client: ${safeText(params.clientName, "Not available")}`,
    `Evidence references: ${evidenceReferences.length}`,
    `Assumptions: ${Array.isArray(evidenceSummary?.assumptions) ? evidenceSummary.assumptions.length : 0}`,
    `Open questions: ${Array.isArray(evidenceSummary?.openQuestions) ? evidenceSummary.openQuestions.length : 0}`,
    `Human confirmations: ${Array.isArray(evidenceSummary?.humanConfirmations) ? evidenceSummary.humanConfirmations.length : 0}`,
    "Limitations: Export excludes raw provider payloads, private prompts, full extracted text, storage paths, and hidden reasoning.",
  ];

  return {
    executiveReport,
    onePageSummary,
    deckOutline,
    sourcesUsed,
    assumptions,
    openQuestions,
    humanConfirmations,
    confidenceSummary,
    recommendedNextActions,
    exportMetadata: metadataLines.join("\n"),
  };
}

function renderMarkdown(sections: SectionBundle): string {
  return [
    "# Engagement Deliverable",
    "",
    "## Executive Report",
    sections.executiveReport,
    "",
    "## One-Page Summary",
    sections.onePageSummary,
    "",
    "## Deck Outline",
    sections.deckOutline,
    "",
    "## Sources Used",
    sections.sourcesUsed,
    "",
    "## Assumptions",
    sections.assumptions,
    "",
    "## Open Questions",
    sections.openQuestions,
    "",
    "## Human Confirmations",
    sections.humanConfirmations,
    "",
    "## Confidence Summary",
    sections.confidenceSummary,
    "",
    "## Recommended Next Actions",
    sections.recommendedNextActions,
    "",
    "## Export Metadata",
    sections.exportMetadata,
    "",
  ].join("\n");
}

function renderText(sections: SectionBundle): string {
  return [
    "ENGAGEMENT DELIVERABLE",
    "====================",
    "",
    "EXECUTIVE REPORT",
    "----------------",
    sections.executiveReport,
    "",
    "ONE-PAGE SUMMARY",
    "----------------",
    sections.onePageSummary,
    "",
    "DECK OUTLINE",
    "------------",
    sections.deckOutline,
    "",
    "SOURCES USED",
    "------------",
    sections.sourcesUsed,
    "",
    "ASSUMPTIONS",
    "-----------",
    sections.assumptions,
    "",
    "OPEN QUESTIONS",
    "--------------",
    sections.openQuestions,
    "",
    "HUMAN CONFIRMATIONS",
    "-------------------",
    sections.humanConfirmations,
    "",
    "CONFIDENCE SUMMARY",
    "------------------",
    sections.confidenceSummary,
    "",
    "RECOMMENDED NEXT ACTIONS",
    "------------------------",
    sections.recommendedNextActions,
    "",
    "EXPORT METADATA",
    "---------------",
    sections.exportMetadata,
    "",
  ].join("\n");
}

function renderHtml(sections: SectionBundle): string {
  const block = (title: string, content: string) => `<section><h2>${escapeHtml(title)}</h2><pre>${escapeHtml(content)}</pre></section>`;

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<title>Engagement Deliverable Export</title>",
    "</head>",
    "<body>",
    "<main>",
    "<h1>Engagement Deliverable</h1>",
    block("Executive Report", sections.executiveReport),
    block("One-Page Summary", sections.onePageSummary),
    block("Deck Outline", sections.deckOutline),
    block("Sources Used", sections.sourcesUsed),
    block("Assumptions", sections.assumptions),
    block("Open Questions", sections.openQuestions),
    block("Human Confirmations", sections.humanConfirmations),
    block("Confidence Summary", sections.confidenceSummary),
    block("Recommended Next Actions", sections.recommendedNextActions),
    block("Export Metadata", sections.exportMetadata),
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function renderJson(sections: SectionBundle): string {
  return JSON.stringify(
    {
      executiveReport: sections.executiveReport,
      onePageSummary: sections.onePageSummary,
      deckOutline: sections.deckOutline,
      sourcesUsed: sections.sourcesUsed,
      assumptions: sections.assumptions,
      openQuestions: sections.openQuestions,
      humanConfirmations: sections.humanConfirmations,
      confidenceSummary: sections.confidenceSummary,
      recommendedNextActions: sections.recommendedNextActions,
      exportMetadata: sections.exportMetadata,
    },
    null,
    2,
  );
}

function contentTypeFor(format: DeliverableExportFormat): string {
  if (format === "markdown") return "text/markdown; charset=utf-8";
  if (format === "html") return "text/html; charset=utf-8";
  if (format === "json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function extensionFor(format: DeliverableExportFormat): string {
  if (format === "markdown") return "md";
  if (format === "html") return "html";
  if (format === "json") return "json";
  return "txt";
}

function renderContent(format: DeliverableExportFormat, sections: SectionBundle): string {
  if (format === "markdown") return renderMarkdown(sections);
  if (format === "html") return renderHtml(sections);
  if (format === "json") return renderJson(sections);
  return renderText(sections);
}

export function buildDeliverableExport(params: BuildDeliverableExportParams): DeliverableExport {
  const generatedAt = nowIso();
  const sections = buildSections(params);
  const content = renderContent(params.format, sections);
  const byteSize = Buffer.byteLength(content, "utf8");
  const checksum = createHash("sha256").update(content).digest("hex");
  const exportId = `exp-${randomBytes(10).toString("hex")}`;

  const evidenceSummary = params.detail.deliverables?.evidenceSummary;
  const evidenceReferences = Array.isArray(params.detail.deliverables?.evidenceReferences)
    ? params.detail.deliverables?.evidenceReferences
    : [];

  const includedSections = [
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
  ];

  return DeliverableExportSchema.parse({
    id: exportId,
    engagementId: params.engagementId,
    clientId: params.clientId,
    format: params.format,
    filename: `${params.engagementId}-deliverable-${generatedAt.replace(/[:.]/g, "-")}.${extensionFor(params.format)}`,
    title: `${params.engagementTitle} Deliverable Export`,
    status: "created",
    createdAt: generatedAt,
    generatedAt,
    sourceWorkProductId: params.sourceWorkProductId,
    contentType: contentTypeFor(params.format),
    byteSize,
    checksum,
    exportMetadata: {
      generatedBy: "FullSendOS",
      generatedAt,
      engagementTitle: params.engagementTitle,
      clientName: params.clientName,
      includedSections,
      evidenceReferenceCount: evidenceReferences.length,
      assumptionCount: Array.isArray(evidenceSummary?.assumptions) ? evidenceSummary.assumptions.length : 0,
      openQuestionCount: Array.isArray(evidenceSummary?.openQuestions) ? evidenceSummary.openQuestions.length : 0,
      humanConfirmationCount: Array.isArray(evidenceSummary?.humanConfirmations) ? evidenceSummary.humanConfirmations.length : 0,
      confidenceSummary: evidenceSummary?.confidenceSummary,
      limitations: [
        "No raw provider payloads are included.",
        "No private prompts are included.",
        "No full extracted document text is included.",
        "No storage paths or local file paths are included.",
      ],
    },
    safetySummary: {
      hiddenReasoningExcluded: true,
      providerPayloadExcluded: true,
      storagePathExcluded: true,
      fullExtractedTextExcluded: true,
      stackTraceExcluded: true,
      apiKeyExcluded: true,
      privatePromptExcluded: true,
    },
    content,
  });
}
