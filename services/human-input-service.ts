import type { AgentTask } from "../agents/types";
import { globalTaskStore } from "../agents";
import type { HumanInputRequest, HumanInputRequestCreate } from "../schemas/human-input";
import type { HumanInputRequestFilter } from "./human-input-store";
import { globalHumanInputRequestStore } from "./human-input-store";

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function hasStrongAnchors(input: {
  companyName?: string;
  website?: string;
  objective?: string;
}): boolean {
  return Boolean(input.companyName?.trim() && input.website?.trim() && input.objective?.trim());
}

function buildAddressPrompt(companyName: string): string {
  return `FullSendOS has enough information to begin. Please confirm the business address for ${companyName} or continue with address unknown.`;
}

export async function createHumanInputRequest(input: HumanInputRequestCreate): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.createRequest(input);
}

export async function listHumanInputRequests(filter?: HumanInputRequestFilter): Promise<HumanInputRequest[]> {
  return globalHumanInputRequestStore.listRequests(filter);
}

export async function getHumanInputRequest(id: string): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.loadRequest(id);
}

export async function updateHumanInputRequest(
  id: string,
  updates: Partial<HumanInputRequest>,
): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.updateRequest(id, updates);
}

export async function answerHumanInputRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.answerRequest(id, response, resolvedBy);
}

export async function confirmHumanInputRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.confirmRequest(id, response, resolvedBy);
}

export async function rejectHumanInputRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.rejectRequest(id, response, resolvedBy);
}

export async function skipHumanInputRequest(id: string, response: string, resolvedBy: string): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.skipRequest(id, response, resolvedBy);
}

export async function cancelHumanInputRequest(id: string, resolvedBy: string): Promise<HumanInputRequest> {
  return globalHumanInputRequestStore.cancelRequest(id, resolvedBy);
}

export function classifySmartIntake(input: {
  companyName?: string;
  website?: string;
  objective?: string;
}): "enrichable" | "needs_user_input" | "blocked" {
  if (hasStrongAnchors(input)) return "enrichable";
  if (input.companyName?.trim()) return "needs_user_input";
  return "blocked";
}

export function buildSmartIntakeHumanInputRequest(input: {
  clientId?: string;
  engagementId?: string;
  workflowRunId?: string;
  agentTaskId?: string;
  companyName?: string;
  website?: string;
  objective?: string;
  requestedBy?: string;
}): HumanInputRequestCreate[] {
  const classification = classifySmartIntake(input);
  const companyName = normalizeText(input.companyName || "Untitled business");
  const website = normalizeText(input.website || "");
  const objective = normalizeText(input.objective || "");

  if (classification === "enrichable") {
    return [
      {
        clientId: input.clientId,
        engagementId: input.engagementId,
        workflowRunId: input.workflowRunId,
        agentTaskId: input.agentTaskId,
        type: "missing_information",
        title: `Confirm address for ${companyName}`,
        prompt: buildAddressPrompt(companyName),
        priority: "medium",
        requestedBy: input.requestedBy || "system",
        relatedField: "address",
        requiredToContinue: false,
        resumeAction: "continue_with_assumption",
        metadata: {
          intakeClassification: classification,
          strongAnchors: {
            companyName: input.companyName?.trim() || "",
            website: website,
            objective,
          },
          smartIntake: true,
        },
        evidence: [],
        sourceReferences: [],
        options: [
          { label: "Confirm", value: "confirm" },
          { label: "Reject", value: "reject" },
          { label: "Edit value", value: "edit" },
          { label: "Continue with address unknown", value: "continue" },
        ],
      },
    ];
  }

  if (classification === "needs_user_input") {
    return [
      {
        clientId: input.clientId,
        engagementId: input.engagementId,
        workflowRunId: input.workflowRunId,
        agentTaskId: input.agentTaskId,
        type: "missing_information",
        title: `Provide business website for ${companyName}`,
        prompt: `FullSendOS needs a website or public URL for ${companyName} before it can enrich the intake safely. Please provide one or continue with limited analysis.`,
        priority: "high",
        requestedBy: input.requestedBy || "system",
        relatedField: "website",
        requiredToContinue: true,
        resumeAction: "continue_with_assumption",
        metadata: {
          intakeClassification: classification,
          strongAnchors: {
            companyName: input.companyName?.trim() || "",
            website,
            objective,
          },
          smartIntake: true,
        },
        evidence: [],
        sourceReferences: [],
        options: [
          { label: "Provide website", value: "provide_website" },
          { label: "Continue without website", value: "continue_without_website" },
        ],
      },
    ];
  }

  return [
    {
      clientId: input.clientId,
      engagementId: input.engagementId,
      workflowRunId: input.workflowRunId,
      agentTaskId: input.agentTaskId,
      type: "missing_information",
      title: "Provide business identity details",
      prompt: "FullSendOS needs a business name and website to begin smart intake safely. Please provide the missing anchor(s).",
      priority: "critical",
      requestedBy: input.requestedBy || "system",
      relatedField: "businessIdentity",
      requiredToContinue: true,
      resumeAction: "continue_with_assumption",
      metadata: {
        intakeClassification: classification,
        smartIntake: true,
      },
      evidence: [],
      sourceReferences: [],
      options: [
        { label: "Provide company name", value: "provide_company_name" },
        { label: "Provide website", value: "provide_website" },
      ],
    },
  ];
}

export async function createSmartIntakeRequests(input: {
  clientId?: string;
  engagementId?: string;
  workflowRunId?: string;
  agentTaskId?: string;
  companyName?: string;
  website?: string;
  objective?: string;
  requestedBy?: string;
}): Promise<HumanInputRequest[]> {
  const requests = buildSmartIntakeHumanInputRequest(input);
  const created: HumanInputRequest[] = [];
  for (const request of requests) {
    created.push(await createHumanInputRequest(request));
  }
  return created;
}

export async function createAddressEnrichmentTask(input: {
  engagementId: string;
  companyName: string;
  website?: string;
  objective: string;
  requestedBy?: string;
}): Promise<AgentTask> {
  const taskId = `task-researcher-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id: taskId,
    agentId: "researcher",
    title: `Enrich address for ${input.companyName}`,
    objective: `Identify the likely business address for ${input.companyName} from the provided website and context. Return an unverified candidate address only if supported; otherwise state the address remains unknown.`,
    engagementId: input.engagementId,
    status: "queued",
    priority: "medium",
    provider: "mock",
    model: "mock-1.0",
    approvalStatus: "not_required",
    instructions: `Use only safe, permissioned context. Do not claim the address is verified without human confirmation. Website: ${input.website || "not provided"}`,
    context: {
      smartIntake: true,
      businessName: input.companyName,
      website: input.website || undefined,
      objective: input.objective,
      requestedBy: input.requestedBy || "system",
    },
    createdAt: now,
    updatedAt: now,
  } as AgentTask;
}

export async function provisionSmartIntakeForProject(input: {
  clientId?: string;
  engagementId: string;
  companyName: string;
  website?: string;
  objective: string;
  requestedBy?: string;
}): Promise<{ requests: HumanInputRequest[]; enrichmentTask?: AgentTask }> {
  const classification = classifySmartIntake({
    companyName: input.companyName,
    website: input.website,
    objective: input.objective,
  });

  let enrichmentTask: AgentTask | undefined;
  let requestInputs = buildSmartIntakeHumanInputRequest({
    clientId: input.clientId,
    engagementId: input.engagementId,
    companyName: input.companyName,
    website: input.website,
    objective: input.objective,
    requestedBy: input.requestedBy,
    agentTaskId: undefined,
  });

  if (classification === "enrichable") {
    enrichmentTask = await createAddressEnrichmentTask({
      engagementId: input.engagementId,
      companyName: input.companyName,
      website: input.website,
      objective: input.objective,
      requestedBy: input.requestedBy,
    });
    await globalTaskStore.saveTask(enrichmentTask);

    requestInputs = buildSmartIntakeHumanInputRequest({
      clientId: input.clientId,
      engagementId: input.engagementId,
      companyName: input.companyName,
      website: input.website,
      objective: input.objective,
      requestedBy: input.requestedBy,
      agentTaskId: enrichmentTask.id,
    });
  }

  const requests: HumanInputRequest[] = [];
  for (const request of requestInputs) {
    requests.push(await createHumanInputRequest(request));
  }

  return { requests, enrichmentTask };
}
