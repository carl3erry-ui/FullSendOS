/**
 * FullSendOS Agent Collaboration Framework v1
 * Human approval gate evaluator.
 *
 * Determines when human review/approval is required before proceeding
 * with a collaboration action or delivering output.
 *
 * Integrates with the deliverable-readiness model.
 * No live AI calls. Deterministic. Conservative by default.
 */

export type ApprovalContext = {
  hasLegalSensitiveContent?: boolean;
  hasFinancialProjections?: boolean;
  hasInvestorFacingContent?: boolean;
  isClientFacingDeliverable?: boolean;
  isExternalCommunication?: boolean;
  isHighCostWorkflow?: boolean;
  hasLowConfidenceRecommendation?: boolean;
  hasMissingCriticalData?: boolean;
  hasOpenEscalations?: boolean;
  hasUnresolvedApprovalGates?: boolean;
  confidenceScore?: number | null;
};

export type ApprovalGateResult = {
  required: boolean;
  reasons: string[];
  severity: "none" | "advisory" | "required" | "mandatory";
};

const CONFIDENCE_THRESHOLD = 0.65;

export function requiresHumanApproval(context: ApprovalContext): ApprovalGateResult {
  const reasons: string[] = [];

  if (context.hasLegalSensitiveContent) {
    reasons.push("Legal-sensitive content requires review by a licensed attorney before delivery.");
  }
  if (context.hasFinancialProjections) {
    reasons.push("Financial projections require human validation before client or investor delivery.");
  }
  if (context.hasInvestorFacingContent) {
    reasons.push("Investor-facing materials require human approval before distribution.");
  }
  if (context.isClientFacingDeliverable) {
    reasons.push("Client-facing deliverables require human review before delivery.");
  }
  if (context.isExternalCommunication) {
    reasons.push("External communication requires human approval before sending.");
  }
  if (context.isHighCostWorkflow) {
    reasons.push("High-cost workflows require human authorization before execution.");
  }
  if (context.hasLowConfidenceRecommendation) {
    reasons.push("Low-confidence recommendations require human validation before presenting.");
  }
  if (context.hasMissingCriticalData) {
    reasons.push("Critical data is missing — human must decide whether to proceed with incomplete information.");
  }
  if (context.hasOpenEscalations) {
    reasons.push("Open escalations must be resolved or accepted by a human before proceeding.");
  }
  if (context.hasUnresolvedApprovalGates) {
    reasons.push("Unresolved approval gates exist in the collaboration trace — human action required.");
  }
  if (
    context.confidenceScore !== null &&
    context.confidenceScore !== undefined &&
    context.confidenceScore < CONFIDENCE_THRESHOLD
  ) {
    reasons.push(
      `Overall confidence score (${Math.round(context.confidenceScore * 100)}%) is below the minimum threshold of ${Math.round(CONFIDENCE_THRESHOLD * 100)}%.`,
    );
  }

  const required = reasons.length > 0;
  let severity: ApprovalGateResult["severity"] = "none";
  if (
    context.hasLegalSensitiveContent ||
    context.isClientFacingDeliverable ||
    context.hasInvestorFacingContent
  ) {
    severity = "mandatory";
  } else if (required) {
    severity = "required";
  }

  return { required, reasons, severity };
}

/**
 * Returns true if this context ALWAYS requires human approval regardless of other factors.
 * Used as a fast-path check.
 */
export function isMandatoryApprovalContext(context: ApprovalContext): boolean {
  return !!(
    context.hasLegalSensitiveContent ||
    context.isClientFacingDeliverable ||
    context.hasInvestorFacingContent
  );
}
