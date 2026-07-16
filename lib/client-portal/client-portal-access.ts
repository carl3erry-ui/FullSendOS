/**
 * FullSendOS Client Portal Access Layer v1
 * Defines the access model and filtering helpers for client-safe visibility.
 *
 * FullSendOS has two sides:
 *   Owner/Admin Workspace = the kitchen
 *   Client Portal         = the dining room
 *
 * The Client Portal must NEVER expose:
 *   - internal agent traces
 *   - raw provider payloads
 *   - private reasoning or collaboration notes
 *   - unapproved internal drafts
 *   - admin-only controls
 *   - secrets or runtime data
 */

export type ClientPortalAccessLevel =
  | "none"
  | "status-only"
  | "deliverables-view"
  | "deliverables-download"
  | "full-client-preview";

export type ClientPortalVisibility = {
  clientId: string;
  engagementId?: string;
  accessLevel: ClientPortalAccessLevel;
  canViewStatus: boolean;
  canViewDataRoom: boolean;
  canUploadFiles: boolean;
  canViewDeliverables: boolean;
  canDownloadDeliverables: boolean;
  canViewReviewStatus: boolean;
  canSubmitFeedback: boolean;
  /** Always false in client portal — internal traces stay in Owner/Admin workspace. */
  canViewInternalTrace: false;
  /** Always false in client portal — agent notes are internal. */
  canViewAgentNotes: false;
  /** Always false in client portal — raw provider output is internal. */
  canViewRawProviderOutput: false;
};

/** Default v1 visibility — full-client-preview with enforced internal guards. */
export function getDefaultClientPortalVisibility(clientId: string, engagementId?: string): ClientPortalVisibility {
  return {
    clientId,
    engagementId,
    accessLevel: "full-client-preview",
    canViewStatus: true,
    canViewDataRoom: true,
    canUploadFiles: false, // Deferred to v2 — requires auth + cloud storage
    canViewDeliverables: true,
    canDownloadDeliverables: true,
    canViewReviewStatus: true,
    canSubmitFeedback: false, // UI placeholder only in v1
    canViewInternalTrace: false,
    canViewAgentNotes: false,
    canViewRawProviderOutput: false,
  };
}

/** Internal field names that must never appear in client-facing output. */
const INTERNAL_FIELD_NAMES = new Set([
  "audit",
  "rawOutput",
  "rawProviderResponse",
  "systemPrompt",
  "apiKey",
  "token",
  "secret",
  "diagnosticTrace",
  "debug",
  "stack",
  "storagePath",
  "textExtracted",
  "agentNotes",
  "internalTrace",
  "collaborationTrace",
  "helpRequests",
  "guardrailEvents",
  "providerPayload",
  "reasoning",
]);

/** Returns true if the field name is safe to expose in the client portal. */
export function isClientSafeField(fieldName: string): boolean {
  return !INTERNAL_FIELD_NAMES.has(fieldName) &&
    !/^(raw|internal|private|debug|trace|agent|provider|secret|token|api)/i.test(fieldName);
}

/** A client-safe engagement summary. Contains only status and display information. */
export type ClientSafeEngagement = {
  id: string;
  title: string;
  status: string;
  readableStatus: string;
  completedDepartments: number;
  totalDepartments: number;
  updatedAt?: string;
  hasDeliverables: boolean;
  deliverableReadiness: string;
};

/** A client-safe deliverable. Contains only review-appropriate output. */
export type ClientSafeDeliverable = {
  engagementId: string;
  title: string;
  readinessLabel: string;
  readinessDisclaimer: string;
  isClientApproved: boolean;
  hasExecutiveReport: boolean;
  hasOnePageSummary: boolean;
  hasDeckOutline: boolean;
  exportCount: number;
  lastUpdated?: string;
  safePreviewText?: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Not yet started",
  "in-progress": "In progress",
  "needs-review": "Ready for review",
  complete: "Complete",
  completed: "Complete",
  failed: "Processing issue",
  running: "AI Workforce working",
};

/** Filter an engagement summary to client-safe fields. */
export function filterClientSafeEngagement(engagement: {
  id: string;
  companyName?: string;
  objective?: string;
  status: string;
  completedDepartments: number;
  totalDepartments: number;
  updatedAt?: string;
  deliverables?: { executiveReport?: string; onePageSummary?: string; deckOutline?: unknown[] };
}): ClientSafeEngagement {
  const hasDeliverables = Boolean(
    engagement.deliverables?.executiveReport ||
    engagement.deliverables?.onePageSummary ||
    (Array.isArray(engagement.deliverables?.deckOutline) && (engagement.deliverables?.deckOutline as unknown[]).length > 0)
  );

  const status = engagement.status;
  const isReviewReady = status === "needs-review" || status === "complete" || status === "completed";

  return {
    id: engagement.id,
    title: engagement.companyName || engagement.objective || "Engagement",
    status: engagement.status,
    readableStatus: STATUS_LABELS[engagement.status] || engagement.status.replace(/-/g, " "),
    completedDepartments: engagement.completedDepartments,
    totalDepartments: engagement.totalDepartments,
    updatedAt: engagement.updatedAt,
    hasDeliverables,
    deliverableReadiness: isReviewReady && hasDeliverables ? "needs-human-review" : "internal-draft",
  };
}

/** Filter engagement detail to a client-safe deliverable summary. */
export function filterClientSafeDeliverable(input: {
  engagementId: string;
  engagementTitle: string;
  status: string;
  deliverables?: {
    executiveReport?: string;
    onePageSummary?: string;
    deckOutline?: unknown[];
  };
  exportCount?: number;
  updatedAt?: string;
}): ClientSafeDeliverable {
  const hasExec = Boolean(input.deliverables?.executiveReport);
  const hasSummary = Boolean(input.deliverables?.onePageSummary);
  const hasDeck = Array.isArray(input.deliverables?.deckOutline) && (input.deliverables?.deckOutline as unknown[]).length > 0;

  const isReviewReady = input.status === "needs-review" || input.status === "complete" || input.status === "completed";
  const readiness = isReviewReady ? "needs-human-review" : "internal-draft";

  const READINESS_LABELS: Record<string, string> = {
    "internal-draft": "Internal Draft",
    "needs-human-review": "Needs Human Review",
    "client-ready-draft": "Client-Ready Draft",
    "approved-for-client": "Approved for Client",
  };

  const READINESS_DISCLAIMERS: Record<string, string> = {
    "internal-draft": "This engagement is still in progress. Deliverables are not yet available for client review.",
    "needs-human-review": "Deliverables are ready for internal review. Human approval is required before sharing with the client.",
    "client-ready-draft": "These deliverables have been reviewed. Please confirm before sending to the client.",
    "approved-for-client": "These deliverables have been approved for client delivery.",
  };

  // Safe preview: only the first ~200 chars of the one-page summary if review-ready
  const safePreviewText =
    isReviewReady && hasSummary
      ? (input.deliverables?.onePageSummary || "").slice(0, 200) + "..."
      : undefined;

  return {
    engagementId: input.engagementId,
    title: `${input.engagementTitle} — Executive Work Product`,
    readinessLabel: READINESS_LABELS[readiness],
    readinessDisclaimer: READINESS_DISCLAIMERS[readiness],
    isClientApproved: (readiness as string) === "approved-for-client",
    hasExecutiveReport: hasExec,
    hasOnePageSummary: hasSummary,
    hasDeckOutline: hasDeck,
    exportCount: input.exportCount ?? 0,
    lastUpdated: input.updatedAt,
    safePreviewText,
  };
}
