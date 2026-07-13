/**
 * Intake Classifier (Slice 10)
 *
 * Classifies an engagement brief into one of four states:
 *   - complete         : enough context to run immediately
 *   - enrichable       : missing fields, but strong anchors exist
 *   - needs_user_input : anchors are weak; focused clarification needed
 *   - blocked          : too vague to start
 *
 * Classification is pure (no side effects) and requires no AI calls.
 * It inspects only the fields the user has already provided.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const IntakeClassificationSchema = z.enum([
  "complete",
  "enrichable",
  "needs_user_input",
  "blocked",
]);
export type IntakeClassification = z.infer<typeof IntakeClassificationSchema>;

export const IntakeFieldStatusSchema = z.enum([
  "user_provided",
  "inferred",
  "unverified",
  "confirmed",
  "missing",
]);
export type IntakeFieldStatus = z.infer<typeof IntakeFieldStatusSchema>;

export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const IntakeFieldSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  currentValue: z.string().nullable(),
  status: IntakeFieldStatusSchema,
  confidence: ConfidenceLevelSchema.nullable(),
  source: z.string().optional(),
  question: z.string().optional(),
});
export type IntakeField = z.infer<typeof IntakeFieldSchema>;

export const EnrichmentPlanSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  intakeClassification: IntakeClassificationSchema,
  createdAt: z.string(),
  companyName: z.string(),
  knownFields: z.array(IntakeFieldSchema),
  missingFields: z.array(IntakeFieldSchema),
  researchQuestions: z.array(z.string()),
  canProceed: z.boolean(),
  needsHumanConfirmation: z.boolean(),
  recommendedAgentId: z.string(),
  assumptionNote: z.string(),
});
export type EnrichmentPlan = z.infer<typeof EnrichmentPlanSchema>;

// ---------------------------------------------------------------------------
// Intake context — what the user has provided
// ---------------------------------------------------------------------------

export type IntakeContext = {
  companyName?: string;
  website?: string;
  industry?: string;
  geography?: string[];
  objective?: string;
  knownFacts?: string[];
  clientProvidedContext?: string;
  contactName?: string;
};

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

function isPresent(value?: string | null): boolean {
  return Boolean(value?.trim());
}

function hasItems(arr?: string[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Count how many strong anchors are present.
 * Strong anchors are fields that independently enable research:
 * company name, website, geography/location, known facts.
 */
export function countStrongAnchors(ctx: IntakeContext): number {
  let count = 0;
  if (isPresent(ctx.companyName)) count++;
  if (isPresent(ctx.website)) count++;
  if (hasItems(ctx.geography)) count++;
  if (hasItems(ctx.knownFacts)) count++;
  if (isPresent(ctx.clientProvidedContext)) count++;
  return count;
}

/**
 * Classify an engagement brief's completeness level.
 */
export function classifyIntake(ctx: IntakeContext): IntakeClassification {
  const hasName = isPresent(ctx.companyName);
  const hasObjective = isPresent(ctx.objective);
  const hasWebsite = isPresent(ctx.website);
  const hasIndustry = isPresent(ctx.industry);
  const hasGeo = hasItems(ctx.geography);
  const hasFacts = hasItems(ctx.knownFacts);
  const hasContext = isPresent(ctx.clientProvidedContext);
  const anchorCount = countStrongAnchors(ctx);

  // Blocked: nothing useful to start with
  if (!hasName && !hasObjective) return "blocked";
  if (!hasName && !hasWebsite && !hasGeo && !hasFacts) return "blocked";

  // Needs user input: has objective but no company name (can't research without anchor)
  if (!hasName) return "needs_user_input";
  if (!hasObjective) return "needs_user_input";

  // Has company name + objective — now assess context richness
  const hasRichContext = (hasWebsite ? 1 : 0) + (hasIndustry ? 1 : 0) + (hasGeo ? 1 : 0) + (hasFacts ? 1 : 0) + (hasContext ? 1 : 0);

  // Complete: has enough context to run confidently
  if (hasRichContext >= 3) return "complete";
  if (hasRichContext >= 2 && hasWebsite) return "complete";

  // Enrichable: has strong anchors but missing context — can research
  if (anchorCount >= 2) return "enrichable";   // company + website = enrichable
  if (hasWebsite || hasGeo || hasFacts) return "enrichable"; // at least one anchor besides name

  // Enrichable with just name: name alone is enough to attempt research
  return "enrichable";
}

/**
 * Describe the intake fields with their status and confidence.
 */
export function describeIntakeFields(ctx: IntakeContext): {
  knownFields: IntakeField[];
  missingFields: IntakeField[];
} {
  const knownFields: IntakeField[] = [];
  const missingFields: IntakeField[] = [];

  const fields: Array<{ key: keyof IntakeContext; label: string; question: string }> = [
    { key: "companyName", label: "Company name", question: "What is the full legal or trading name of the company?" },
    { key: "website", label: "Website / domain", question: "What is the company website or domain?" },
    { key: "industry", label: "Industry / sector", question: "What industry or sector is this company in?" },
    { key: "geography", label: "Location / geography", question: "Where is the company located (city, state, region)?" },
    { key: "objective", label: "Engagement objective", question: "What is the primary objective of this engagement?" },
    { key: "contactName", label: "Primary contact", question: "Who is the primary contact at the company?" },
  ];

  for (const { key, label, question } of fields) {
    const raw = ctx[key];
    const value = Array.isArray(raw)
      ? raw.join(", ")
      : typeof raw === "string"
        ? raw
        : null;

    const present = Array.isArray(raw) ? hasItems(raw) : isPresent(raw as string);

    if (present && value) {
      knownFields.push(
        IntakeFieldSchema.parse({
          field: key,
          label,
          currentValue: value,
          status: "user_provided",
          confidence: "high",
          source: "user_input",
        }),
      );
    } else {
      missingFields.push(
        IntakeFieldSchema.parse({
          field: key,
          label,
          currentValue: null,
          status: "missing",
          confidence: null,
          question,
        }),
      );
    }
  }

  return { knownFields, missingFields };
}

/**
 * Generate research questions for missing fields.
 */
export function buildResearchQuestions(ctx: IntakeContext): string[] {
  const questions: string[] = [];
  const { missingFields } = describeIntakeFields(ctx);

  if (!isPresent(ctx.website)) {
    questions.push(`What is the website or online presence for "${ctx.companyName}"?`);
  }
  if (!hasItems(ctx.geography)) {
    questions.push(`Where is "${ctx.companyName}" located? City, state, and region.`);
  }
  if (!isPresent(ctx.industry)) {
    questions.push(`What industry or business category does "${ctx.companyName}" operate in?`);
  }

  // Add objective-driven questions
  const obj = (ctx.objective ?? "").toLowerCase();
  if (obj.includes("acqui") || obj.includes("real estate") || obj.includes("buy") || obj.includes("purchase")) {
    questions.push(`Is "${ctx.companyName}" publicly listed or privately held?`);
    questions.push(`What is the approximate size (employees, revenue tier) of "${ctx.companyName}"?`);
    questions.push(`Are there any public listings, permits, or business registrations for "${ctx.companyName}"?`);
  }

  for (const mf of missingFields) {
    if (mf.question && !questions.some(q => q === mf.question)) {
      questions.push(mf.question);
    }
  }

  return questions.slice(0, 8); // Limit to 8 questions
}

/**
 * Build a summary assumption note for the workflow.
 */
export function buildAssumptionNote(ctx: IntakeContext, classification: IntakeClassification): string {
  if (classification === "complete") {
    return "Engagement brief is complete. Proceeding with provided information.";
  }
  if (classification === "blocked") {
    return "Insufficient information to begin. Company name and objective are required.";
  }
  if (classification === "needs_user_input") {
    return "A few focused details are needed before the workflow can run accurately.";
  }

  const missing: string[] = [];
  if (!isPresent(ctx.website)) missing.push("website");
  if (!hasItems(ctx.geography)) missing.push("location/address");
  if (!isPresent(ctx.industry)) missing.push("industry");

  const missingStr = missing.length ? ` Missing: ${missing.join(", ")}.` : "";
  return `Enrichable intake. Strong anchors present for "${ctx.companyName}".${missingStr} Research enrichment task will gather missing context. Proceeding with assumptions marked as unverified.`;
}
