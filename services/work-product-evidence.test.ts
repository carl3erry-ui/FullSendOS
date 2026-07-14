import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { globalTaskStore } from "../agents";
import type { AgentTask } from "../agents/types";
import { EvidenceReferenceSchema, WorkProductEvidenceSummarySchema } from "../schemas/work-product-evidence";
import { buildWorkProductEvidence } from "./work-product-evidence";
import { createHumanInputRequest, confirmHumanInputRequest } from "./human-input-service";

const taskDir = join(process.cwd(), "data", "agent-tasks");
const humanInputDir = join(process.cwd(), "data", "human-input-requests");

async function cleanupTask(taskId: string) {
  await rm(join(taskDir, `${taskId}.json`), { force: true });
}

async function cleanupRequest(requestId: string) {
  await rm(join(humanInputDir, `${requestId}.json`), { force: true });
}

function makeProject(id: string) {
  return {
    id,
    clientId: `client-${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: {
      companyName: "Hardware Brewery",
      website: "https://hardwarebrewery.com",
      contactName: "Owner",
      industry: "Hospitality",
    },
    brief: {
      objective: "Acquisition / real estate evaluation",
    },
    departments: {
      research: {
        claims: [
          {
            statement: "The brewery address is still unverified.",
            classification: "assumption",
            confidence: 0.45,
          },
        ],
        unknowns: [
          {
            question: "What is the confirmed operating address?",
            whyItMatters: "Real estate underwriting depends on location-specific diligence.",
            recommendedMethod: "Confirm with the client or a vetted document.",
          },
        ],
      },
      publishing: {
        recommendations: [
          {
            priority: "immediate",
            recommendation: "Confirm the site before underwriting.",
            rationale: "Address drives zoning, lease, and facility diligence.",
            successMeasure: "Verified address recorded in the project.",
          },
        ],
      },
    },
  };
}

function makeRetrievalTask(taskId: string, engagementId: string): AgentTask {
  const now = new Date().toISOString();
  return {
    id: taskId,
    agentId: "researcher",
    title: "Retrieve real estate file",
    objective: "Collect evidence for underwriting",
    engagementId,
    status: "completed",
    priority: "medium",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    context: {
      dataRoomRetrieval: {
        retrievalAuditId: "dra-1",
        query: "address and lease",
        sources: [
          {
            citationLabel: "Source A",
            displayName: "Lease Summary.pdf",
            documentId: "doc-1",
            fileId: "file-1",
            detectedDocumentType: "lease_summary",
          },
        ],
        excerpts: [
          {
            citationLabel: "Source A",
            documentId: "doc-1",
            fileId: "file-1",
            text: "Candidate location appears in the lease abstract, but still needs human confirmation.",
            confidence: 0.72,
          },
        ],
      },
    },
    evidence: [
      {
        type: "analysis",
        title: "Address inference",
        content: "A likely address can be inferred from the lease abstract, but it remains unverified.",
        source: "doc-1",
        confidence: 0.61,
        retrievedAt: now,
      },
    ],
    sources: ["Source A: Lease Summary.pdf"],
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  };
}

test("EvidenceReference schema validates safe evidence metadata", () => {
  const parsed = EvidenceReferenceSchema.parse({
    id: "ref-1",
    sourceType: "data_room_document",
    citationLabel: "Source A",
    title: "Lease Summary.pdf",
    description: "Lease abstract excerpt",
    fileId: "file-1",
    documentId: "doc-1",
    confidence: 0.74,
    verifiedStatus: "retrieved_from_data_room",
    createdAt: new Date().toISOString(),
  });

  assert.equal(parsed.citationLabel, "Source A");
});

test("WorkProductEvidenceSummary schema validates evidence-backed summary", () => {
  const parsed = WorkProductEvidenceSummarySchema.parse({
    evidenceUsed: [],
    assumptions: [],
    openQuestions: [],
    humanConfirmations: [],
    sourceCoverage: {
      dataRoomDocuments: 1,
      humanConfirmations: 0,
      clientProvidedAnchors: 2,
      agentEvidence: 1,
      openQuestions: 1,
    },
    confidenceSummary: {
      level: "medium",
      score: 0.64,
      rationale: "Sufficient evidence with some unresolved questions.",
    },
    missingEvidence: ["Confirmed operating address"],
    recommendedNextActions: ["Request confirmed address"],
  });

  assert.equal(parsed.sourceCoverage.dataRoomDocuments, 1);
});

test("Data Room retrieval sources become evidence references", async () => {
  const project = makeProject("evidence-task-1");
  const task = makeRetrievalTask("task-evidence-1", project.id);
  await globalTaskStore.saveTask(task);

  try {
    const result = await buildWorkProductEvidence(project);
    const sourceReference = result.evidenceReferences.find((reference) => reference.citationLabel === "Source A");

    assert.ok(sourceReference);
    assert.equal(sourceReference?.verifiedStatus, "retrieved_from_data_room");
    assert.match(sourceReference?.excerptPreview || "", /needs human confirmation/i);
  } finally {
    await cleanupTask(task.id);
  }
});

test("Human input confirmations become evidence references and open requests remain open questions", async () => {
  const project = makeProject("human-input-1");
  const openRequest = await createHumanInputRequest({
    clientId: project.clientId || undefined,
    engagementId: project.id,
    type: "missing_information",
    title: "Confirm address",
    prompt: "Please confirm the operating address.",
    priority: "high",
    requestedBy: "system",
    relatedField: "address",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  const confirmed = await createHumanInputRequest({
    clientId: project.clientId || undefined,
    engagementId: project.id,
    type: "confirm_inferred_fact",
    title: "Confirm buyer persona",
    prompt: "Please confirm the buyer persona.",
    priority: "medium",
    requestedBy: "system",
    relatedField: "buyerPersona",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });
  await confirmHumanInputRequest(confirmed.id, "Confirmed by operator.", "admin");

  try {
    const result = await buildWorkProductEvidence(project);

    assert.equal(result.evidenceSummary.humanConfirmations.length, 1);
    assert.equal(result.evidenceSummary.humanConfirmations[0]?.verifiedStatus, "human_confirmed");
    assert.equal(result.evidenceSummary.openQuestions.some((question) => /operating address/i.test(question.question)), true);
  } finally {
    await cleanupRequest(openRequest.id);
    await cleanupRequest(confirmed.id);
  }
});

test("Inferred facts remain unverified until confirmed", async () => {
  const project = makeProject("inferred-1");
  const task = makeRetrievalTask("task-inferred-1", project.id);
  await globalTaskStore.saveTask(task);

  try {
    const result = await buildWorkProductEvidence(project);
    const inferred = result.evidenceReferences.find((reference) => reference.title === "Address inference");

    assert.ok(inferred);
    assert.equal(inferred?.verifiedStatus, "agent_inferred");
    assert.equal(result.evidenceSummary.humanConfirmations.some((reference) => reference.title === "Address inference"), false);
  } finally {
    await cleanupTask(task.id);
  }
});

test("Hardware Brewery scenario keeps address as open question with provided anchors", async () => {
  const project = makeProject("hardware-brewery-evidence");
  const request = await createHumanInputRequest({
    clientId: project.clientId || undefined,
    engagementId: project.id,
    type: "missing_information",
    title: "Confirm address for Hardware Brewery",
    prompt: "Please confirm the business address for Hardware Brewery or continue with address unknown.",
    priority: "medium",
    requestedBy: "system",
    relatedField: "address",
    requiredToContinue: false,
    options: [],
    evidence: [],
    sourceReferences: [],
    metadata: {
      smartIntake: true,
    },
  });

  try {
    const result = await buildWorkProductEvidence(project);
    const websiteAnchor = result.evidenceReferences.find((reference) => reference.title === "Website");
    const companyAnchor = result.evidenceReferences.find((reference) => reference.title === "Business name");

    assert.ok(websiteAnchor);
    assert.ok(companyAnchor);
    assert.equal(result.evidenceSummary.openQuestions.some((question) => question.relatedField === "address"), true);
    assert.equal(result.evidenceSummary.humanConfirmations.some((reference) => /address/i.test(reference.title)), false);
    assert.equal(result.evidenceSummary.missingEvidence.some((item) => /address/i.test(item)), true);
  } finally {
    await cleanupRequest(request.id);
  }
});
