import path from "node:path";

type ParseStatus =
  | "completed"
  | "failed"
  | "unsupported"
  | "skipped";

export type ParsedDocumentResult = {
  status: ParseStatus;
  textExtracted?: string;
  textPreview: string;
  textLength: number;
  summary: string;
  keywords: string[];
  detectedDocumentType: string;
  confidence: number;
  warnings: string[];
  metadata?: {
    rowCount?: number;
    columnCount?: number;
  };
};

const MAX_PARSE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const MAX_PREVIEW_CHARS = 1_200;
const MAX_SUMMARY_CHARS = 320;
const MAX_KEYWORDS = 12;
const MAX_JSON_KEYS = 2_000;
const MAX_JSON_DEPTH = 8;

const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "csv", "json", "xml"]);

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function sanitizeText(input: string): string {
  // Keep printable chars, tabs, CR, LF and normalize other controls to spaces.
  return input
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toUtf8Text(buffer: Buffer): string {
  const text = buffer.toString("utf8");
  return sanitizeText(text);
}

function truncate(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, maxChars)}...`;
}

function buildSummary(text: string): string {
  if (!text) return "";
  const sentence = text.split(/[.!?]\s+/)[0]?.trim() || text;
  return truncate(sentence, MAX_SUMMARY_CHARS);
}

function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS)
    .map(([token]) => token);
}

function clampTextForStorage(text: string): string {
  return truncate(text, MAX_TEXT_CHARS);
}

function checkJsonDepthAndKeys(value: unknown, state: { keys: number; depth: number }, level = 0): void {
  if (level > MAX_JSON_DEPTH) {
    throw new Error("JSON exceeds maximum supported depth");
  }

  state.depth = Math.max(state.depth, level);

  if (Array.isArray(value)) {
    for (const item of value) {
      checkJsonDepthAndKeys(item, state, level + 1);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  state.keys += entries.length;
  if (state.keys > MAX_JSON_KEYS) {
    throw new Error("JSON contains too many keys");
  }

  for (const [, nested] of entries) {
    checkJsonDepthAndKeys(nested, state, level + 1);
  }
}

function parseCsv(text: string): ParsedDocumentResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rowCount = lines.length;
  const columnCount = lines.length > 0 ? lines[0].split(",").length : 0;

  const safeText = clampTextForStorage(text);
  const preview = truncate(safeText, MAX_PREVIEW_CHARS);

  return {
    status: "completed",
    textExtracted: safeText,
    textPreview: preview,
    textLength: safeText.length,
    summary: `CSV parsed with ${rowCount} row(s) and ${columnCount} column(s).`,
    keywords: extractKeywords(safeText),
    detectedDocumentType: "csv",
    confidence: 0.95,
    warnings: [],
    metadata: { rowCount, columnCount },
  };
}

function parseJson(text: string): ParsedDocumentResult {
  const parsed = JSON.parse(text);
  const state = { keys: 0, depth: 0 };
  checkJsonDepthAndKeys(parsed, state);

  const normalized = JSON.stringify(parsed, null, 2);
  const safeText = clampTextForStorage(sanitizeText(normalized));
  const preview = truncate(safeText, MAX_PREVIEW_CHARS);

  return {
    status: "completed",
    textExtracted: safeText,
    textPreview: preview,
    textLength: safeText.length,
    summary: `JSON parsed successfully (${state.keys} key(s), depth ${state.depth}).`,
    keywords: extractKeywords(safeText),
    detectedDocumentType: "json",
    confidence: 0.92,
    warnings: [],
  };
}

function parseXml(text: string): ParsedDocumentResult {
  const hasAngleBrackets = /<[^>]+>/.test(text);
  if (!hasAngleBrackets) {
    throw new Error("Invalid XML-like content");
  }

  const stripped = sanitizeText(
    text
      .replace(/<\?xml[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );

  const safeText = clampTextForStorage(stripped || text);
  const preview = truncate(safeText, MAX_PREVIEW_CHARS);

  return {
    status: "completed",
    textExtracted: safeText,
    textPreview: preview,
    textLength: safeText.length,
    summary: buildSummary(safeText),
    keywords: extractKeywords(safeText),
    detectedDocumentType: "xml",
    confidence: 0.86,
    warnings: [],
  };
}

function parsePlainText(text: string, detectedDocumentType: string): ParsedDocumentResult {
  const safeText = clampTextForStorage(text);
  const preview = truncate(safeText, MAX_PREVIEW_CHARS);

  return {
    status: "completed",
    textExtracted: safeText,
    textPreview: preview,
    textLength: safeText.length,
    summary: buildSummary(safeText),
    keywords: extractKeywords(safeText),
    detectedDocumentType,
    confidence: 0.9,
    warnings: [],
  };
}

export function isParseableExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extension.toLowerCase());
}

export function inferExtension(filename: string, mimeType?: string): string {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  if (ext) return ext;

  const mimeToExt: Record<string, string> = {
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "application/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
  };

  return mimeType ? mimeToExt[mimeType] || "" : "";
}

export function parseDataRoomDocument(params: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): ParsedDocumentResult {
  const warnings: string[] = [];
  const extension = inferExtension(params.filename, params.mimeType).toLowerCase();

  if (!extension || !isParseableExtension(extension)) {
    return {
      status: "unsupported",
      textPreview: "",
      textLength: 0,
      summary: "File type is not supported for parsing in this slice.",
      keywords: [],
      detectedDocumentType: extension || "unknown",
      confidence: 0,
      warnings: ["unsupported_file_type"],
    };
  }

  if (params.buffer.length > MAX_PARSE_BYTES) {
    return {
      status: "skipped",
      textPreview: "",
      textLength: 0,
      summary: "File exceeds parsing size limit for this slice.",
      keywords: [],
      detectedDocumentType: extension,
      confidence: 0,
      warnings: ["file_too_large_for_parser"],
    };
  }

  const text = toUtf8Text(params.buffer);
  if (!text) {
    return {
      status: "failed",
      textPreview: "",
      textLength: 0,
      summary: "Unable to extract text from file content.",
      keywords: [],
      detectedDocumentType: extension,
      confidence: 0,
      warnings: ["no_text_extracted"],
    };
  }

  try {
    if (extension === "csv") {
      return parseCsv(text);
    }

    if (extension === "json") {
      return parseJson(text);
    }

    if (extension === "xml") {
      return parseXml(text);
    }

    if (extension === "md") {
      const markdownNormalized = sanitizeText(text.replace(/[#*_`>\-]+/g, " "));
      return parsePlainText(markdownNormalized, "markdown");
    }

    return parsePlainText(text, "text");
  } catch {
    warnings.push("parser_failed_safe_fallback_used");
    return {
      status: "failed",
      textPreview: truncate(text, MAX_PREVIEW_CHARS),
      textLength: Math.min(text.length, MAX_TEXT_CHARS),
      summary: "Parser failed to process this file safely.",
      keywords: extractKeywords(text),
      detectedDocumentType: extension,
      confidence: 0,
      warnings,
    };
  }
}
