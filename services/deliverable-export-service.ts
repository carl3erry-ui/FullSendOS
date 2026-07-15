import { createHash, randomBytes } from "node:crypto";
import type { EngagementDetail } from "@/app/components/work-product-model";
import {
  DeliverableExportSchema,
  type DeliverableExport,
  type DeliverableExportFormat,
} from "@/schemas/deliverable-export";
import type { DeliverableTemplate } from "@/schemas/deliverable-template";
import { renderDeliverablePdf } from "@/services/deliverable-pdf-renderer";

const UNSAFE_PATTERN = /(storagePath|textExtracted|rawProviderResponse|systemPrompt|apiKey|diagnosticTrace|stack|token|secret|hidden reasoning)/i;

type BuildDeliverableExportParams = {
  engagementId: string;
  clientId?: string;
  engagementTitle: string;
  clientName?: string;
  sourceWorkProductId?: string;
  detail: EngagementDetail;
  format: DeliverableExportFormat;
  template: DeliverableTemplate;
};

type SectionMap = {
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

type RenderedSection = {
  title: string;
  content: string;
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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

function buildSections(params: BuildDeliverableExportParams): SectionMap {
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
    `Template: ${params.template.name} (${params.template.id})`,
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

function mapTemplateSections(template: DeliverableTemplate, sections: SectionMap): RenderedSection[] {
  const mapped: RenderedSection[] = [];

  const include = {
    sources: template.includeSources,
    assumptions: template.includeAssumptions,
    openQuestions: template.includeOpenQuestions,
    confirmations: template.includeHumanConfirmations,
    confidence: template.includeConfidenceSummary,
    metadata: template.includeMetadata,
  };

  for (const title of template.sections) {
    if (title === "Executive Report") mapped.push({ title, content: sections.executiveReport });
    else if (title === "One-Page Summary") mapped.push({ title, content: sections.onePageSummary });
    else if (title === "Deck Outline") mapped.push({ title, content: sections.deckOutline });
    else if (title === "Sources Used" && include.sources) mapped.push({ title, content: sections.sourcesUsed });
    else if (title === "Assumptions" && include.assumptions) mapped.push({ title, content: sections.assumptions });
    else if (title === "Open Questions" && include.openQuestions) mapped.push({ title, content: sections.openQuestions });
    else if (title === "Human Confirmations" && include.confirmations) mapped.push({ title, content: sections.humanConfirmations });
    else if (title === "Confidence Summary" && include.confidence) mapped.push({ title, content: sections.confidenceSummary });
    else if (title === "Recommended Next Actions") mapped.push({ title, content: sections.recommendedNextActions });
    else if (title === "Executive Summary") mapped.push({ title, content: sections.onePageSummary });
    else if (title === "Recommendations") mapped.push({ title, content: sections.executiveReport });
    else if (title === "Next Actions") mapped.push({ title, content: sections.recommendedNextActions });
    else if (title === "Investment Thesis") mapped.push({ title, content: sections.executiveReport });
    else if (title === "Opportunity Summary") mapped.push({ title, content: sections.onePageSummary });
    else if (title === "Risks") mapped.push({ title, content: sections.openQuestions });
    else if (title === "Evidence") mapped.push({ title, content: sections.sourcesUsed });
    else if (title === "Export Metadata" && include.metadata) mapped.push({ title, content: sections.exportMetadata });
  }

  return mapped;
}

function renderMarkdown(renderedSections: RenderedSection[], params?: BuildDeliverableExportParams): string {
  const title = params?.engagementTitle ? `# ${params.engagementTitle} — Deliverable Export` : "# Engagement Deliverable";
  const lines = [
    title,
    "",
    "> **Status: Needs Human Review** — Verify all facts, estimates, and recommendations before client delivery.",
    "",
  ];
  for (const section of renderedSections) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  lines.push("*Generated by FullSendOS. AI-generated work product requires human review before client delivery.*");
  return lines.join("\n");
}

function renderText(renderedSections: RenderedSection[], params?: BuildDeliverableExportParams): string {
  const title = params?.engagementTitle ? `${params.engagementTitle.toUpperCase()} — DELIVERABLE EXPORT` : "ENGAGEMENT DELIVERABLE";
  const lines = [
    title,
    "=".repeat(Math.min(title.length, 60)),
    "",
    "STATUS: NEEDS HUMAN REVIEW",
    "Verify all facts, estimates, and recommendations before client delivery.",
    "",
  ];
  for (const section of renderedSections) {
    lines.push(section.title.toUpperCase());
    lines.push("-".repeat(section.title.length));
    lines.push(section.content);
    lines.push("");
  }
  lines.push("---");
  lines.push("Generated by FullSendOS. AI-generated work product requires human review before client delivery.");
  return lines.join("\n");
}

function renderHtml(renderedSections: RenderedSection[], params: BuildDeliverableExportParams): string {
  const generatedDate = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const sectionsHtml = renderedSections
    .map((section) => `
      <section class="card">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="content">${section.content.split("\n").map((line) => line.trim() ? `<p>${escapeHtml(line)}</p>` : "").join("")}</div>
      </section>
    `)
    .join("\n");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>Engagement Deliverable Export</title>",
    "<style>",
    "body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#0f172a;line-height:1.6}",
    "main{max-width:900px;margin:0 auto;padding:32px 24px}",
    ".header{border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:24px}",
    ".meta{color:#475569;font-size:13px;margin-top:8px}",
    ".review-notice{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:20px;color:#92400e;font-size:13px;font-weight:600}",
    ".card{background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}",
    "h1{margin:0 0 8px 0;font-size:26px;font-weight:700}",
    "h2{margin:0 0 14px 0;font-size:17px;font-weight:600;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em}",
    ".content p{margin:0 0 10px 0;font-size:14px;color:#1e293b}",
    ".content p:last-child{margin-bottom:0}",
    "footer{border-top:1px solid #cbd5e1;margin-top:28px;padding-top:16px;color:#64748b;font-size:11px}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    '<header class="header">',
    `<h1>${escapeHtml(params.template.brandName)} Deliverable</h1>`,
    `<div class="meta">Engagement: ${escapeHtml(params.engagementTitle)} | Generated: ${escapeHtml(generatedDate)} | Template: ${escapeHtml(params.template.name)}</div>`,
    "</header>",
    '<div class="review-notice">&#9888; Status: Needs Human Review — Verify all facts, estimates, and recommendations before client delivery.</div>',
    sectionsHtml,
    `<footer>Generated by FullSendOS — AI-generated work product requires human review before client delivery. Export metadata is included per template settings. Safety filters applied by FullSendOS.</footer>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function renderJson(renderedSections: RenderedSection[]): string {
  return JSON.stringify(
    {
      sections: renderedSections,
    },
    null,
    2,
  );
}

export function contentTypeFor(format: DeliverableExportFormat): string {
  if (format === "markdown") return "text/markdown; charset=utf-8";
  if (format === "html") return "text/html; charset=utf-8";
  if (format === "json") return "application/json; charset=utf-8";
  if (format === "pdf") return "application/pdf";
  return "text/plain; charset=utf-8";
}

export function extensionFor(format: DeliverableExportFormat): string {
  if (format === "markdown") return "md";
  if (format === "html") return "html";
  if (format === "json") return "json";
  if (format === "pdf") return "pdf";
  return "txt";
}

export function buildSafeExportFilename(input: {
  engagementTitle?: string;
  clientName?: string;
  format: DeliverableExportFormat;
  generatedAtIso: string;
}): string {
  const base = slugify(input.clientName || input.engagementTitle || "engagement");
  const date = input.generatedAtIso.slice(0, 10);
  const root = `${base || "engagement"}-deliverable-${input.format}-${date}`;
  const trimmed = root.slice(0, 90).replace(/-+$/g, "");
  return `${trimmed}.${extensionFor(input.format)}`;
}

function renderContent(
  format: DeliverableExportFormat,
  renderedSections: RenderedSection[],
  params: BuildDeliverableExportParams,
): string {
  if (format === "markdown") return renderMarkdown(renderedSections, params);
  if (format === "html") return renderHtml(renderedSections, params);
  if (format === "json") return renderJson(renderedSections);
  return renderText(renderedSections, params);
}

export async function buildDeliverableExport(params: BuildDeliverableExportParams): Promise<DeliverableExport> {
  const generatedAt = nowIso();
  const sections = buildSections(params);
  const renderedSections = mapTemplateSections(params.template, sections);
  const isPdf = params.format === "pdf";

  const textContent = isPdf ? "" : renderContent(params.format, renderedSections, params);
  const pdfBuffer = isPdf
    ? await renderDeliverablePdf({
      title: `${params.engagementTitle} Deliverable Export`,
      engagementTitle: params.engagementTitle,
      clientName: params.clientName,
      generatedAt,
      templateName: params.template.name,
      sections: renderedSections,
      exportMetadata: sections.exportMetadata,
    })
    : null;

  const content = isPdf ? (pdfBuffer?.toString("base64") || "") : textContent;
  const byteSize = isPdf ? (pdfBuffer?.byteLength || 0) : Buffer.byteLength(textContent, "utf8");
  const checksum = createHash("sha256").update(content).digest("hex");
  const exportId = `exp-${randomBytes(10).toString("hex")}`;

  const evidenceSummary = params.detail.deliverables?.evidenceSummary;
  const evidenceReferences = Array.isArray(params.detail.deliverables?.evidenceReferences)
    ? params.detail.deliverables?.evidenceReferences
    : [];

  const includedSections = renderedSections.map((section) => section.title);

  return DeliverableExportSchema.parse({
    id: exportId,
    engagementId: params.engagementId,
    clientId: params.clientId,
    format: params.format,
    templateId: params.template.id,
    templateName: params.template.name,
    templateVersion: params.template.version,
    filename: buildSafeExportFilename({
      engagementTitle: params.engagementTitle,
      clientName: params.clientName,
      format: params.format,
      generatedAtIso: generatedAt,
    }),
    title: `${params.engagementTitle} Deliverable Export`,
    status: "created",
    createdAt: generatedAt,
    generatedAt,
    sourceWorkProductId: params.sourceWorkProductId,
    contentType: contentTypeFor(params.format),
    contentEncoding: isPdf ? "base64" : "utf8",
    isBinary: isPdf,
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
      confidenceSummary: params.template.includeConfidenceSummary ? evidenceSummary?.confidenceSummary : undefined,
      limitations: [
        "No raw provider payloads are included.",
        "No private prompts are included.",
        "No full extracted document text is included.",
        "No storage paths or local file paths are included.",
      ],
      binaryContent: isPdf
        ? {
          encoding: "base64",
          mediaType: "application/pdf",
          inlineContentExcluded: true,
        }
        : undefined,
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
