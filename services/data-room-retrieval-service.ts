import { AgentExecutorError } from "../agents/errors";
import { AgentPermissions } from "../agents/permissions";
import { getFileReference } from "./client-data-room-store";
import { listDataRoomDocuments } from "./data-room-document-store";
import {
  DataRoomRetrievalRequest,
  DataRoomRetrievalRequestSchema,
  DataRoomRetrievalResult,
  DataRoomRetrievalResultSchema,
  DataRoomSourceReference,
  DataRoomExcerpt,
} from "../schemas/data-room-retrieval";
import { createDataRoomRetrievalAuditEntry } from "./data-room-retrieval-audit-store";

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function containsKeyword(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function makeCitationLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  const suffix = index >= 26 ? `${Math.floor(index / 26)}` : "";
  return `Source ${letter}${suffix}`;
}

function safeExcerptFromText(params: {
  text: string;
  query: string;
  keywords: string[];
  maxCharacters: number;
}): { text: string; basis: DataRoomExcerpt["basis"] } {
  const sourceText = normalizeText(params.text);
  if (!sourceText) {
    return { text: "", basis: "heuristic" };
  }

  const maxChars = Math.max(40, params.maxCharacters);
  const query = params.query.trim().toLowerCase();
  const lower = sourceText.toLowerCase();

  let index = -1;
  let basis: DataRoomExcerpt["basis"] = "heuristic";

  if (query) {
    index = lower.indexOf(query);
    if (index >= 0) {
      basis = "keyword";
    }
  }

  if (index < 0 && params.keywords.length > 0) {
    for (const keyword of params.keywords) {
      const keywordIndex = lower.indexOf(keyword.toLowerCase());
      if (keywordIndex >= 0) {
        index = keywordIndex;
        basis = "keyword";
        break;
      }
    }
  }

  let excerpt = "";
  if (index >= 0) {
    const start = Math.max(0, index - Math.floor(maxChars / 3));
    const end = Math.min(sourceText.length, start + maxChars);
    excerpt = sourceText.slice(start, end);
  } else {
    excerpt = sourceText.slice(0, maxChars);
    basis = "preview";
  }

  excerpt = normalizeText(excerpt);
  if (!excerpt) {
    return { text: "", basis };
  }

  // Never return the full stored internal text by default.
  if (excerpt === sourceText && sourceText.length > 30) {
    const clipped = sourceText.slice(0, Math.max(30, Math.floor(sourceText.length * 0.7)));
    excerpt = `${normalizeText(clipped)}...`;
  }

  return { text: excerpt, basis };
}

function scoreConfidence(params: {
  hasKeywordMatch: boolean;
  hasSummary: boolean;
  hasPreview: boolean;
}): number {
  let score = 0.55;
  if (params.hasKeywordMatch) score += 0.2;
  if (params.hasSummary) score += 0.15;
  if (params.hasPreview) score += 0.1;
  return Math.min(0.98, score);
}

export async function retrieveDataRoomContext(
  requestInput: DataRoomRetrievalRequest & { agentPermissions: string[] }
): Promise<DataRoomRetrievalResult> {
  const request = DataRoomRetrievalRequestSchema.parse(requestInput);

  if (!requestInput.agentPermissions.includes(AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT)) {
    throw new AgentExecutorError({
      code: "permission_denied",
      message: `Agent \"${request.agentId}\" does not have retrieval permission.`,
      agentId: request.agentId,
      taskId: request.taskId,
    });
  }

  if (request.allowSensitive) {
    throw new AgentExecutorError({
      code: "permission_denied",
      message: "Sensitive retrieval requires future approval-gated implementation.",
      agentId: request.agentId,
      taskId: request.taskId,
    });
  }

  const documents = await listDataRoomDocuments(request.clientId);
  const keywords = request.keywords.length > 0
    ? request.keywords
    : request.query
        .split(/[^a-zA-Z0-9]+/)
        .map((kw) => kw.trim())
        .filter((kw) => kw.length >= 3)
        .slice(0, 8);

  const sources: DataRoomSourceReference[] = [];
  const excerpts: DataRoomExcerpt[] = [];
  const summaries: DataRoomRetrievalResult["summaries"] = [];
  const skippedDocuments: DataRoomRetrievalResult["skippedDocuments"] = [];
  const warnings: string[] = [];

  let totalCharacters = 0;
  let documentIndex = 0;

  for (const document of documents) {
    if (sources.length >= request.maxDocuments) {
      break;
    }

    if (document.clientId !== request.clientId) {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "wrong_client",
      });
      continue;
    }

    if (request.engagementId) {
      if (document.engagementId && document.engagementId !== request.engagementId) {
        skippedDocuments.push({
          documentId: document.id,
          fileId: document.fileId,
          reason: "wrong_engagement",
        });
        continue;
      }
    }

    if (request.fileIds.length > 0 && !request.fileIds.includes(document.fileId)) {
      continue;
    }

    if (request.folderIds.length > 0 && !request.folderIds.includes(document.folderId)) {
      continue;
    }

    if (
      request.documentTypes.length > 0 &&
      !request.documentTypes.includes(document.detectedDocumentType)
    ) {
      continue;
    }

    if (!document.approvedForAgentUse) {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "not_approved_for_agent_use",
      });
      continue;
    }

    if (document.sensitive) {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "sensitive_document",
      });
      continue;
    }

    if (document.processingStatus !== "completed") {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "processing_not_completed",
      });
      continue;
    }

    const fileReference = await getFileReference(request.clientId, document.fileId);
    if (!fileReference) {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "file_archived_or_missing",
      });
      continue;
    }

    if (request.engagementId && !fileReference.engagementIds.includes(request.engagementId)) {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "file_not_linked_to_engagement",
      });
      continue;
    }

    const sourceId = `${document.id}:${document.fileId}`;
    const citationLabel = makeCitationLabel(documentIndex);
    documentIndex += 1;

    const source: DataRoomSourceReference = {
      sourceId,
      documentId: document.id,
      fileId: document.fileId,
      clientId: document.clientId,
      engagementId: request.engagementId,
      displayName: document.displayName,
      folderId: document.folderId,
      detectedDocumentType: document.detectedDocumentType,
      processingStatus: document.processingStatus,
      approvedForAgentUse: document.approvedForAgentUse,
      sensitive: document.sensitive,
      citationLabel,
    };

    let excerptCountForDocument = 0;

    const candidateText =
      document.textExtracted && document.textExtracted.length > 0
        ? document.textExtracted
        : document.textPreview;

    const shouldUseDocument =
      !request.query ||
      containsKeyword(document.summary, keywords) ||
      containsKeyword(document.textPreview, keywords) ||
      containsKeyword(candidateText, keywords);

    if (!shouldUseDocument) {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "no_query_match",
      });
      continue;
    }

    const excerptPlan = safeExcerptFromText({
      text: candidateText,
      query: request.query,
      keywords,
      maxCharacters: request.maxCharacters,
    });

    if (!excerptPlan.text) {
      skippedDocuments.push({
        documentId: document.id,
        fileId: document.fileId,
        reason: "no_excerpt_available",
      });
      continue;
    }

    if (excerpts.length < request.maxExcerpts && totalCharacters < request.maxTotalCharacters) {
      const allowed = request.maxTotalCharacters - totalCharacters;
      const safeText = excerptPlan.text.slice(0, Math.max(0, Math.min(allowed, request.maxCharacters)));
      const normalized = normalizeText(safeText);

      if (normalized.length > 0) {
        excerpts.push({
          documentId: document.id,
          fileId: document.fileId,
          citationLabel,
          text: normalized,
          characterCount: normalized.length,
          basis: excerptPlan.basis,
          confidence: scoreConfidence({
            hasKeywordMatch: excerptPlan.basis === "keyword",
            hasSummary: document.summary.length > 0,
            hasPreview: document.textPreview.length > 0,
          }),
        });
        totalCharacters += normalized.length;
        excerptCountForDocument += 1;
      }
    }

    if (request.includeSummaries && document.summary) {
      summaries.push({ sourceId, summary: document.summary.slice(0, 240) });
    }

    if (excerptCountForDocument === 0 && request.includePreviews && document.textPreview) {
      const previewText = normalizeText(document.textPreview.slice(0, request.maxCharacters));
      if (previewText && excerpts.length < request.maxExcerpts) {
        excerpts.push({
          documentId: document.id,
          fileId: document.fileId,
          citationLabel,
          text: previewText,
          characterCount: previewText.length,
          basis: "preview",
          confidence: scoreConfidence({
            hasKeywordMatch: false,
            hasSummary: document.summary.length > 0,
            hasPreview: true,
          }),
        });
        totalCharacters += previewText.length;
      }
    }

    sources.push(source);
  }

  if (sources.length === 0) {
    warnings.push("no_eligible_documents_found");
  }

  const audit = await createDataRoomRetrievalAuditEntry({
    clientId: request.clientId,
    engagementId: request.engagementId,
    agentId: request.agentId,
    taskId: request.taskId,
    query: request.query.slice(0, 300),
    documentIds: sources.map((s) => s.documentId),
    fileIds: sources.map((s) => s.fileId),
    skippedReasons: skippedDocuments.map((s) => s.reason),
    totalCharacters,
  });

  const confidence =
    excerpts.length === 0
      ? 0
      : excerpts.reduce((sum, excerpt) => sum + excerpt.confidence, 0) / excerpts.length;

  return DataRoomRetrievalResultSchema.parse({
    sources,
    excerpts,
    summaries,
    skippedDocuments,
    warnings,
    retrievalAuditId: audit.id,
    totalCharacters,
    confidence,
  });
}
