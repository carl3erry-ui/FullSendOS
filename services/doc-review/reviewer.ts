/**
 * FullSendOS Self-Documentation Review System
 * Deterministic documentation reviewer.
 *
 * Produces a structured report of documentation findings.
 * Does NOT automatically rewrite docs.
 * Human approval is required for all recommended documentation changes.
 * No live AI calls. No secrets. No runtime data.
 */

import type { DocumentationFinding, DocumentationReviewReport } from "./types";
import {
  DOC_INVENTORY,
  IMPLEMENTATION_INVENTORY,
  KNOWN_DEFERRED_DOCS,
  UPCOMING_EPICS,
  IMPLEMENTED_FEATURES,
} from "./inventory";

const GUARDRAIL =
  "This report recommends documentation changes. The self-documentation review system DOES NOT automatically rewrite governance documents. Human approval is required before committing any recommended documentation changes.";

let findingCounter = 0;
function nextId(type: string): string {
  findingCounter += 1;
  return `DOC-${type.toUpperCase().slice(0, 4)}-${String(findingCounter).padStart(3, "0")}`;
}

export function runDocumentationReview(options: { branch?: string } = {}): DocumentationReviewReport {
  findingCounter = 0;
  const generatedAt = new Date().toISOString();
  const branch = options.branch || "unknown";
  const findings: DocumentationFinding[] = [];

  // --- Check for deferred docs ---
  for (const deferredDoc of KNOWN_DEFERRED_DOCS) {
    const exists = DOC_INVENTORY.some((doc) => doc.path.endsWith(deferredDoc));
    if (!exists) {
      findings.push({
        id: nextId("deferred"),
        severity: "warning",
        type: "deferred-doc-needed",
        title: `Deferred doc not yet created: ${deferredDoc}`,
        description: `The documentation file '${deferredDoc}' was deferred during a previous implementation slice and has not been created.`,
        evidence: `Not found in doc inventory. Deferred from consulting-deliverable-quality-polish implementation.`,
        recommendedAction: `Create docs/${deferredDoc} documenting the relevant model/audit/results.`,
        relatedFiles: ["services/deliverable-readiness.ts", "services/deliverable-export-service.ts"],
        humanApprovalRequired: true,
      });
    }
  }

  // --- Check for high-risk docs that may be stale ---
  for (const doc of DOC_INVENTORY) {
    if (doc.riskLevel === "high" && doc.category !== "verification") {
      findings.push({
        id: nextId("stale"),
        severity: "warning",
        type: "stale-doc",
        title: `High-risk doc may need review: ${doc.path}`,
        description: doc.notes,
        evidence: `Risk level: high. Category: ${doc.category}. Topics: ${doc.topics.join(", ")}.`,
        recommendedAction: `Review ${doc.path} against the current implementation. Update stale sections. Submit changes for human approval.`,
        relatedFiles: [doc.path, ...doc.relatedAreas],
        humanApprovalRequired: true,
      });
    }
  }

  // --- Detect implementation areas with no related docs ---
  const undocumented = IMPLEMENTATION_INVENTORY.filter(
    (item) =>
      item.relatedDocs.length === 0 &&
      item.kind !== "test" &&
      item.notes.toLowerCase().includes("deferred") ||
      (item.relatedDocs.length === 0 && item.kind === "component" && item.topics.length > 0)
  );

  for (const item of undocumented) {
    findings.push({
      id: nextId("impl"),
      severity: "info",
      type: "implementation-undocumented",
      title: `Implementation area has no related doc: ${item.path}`,
      description: item.notes,
      evidence: `Topics: ${item.topics.join(", ")}. No related documentation files listed.`,
      recommendedAction: `Create documentation for ${item.path}. Focus on: ${item.topics.slice(0, 3).join(", ")}.`,
      relatedFiles: [item.path],
      humanApprovalRequired: true,
    });
  }

  // --- Check for implemented features that lack keyword coverage in docs ---
  const docTopicsFlat = DOC_INVENTORY.flatMap((doc) => doc.topics.map((t) => t.toLowerCase()));
  const implTopicsFlat = IMPLEMENTATION_INVENTORY.flatMap((item) =>
    item.topics.map((t) => t.toLowerCase())
  );

  for (const feature of IMPLEMENTED_FEATURES) {
    const featureLower = feature.toLowerCase();
    const inDocs = docTopicsFlat.some((topic) => topic.includes(featureLower) || featureLower.includes(topic));
    const inImpl = implTopicsFlat.some((topic) => topic.includes(featureLower) || featureLower.includes(topic));

    if (inImpl && !inDocs) {
      findings.push({
        id: nextId("feat"),
        severity: "info",
        type: "implementation-undocumented",
        title: `Implemented feature lacks documentation coverage: "${feature}"`,
        description: `The feature "${feature}" appears in the implementation inventory but no doc with this topic was found.`,
        evidence: `Feature found in implementation topics but not in documentation topics.`,
        recommendedAction: `Create or update a doc that covers "${feature}". Submit for human approval.`,
        relatedFiles: IMPLEMENTATION_INVENTORY.filter((i) =>
          i.topics.some((t) => t.toLowerCase().includes(featureLower))
        ).map((i) => i.path),
        humanApprovalRequired: true,
      });
    }
  }

  // --- Check for potential decision records needed ---
  const decisionTriggers = [
    { feature: "deliverable readiness", doc: "docs/DECISIONS.md", reason: "New readiness model introduced" },
    { feature: "self-documentation", doc: "docs/DECISIONS.md", reason: "Self-documentation review system architecture decision" },
  ];
  for (const trigger of decisionTriggers) {
    findings.push({
      id: nextId("decision"),
      severity: "info",
      type: "decision-record-needed",
      title: `Decision record may be needed for: ${trigger.feature}`,
      description: `The feature "${trigger.feature}" represents an architectural or process decision that may benefit from an ADR entry.`,
      evidence: `Trigger: ${trigger.reason}.`,
      recommendedAction: `Consider adding an entry to ${trigger.doc} for "${trigger.feature}".`,
      relatedFiles: [trigger.doc],
      humanApprovalRequired: true,
    });
  }

  // --- Check upcoming epics for documentation gaps ---
  for (const epic of UPCOMING_EPICS) {
    const hasEpicDoc = DOC_INVENTORY.some(
      (doc) => doc.topics.some((t) => t.toLowerCase().includes(epic.toLowerCase().split(" ")[0]))
    );
    if (!hasEpicDoc) {
      findings.push({
        id: nextId("epic"),
        severity: "info",
        type: "missing-doc",
        title: `Upcoming epic lacks a planning doc: ${epic}`,
        description: `The upcoming epic "${epic}" does not have a dedicated planning or spec document in docs/.`,
        evidence: `Epic listed in UPCOMING_EPICS registry. No matching doc found in inventory.`,
        recommendedAction: `Create docs/${epic.replace(/\s+/g, "-").toUpperCase()}-PLAN.md or EPIC.md when planning begins.`,
        relatedFiles: ["docs/ROADMAP.md"],
        humanApprovalRequired: true,
      });
    }
  }

  // --- Build recommended doc updates ---
  const recommendedDocUpdates = [
    {
      targetPath: "docs/CONSULTING_DELIVERABLE_QUALITY_AUDIT.md",
      reason: "Deferred during consulting-deliverable-quality-polish slice.",
      suggestedAction: "Document what was audited, what was clunky, and the audit recommendations.",
      humanApprovalRequired: true as const,
    },
    {
      targetPath: "docs/CONSULTING_DELIVERABLE_STANDARD.md",
      reason: "Standard defined in code (deliverable-readiness.ts) but not in a governance doc.",
      suggestedAction: "Create a markdown spec of the deliverable readiness model, human review checklist, and client-readiness levels.",
      humanApprovalRequired: true as const,
    },
    {
      targetPath: "docs/CONSULTING_DELIVERABLE_QUALITY_RESULTS.md",
      reason: "Results of the quality polish slice were not documented in a results file.",
      suggestedAction: "Document what changed, what was deferred, manual preview results, and known limitations.",
      humanApprovalRequired: true as const,
    },
    {
      targetPath: "docs/ROADMAP.md",
      reason: "Several shipped features (Executive OS UI, client onboarding, demo workspace, guided tour, deliverable quality) may not be reflected.",
      suggestedAction: "Review ROADMAP.md and update status of shipped items. Mark completed epics as done.",
      humanApprovalRequired: true as const,
    },
    {
      targetPath: "ARCHITECTURE.md",
      reason: "Root-level and docs/ARCHITECTURE.md may be outdated or conflicting.",
      suggestedAction: "Consolidate to one architecture doc and update for client baseline, demo workspace, deliverable readiness.",
      humanApprovalRequired: true as const,
    },
    {
      targetPath: "docs/SELF_DOCUMENTATION_REVIEW_SYSTEM.md",
      reason: "The self-documentation review system itself needs governance documentation.",
      suggestedAction: "Already being created in this PR.",
      humanApprovalRequired: true as const,
    },
  ];

  const deferredItems = [
    "DEMO_WORKSPACE_SPEC.md — full fictional demo workspace spec",
    "GUIDED_TOUR_SPEC.md — guided tour content and UX spec",
    "DELIVERABLE_READINESS_MODEL.md — deliverable readiness lifecycle doc",
    "API reference docs for new routes (demo/seed, clients/[id]/baseline)",
    "Agent Collaboration Framework v1 planning doc",
    "Client Portal / External Access Layer planning doc",
    "Owner/Admin workspace split spec",
  ];

  const highCount = findings.filter((f) => f.severity === "high").length;
  const warnCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  const summary = [
    `Documentation review complete. Found ${findings.length} findings: ${highCount} high, ${warnCount} warning, ${infoCount} info.`,
    `${DOC_INVENTORY.length} documentation files inventoried.`,
    `${IMPLEMENTATION_INVENTORY.length} implementation areas inventoried.`,
    `${KNOWN_DEFERRED_DOCS.filter((d) => !DOC_INVENTORY.some((doc) => doc.path.endsWith(d))).length} deferred docs still missing.`,
    `${recommendedDocUpdates.length} documentation updates recommended for human review.`,
    `Human approval required before any recommended changes are committed.`,
  ].join(" ");

  return {
    generatedAt,
    branch,
    summary,
    docCount: DOC_INVENTORY.length,
    implementationAreaCount: IMPLEMENTATION_INVENTORY.length,
    findings,
    recommendedDocUpdates,
    deferredItems,
    humanApprovalRequired: true,
    guardrail: GUARDRAIL,
  };
}
