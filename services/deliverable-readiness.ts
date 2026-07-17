/**
 * Consulting deliverable readiness labels and human review checklist.
 * Every AI-generated deliverable defaults to "Needs Human Review" status.
 */

export type DeliverableReadiness =
  | "internal-draft"
  | "needs-human-review"
  | "client-ready-draft"
  | "approved-for-client";

export const READINESS_LABELS: Record<DeliverableReadiness, string> = {
  "internal-draft": "Internal Draft",
  "needs-human-review": "Needs Human Review",
  "client-ready-draft": "Client-Ready Draft",
  "approved-for-client": "Approved for Client",
};

export const READINESS_DISCLAIMER: Record<DeliverableReadiness, string> = {
  "internal-draft":
    "This is an internal working draft. Do not share with the client before review.",
  "needs-human-review":
    "AI-generated work product. Verify all facts, estimates, and recommendations before client delivery.",
  "client-ready-draft":
    "Reviewed by a human. Confirm accuracy and brand voice before final approval.",
  "approved-for-client":
    "Approved for client delivery. Keep a record of who approved and when.",
};

export const HUMAN_REVIEW_CHECKLIST = [
  "Verify all factual claims and market statistics.",
  "Confirm all financial estimates are validated or appropriately caveated.",
  "Review assumptions for accuracy and client context.",
  "Check legal, compliance, and liability sensitivity.",
  "Confirm brand voice, tone, and messaging alignment.",
  "Validate recommendation feasibility with the client's actual constraints.",
  "Confirm all open questions have been addressed or acknowledged.",
  "Review for confidentiality — ensure no sensitive third-party data is included.",
  "Approve before any client delivery or presentation.",
] as const;

/** Default readiness for AI-generated output. */
export const DEFAULT_READINESS: DeliverableReadiness = "needs-human-review";

/** True if the readiness level allows client sharing. */
export function isClientSafe(readiness: DeliverableReadiness): boolean {
  return readiness === "client-ready-draft" || readiness === "approved-for-client";
}

/** Infer readiness from engagement status for display defaults. */
export function inferReadiness(engagementStatus: string): DeliverableReadiness {
  if (engagementStatus === "complete" || engagementStatus === "completed") return "needs-human-review";
  if (engagementStatus === "needs-review") return "needs-human-review";
  return "internal-draft";
}
