import { globalTaskStore } from "@/agents";
import type { AgentTask } from "@/agents/types";
import type { HumanInputRequest } from "@/schemas/human-input";
import {
  EvidenceReferenceSchema,
  WorkProductAssumptionSchema,
  WorkProductConfidenceSummarySchema,
  WorkProductEvidenceSummarySchema,
  WorkProductOpenQuestionSchema,
  type EvidenceReference,
  type WorkProductAssumption,
  type WorkProductConfidenceSummary,
  type WorkProductEvidenceSummary,
  type WorkProductOpenQuestion,
} from "@/schemas/work-product-evidence";
import { listHumanInputRequests } from "@/services/human-input-service";
import type { EngagementDetail } from "@/app/components/work-product-model";

type ProjectForEvidence = {
  id: string;
  clientId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  client?: {
    companyName?: string;
    website?: string;
    contactName?: string;
    industry?: string;
  };
  brief?: {
    objective?: string;
  };
  departments?: Record<string, Record<string, unknown> | null | undefined>;
};

export type WorkProductEvidenceBundle = {
  evidenceReferences: EvidenceReference[];
  evidenceSummary: WorkProductEvidenceSummary;
  deckOutlineEvidenceNotes: string[];
};

function clipText(value: string, maxLength = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function pushReference(collection: EvidenceReference[], reference: EvidenceReference) {
  collection.push(EvidenceReferenceSchema.parse(reference));
}

function pushAssumption(collection: WorkProductAssumption[], assumption: WorkProductAssumption) {
  collection.push(WorkProductAssumptionSchema.parse(assumption));
}

function pushOpenQuestion(collection: WorkProductOpenQuestion[], question: WorkProductOpenQuestion) {
  collection.push(WorkProductOpenQuestionSchema.parse(question));
}

function buildAnchorEvidence(project: ProjectForEvidence): EvidenceReference[] {
  const references: EvidenceReference[] = [];
  const createdAt = project.updatedAt || project.createdAt || new Date().toISOString();

  if (project.client?.companyName) {
    pushReference(references, {
      id: `anchor-company-${project.id}`,
      sourceType: "client_brief",
      citationLabel: "Client Brief A",
      title: "Business name",
      description: project.client.companyName,
      confidence: 1,
      verifiedStatus: "user_provided",
      createdAt,
    });
  }

  if (project.client?.website) {
    pushReference(references, {
      id: `anchor-website-${project.id}`,
      sourceType: "client_brief",
      citationLabel: "Client Brief B",
      title: "Website",
      description: project.client.website,
      confidence: 1,
      verifiedStatus: "user_provided",
      createdAt,
    });
  }

  if (project.brief?.objective) {
    pushReference(references, {
      id: `anchor-objective-${project.id}`,
      sourceType: "client_brief",
      citationLabel: "Client Brief C",
      title: "Objective",
      description: clipText(project.brief.objective, 180),
      confidence: 0.95,
      verifiedStatus: "user_provided",
      createdAt,
    });
  }

  return references;
}

function buildTaskEvidence(task: AgentTask): EvidenceReference[] {
  const references: EvidenceReference[] = [];
  const createdAt = task.completedAt || task.updatedAt || task.createdAt;
  const retrievalContext = task.context?.dataRoomRetrieval as
    | {
        sources?: Array<Record<string, unknown>>;
        excerpts?: Array<Record<string, unknown>>;
      }
    | undefined;

  const retrievalSources = Array.isArray(retrievalContext?.sources) ? retrievalContext.sources : [];
  const excerpts = Array.isArray(retrievalContext?.excerpts) ? retrievalContext.excerpts : [];

  for (const source of retrievalSources) {
    const documentId = typeof source.documentId === "string" ? source.documentId : undefined;
    const fileId = typeof source.fileId === "string" ? source.fileId : undefined;
    const excerpt = excerpts.find(
      (candidate) => candidate.documentId === documentId && candidate.fileId === fileId,
    );

    pushReference(references, {
      id: `retrieval-${task.id}-${documentId || fileId || references.length}`,
      sourceType: "data_room_document",
      citationLabel: typeof source.citationLabel === "string" ? source.citationLabel : `Source ${references.length + 1}`,
      title: typeof source.displayName === "string" ? source.displayName : "Retrieved document",
      description: typeof source.detectedDocumentType === "string" ? source.detectedDocumentType : "Retrieved document",
      fileId,
      documentId,
      agentTaskId: task.id,
      excerptPreview: typeof excerpt?.text === "string" ? clipText(excerpt.text, 220) : undefined,
      confidence: typeof excerpt?.confidence === "number" ? excerpt.confidence : undefined,
      verifiedStatus: "retrieved_from_data_room",
      createdAt,
    });
  }

  for (const evidence of task.evidence || []) {
    const inferredStatus = evidence.type === "analysis" || evidence.type === "internal" ? "agent_inferred" : "unverified";
    pushReference(references, {
      id: `task-evidence-${task.id}-${references.length}`,
      sourceType: "agent_task",
      citationLabel: `Task ${task.id.slice(-6)}.${references.length + 1}`,
      title: evidence.title,
      description: clipText(evidence.content, 220),
      agentTaskId: task.id,
      excerptPreview: evidence.content ? clipText(evidence.content, 160) : undefined,
      confidence: evidence.confidence,
      verifiedStatus: inferredStatus,
      createdAt: evidence.retrievedAt || createdAt,
    });
  }

  return dedupeById(references);
}

function buildHumanInputEvidence(requests: HumanInputRequest[]): {
  references: EvidenceReference[];
  confirmations: EvidenceReference[];
  openQuestions: WorkProductOpenQuestion[];
} {
  const references: EvidenceReference[] = [];
  const confirmations: EvidenceReference[] = [];
  const openQuestions: WorkProductOpenQuestion[] = [];

  for (const request of requests) {
    if (request.status === "confirmed" || request.status === "answered") {
      const verifiedStatus = request.status === "confirmed" ? "human_confirmed" : "user_provided";
      const reference: EvidenceReference = {
        id: `human-input-${request.id}`,
        sourceType: "human_input",
        citationLabel: `Human Input ${request.id.slice(-6)}`,
        title: request.title,
        description: clipText(request.response || request.prompt, 220),
        humanInputRequestId: request.id,
        confidence: typeof request.confidence === "number" ? request.confidence : request.status === "confirmed" ? 0.95 : 0.85,
        verifiedStatus,
        createdAt: request.resolvedAt || request.requestedAt,
      };
      pushReference(references, reference);
      if (verifiedStatus === "human_confirmed") {
        confirmations.push(reference);
      }
      continue;
    }

    if (request.status === "open") {
      pushOpenQuestion(openQuestions, {
        id: `human-question-${request.id}`,
        question: request.prompt,
        relatedField: request.relatedField,
        humanInputRequestId: request.id,
        verifiedStatus: "open_question",
      });
    }
  }

  return { references, confirmations, openQuestions };
}

function buildDepartmentAssumptionsAndQuestions(project: ProjectForEvidence): {
  assumptions: WorkProductAssumption[];
  openQuestions: WorkProductOpenQuestion[];
} {
  const assumptions: WorkProductAssumption[] = [];
  const openQuestions: WorkProductOpenQuestion[] = [];

  for (const [departmentId, output] of Object.entries(project.departments || {})) {
    if (!output || typeof output !== "object") continue;

    const claims = Array.isArray(output.claims) ? output.claims : [];
    for (const claim of claims) {
      if (!claim || typeof claim !== "object" || typeof claim.statement !== "string") continue;
      if (claim.classification === "assumption") {
        pushAssumption(assumptions, {
          id: `assumption-${departmentId}-${assumptions.length}`,
          statement: claim.statement,
          departmentId,
          confidence: typeof claim.confidence === "number" ? claim.confidence : undefined,
          evidenceReferenceIds: [],
        });
      }
      if (claim.classification === "estimate") {
        pushAssumption(assumptions, {
          id: `estimate-${departmentId}-${assumptions.length}`,
          statement: claim.statement,
          departmentId,
          confidence: typeof claim.confidence === "number" ? claim.confidence : undefined,
          evidenceReferenceIds: [],
        });
      }
    }

    const unknowns = Array.isArray(output.unknowns) ? output.unknowns : [];
    for (const unknown of unknowns) {
      if (!unknown || typeof unknown !== "object" || typeof unknown.question !== "string") continue;
      pushOpenQuestion(openQuestions, {
        id: `department-question-${departmentId}-${openQuestions.length}`,
        question: unknown.question,
        whyItMatters: typeof unknown.whyItMatters === "string" ? unknown.whyItMatters : undefined,
        recommendedMethod: typeof unknown.recommendedMethod === "string" ? unknown.recommendedMethod : undefined,
        departmentId,
        verifiedStatus: "open_question",
      });
    }
  }

  return { assumptions: dedupeById(assumptions), openQuestions: dedupeById(openQuestions) };
}

function buildConfidenceSummary(references: EvidenceReference[], openQuestions: WorkProductOpenQuestion[]): WorkProductConfidenceSummary {
  const scores = references
    .map((reference) => reference.confidence)
    .filter((score): score is number => typeof score === "number");

  if (scores.length === 0) {
    return WorkProductConfidenceSummarySchema.parse({
      level: openQuestions.length > 0 ? "low" : "pending",
      score: null,
      rationale:
        openQuestions.length > 0
          ? "Evidence coverage is limited and there are unresolved open questions."
          : "No explicit evidence confidence scores are available yet.",
    });
  }

  const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const adjustedScore = Math.max(0, score - Math.min(0.15, openQuestions.length * 0.03));
  const level = adjustedScore >= 0.75 ? "high" : adjustedScore >= 0.55 ? "medium" : "low";

  return WorkProductConfidenceSummarySchema.parse({
    level,
    score: Number(adjustedScore.toFixed(2)),
    rationale: `${references.length} evidence reference${references.length === 1 ? "" : "s"} collected with ${openQuestions.length} unresolved question${openQuestions.length === 1 ? "" : "s"}.`,
  });
}

function buildDeckEvidenceNotes(references: EvidenceReference[], openQuestions: WorkProductOpenQuestion[]): string[] {
  const topReferences = references.slice(0, 3).map((reference) => reference.citationLabel);
  const topQuestions = openQuestions.slice(0, 2).map((question) => question.question);
  const noteParts: string[] = [];

  if (topReferences.length > 0) {
    noteParts.push(`Sources used: ${topReferences.join(", ")}`);
  }
  if (topQuestions.length > 0) {
    noteParts.push(`Open questions: ${topQuestions.join(" | ")}`);
  }

  const note = noteParts.join(". ").trim();
  return note ? [note] : [];
}

export async function buildWorkProductEvidence(project: ProjectForEvidence): Promise<WorkProductEvidenceBundle> {
  const [tasks, requests] = await Promise.all([
    globalTaskStore.listTasks({ engagementId: project.id }),
    listHumanInputRequests({ engagementId: project.id }),
  ]);

  const anchorReferences = buildAnchorEvidence(project);
  const taskReferences = tasks.flatMap((task) => buildTaskEvidence(task));
  const humanInput = buildHumanInputEvidence(requests);
  const departmentEvidence = buildDepartmentAssumptionsAndQuestions(project);

  const evidenceReferences = dedupeById([
    ...anchorReferences,
    ...taskReferences,
    ...humanInput.references,
  ]);

  const openQuestions = dedupeById([
    ...humanInput.openQuestions,
    ...departmentEvidence.openQuestions,
  ]);

  const confidenceSummary = buildConfidenceSummary(evidenceReferences, openQuestions);
  const deckOutlineEvidenceNotes = buildDeckEvidenceNotes(evidenceReferences, openQuestions);

  const summary = WorkProductEvidenceSummarySchema.parse({
    evidenceUsed: evidenceReferences,
    assumptions: departmentEvidence.assumptions,
    openQuestions,
    humanConfirmations: humanInput.confirmations,
    sourceCoverage: {
      dataRoomDocuments: evidenceReferences.filter((reference) => reference.sourceType === "data_room_document").length,
      humanConfirmations: humanInput.confirmations.length,
      clientProvidedAnchors: anchorReferences.length,
      agentEvidence: evidenceReferences.filter((reference) => reference.sourceType === "agent_task").length,
      openQuestions: openQuestions.length,
    },
    confidenceSummary,
    missingEvidence: openQuestions
      .map((question) => question.relatedField || question.question)
      .slice(0, 8),
    recommendedNextActions: openQuestions
      .map((question) => question.recommendedMethod || `Resolve: ${question.question}`)
      .slice(0, 6),
  });

  return {
    evidenceReferences,
    evidenceSummary: summary,
    deckOutlineEvidenceNotes,
  };
}

export async function buildWorkProductEvidenceForDetail(project: ProjectForEvidence, detail: EngagementDetail) {
  const bundle = await buildWorkProductEvidence(project);
  return {
    ...bundle,
    deckOutline: Array.isArray(detail.deliverables?.deckOutline)
      ? detail.deliverables.deckOutline.map((slide, index) => ({
          ...slide,
          evidenceNote: bundle.deckOutlineEvidenceNotes[index] || bundle.deckOutlineEvidenceNotes[0] || undefined,
        }))
      : [],
  };
}
