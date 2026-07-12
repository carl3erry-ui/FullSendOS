import { DepartmentContracts, buildDepartmentPrompt } from "../contracts/departmentContracts.js";
import { ProjectSchema, createEmptyProject } from "../schemas/projectSchema.js";
import { callXai } from "../services/xaiClient.js";
import { normalizeDepartmentOutput } from "./outputNormalizer.js";
import { parseJsonObject } from "../utils/json.js";
import { saveProject } from "../storage/projectStore.js";
import {
  beginWorkflowRun,
  completeWorkflowRun,
  failWorkflowRun,
  heartbeatWorkflowRun,
} from "./runLifecycle.js";

export const PIPELINE = [
  "research",
  "competitors",
  "customers",
  "strategy",
  "brand",
  "website",
  "publishing"
];

function now() {
  return new Date().toISOString();
}

function formatValidationError(error) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function redactForLog(value) {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item));
  }

  const redacted = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (/api.?key|token|secret|authorization|password/i.test(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }

    redacted[key] = redactForLog(nestedValue);
  }

  return redacted;
}

function parseAndValidateDepartmentOutput({ department, schema, text }) {
  const raw = parseJsonObject(text);
  const normalized = normalizeDepartmentOutput(department, raw);

  if (process.env.NODE_ENV !== "production" && department === "research") {
    const redactedRaw = redactForLog(raw);
    const redactedNormalized = redactForLog(normalized);
    console.log(`workflow-raw-output ${department}`, JSON.stringify(redactedRaw).slice(0, 2000));
    console.log(`workflow-normalized-output ${department}`, JSON.stringify(redactedNormalized).slice(0, 2000));
  }

  return schema.parse(normalized);
}

async function runDepartment({ department, project, model, onProgress, invokeModel }) {
  const contract = DepartmentContracts[department];
  const audit = {
    department,
    startedAt: now(),
    status: "running",
    model
  };
  project.audit.runs.push(audit);
  project.updatedAt = now();
  if (project.audit.activeRun) {
    project.audit.activeRun.updatedAt = project.updatedAt;
  }
  await saveProject(project);
  onProgress?.({ type: "department-started", department, project });

  const prompt = buildDepartmentPrompt({ department, project });
  const maxOutputTokens = department === "publishing" ? 7000 : 5000;
  let result = await invokeModel({ prompt, model, department, phase: "primary", projectId: project.id, maxOutputTokens });
  let parsed;

  try {
    parsed = parseAndValidateDepartmentOutput({
      department,
      schema: contract.schema,
      text: result.text
    });
  } catch (error) {
    const validationMessage = error?.issues ? formatValidationError(error) : error.message;
    audit.status = "repaired";
    project.updatedAt = now();
    if (project.audit.activeRun) {
      project.audit.activeRun.updatedAt = project.updatedAt;
    }
    await saveProject(project);
    onProgress?.({ type: "department-repairing", department, project, message: validationMessage });

    const repairPrompt = `Repair the following model output so it becomes valid JSON matching the ${department} contract.
Return JSON only. Preserve useful content. Do not add unsupported facts.

VALIDATION ERROR
${validationMessage}

PROJECT SOURCE IDS
${JSON.stringify(project.evidence.sources.map((source) => source.id))}

BROKEN OUTPUT
${result.text}`;

    result = await invokeModel({ prompt: repairPrompt, model, department, phase: "repair", projectId: project.id, maxOutputTokens });
    try {
      parsed = parseAndValidateDepartmentOutput({
        department,
        schema: contract.schema,
        text: result.text
      });
    } catch (repairError) {
      if (department === "publishing" && typeof repairError === "object" && repairError && "issues" in repairError && Array.isArray(repairError.issues)) {
        const field = repairError.issues[0]?.path?.[0] || "unknown field";
        const fieldName = typeof field === "string" ? field : String(field);
        throw new Error(`Publishing validation failed: ${fieldName} is required.`);
      }

      throw repairError;
    }
  }

  project.departments[department] = parsed;
  project.updatedAt = now();
  if (project.audit.activeRun) {
    project.audit.activeRun.updatedAt = project.updatedAt;
  }
  audit.completedAt = now();
  if (audit.status === "running") audit.status = "complete";

  await saveProject(project);
  await heartbeatWorkflowRun(project);
  onProgress?.({ type: "department-completed", department, project });
  return parsed;
}

export async function runExistingProject(project, options = {}) {
  const model = options.model || process.env.XAI_MODEL || "grok-4.5";
  const onProgress = options.onProgress;
  const invokeModel = options.invokeModel || callXai;

  if (!options.skipRunStart) {
    await beginWorkflowRun(project, { model, runId: options.runId });
  }

  try {
    for (const department of PIPELINE) {
      await runDepartment({ department, project, model, onProgress, invokeModel });
    }

    const publishing = project.departments.publishing;
    project.deliverables.executiveReport = publishing.reportMarkdown;
    project.deliverables.onePageSummary = publishing.onePageSummary;
    project.deliverables.deckOutline = publishing.deckOutline;

    const hasUnknowns = PIPELINE.some((name) => project.departments[name]?.unknowns?.length > 0);
    const nextStatus = hasUnknowns ? "needs-review" : "complete";
    await completeWorkflowRun(project, nextStatus);
    onProgress?.({ type: "project-completed", project });
    return ProjectSchema.parse(project);
  } catch (error) {
    const message = typeof error === "object" && error && "issues" in error && Array.isArray(error.issues)
      ? formatValidationError(error)
      : error instanceof Error
        ? error.message
        : "Unknown workflow error";
    await failWorkflowRun(project, message);
    onProgress?.({ type: "project-failed", project, error: message });
    throw error;
  }
}

export async function runConsultingProject(input, options = {}) {
  const project = createEmptyProject(input);
  await saveProject(project);
  return runExistingProject(project, options);
}
