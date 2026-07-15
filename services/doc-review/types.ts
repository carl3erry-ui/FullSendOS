/**
 * FullSendOS Self-Documentation Review System
 * Types and schemas for documentation analysis.
 *
 * Safety: No secrets, no runtime data, no provider payloads.
 * Human approval is required before committing any doc changes recommended by this system.
 */

export type DocCategory =
  | "architecture"
  | "roadmap"
  | "project-context"
  | "vision"
  | "contributing"
  | "api"
  | "epic"
  | "slice"
  | "verification"
  | "audit"
  | "spec"
  | "results"
  | "generated"
  | "other";

export type FindingSeverity = "info" | "warning" | "high";

export type FindingType =
  | "stale-doc"
  | "missing-doc"
  | "implementation-undocumented"
  | "roadmap-status-mismatch"
  | "architecture-mismatch"
  | "deferred-doc-needed"
  | "decision-record-needed"
  | "duplicate-or-overlapping-doc"
  | "terminology-inconsistency";

export type DocInventoryItem = {
  path: string;
  title: string;
  category: DocCategory;
  topics: string[];
  statusMarkers: string[];
  relatedAreas: string[];
  riskLevel: "low" | "medium" | "high";
  notes: string;
};

export type ImplementationInventoryItem = {
  path: string;
  kind: "service" | "schema" | "api-route" | "component" | "script" | "test" | "other";
  topics: string[];
  relatedDocs: string[];
  notes: string;
};

export type DocumentationFinding = {
  id: string;
  severity: FindingSeverity;
  type: FindingType;
  title: string;
  description: string;
  evidence: string;
  recommendedAction: string;
  relatedFiles: string[];
  humanApprovalRequired: boolean;
};

export type DocumentationReviewReport = {
  generatedAt: string;
  branch: string;
  summary: string;
  docCount: number;
  implementationAreaCount: number;
  findings: DocumentationFinding[];
  recommendedDocUpdates: Array<{
    targetPath: string;
    reason: string;
    suggestedAction: string;
    humanApprovalRequired: true;
  }>;
  deferredItems: string[];
  humanApprovalRequired: boolean;
  guardrail: string;
};
