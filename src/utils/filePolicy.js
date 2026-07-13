const SUPPORTED_EXTENSIONS = new Set([
  // Documents
  "pdf", "docx", "txt", "md", "rtf",
  // Spreadsheets
  "xlsx", "csv",
  // Presentations
  "pptx",
  // Images
  "png", "jpg", "jpeg", "webp", "svg",
  // Archives
  "zip",
  // Accounting / export (metadata policy only)
  "qbo", "ofx", "iif", "json", "xml"
]);

const MIME_MAP = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  rtf: "application/rtf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  zip: "application/zip",
  qbo: "application/vnd.intuit.qbo",
  ofx: "application/x-ofx",
  iif: "text/plain",
  json: "application/json",
  xml: "application/xml"
};

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "dll", "bat", "cmd", "sh", "js", "ts", "jsx", "tsx",
  "html", "htm", "php", "py", "jar", "scr", "msi", "app", "dmg",
  "ps1", "vbs", "wsf", "reg", "inf", "lnk", "hta", "pif", "com",
  "rb", "pl", "lua", "swift", "kotlin", "go", "rs", "c", "cpp", "cs"
]);

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export function getExtension(filename) {
  const name = String(filename || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1);
}

export function validateFileType(originalFilename, sizeBytes = 0) {
  const ext = getExtension(originalFilename);

  if (!ext) {
    return { ok: false, reason: "File must have an extension." };
  }

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File type .${ext} is not permitted for security reasons.` };
  }

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File type .${ext} is not supported. Supported types: ${[...SUPPORTED_EXTENSIONS].join(", ")}.` };
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.` };
  }

  return { ok: true, extension: ext, mimeType: MIME_MAP[ext] || "application/octet-stream" };
}

export function sanitizeFilename(originalFilename) {
  const name = String(originalFilename || "unnamed").trim();
  // Replace path separators and dangerous characters
  return name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/^\./, "_")
    .replace(/[^\w\-. ]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200) || "unnamed";
}

export { SUPPORTED_EXTENSIONS, DANGEROUS_EXTENSIONS, MAX_FILE_SIZE_BYTES };
