import { DepartmentContracts, buildDepartmentPrompt } from "../contracts/departmentContracts.js";
import { ProjectSchema, createEmptyProject } from "../schemas/projectSchema.js";
import { callXai } from "../services/xaiClient.js";
import { parseJsonObject } from "../utils/json.js";
import { saveProject } from "../storage/projectStore.js";

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

async function runDepartment({ department, project, model, onProgress }) {
  const contract = DepartmentContracts[department];
  const audit = {
    department,
    startedAt: now(),
    status: "running",
    model
  };
  project.audit.runs.push(audit);
  project.updatedAt = now();
  await saveProject(project);
  onProgress?.({ type: "department-started", department, project });

  const prompt = buildDepartmentPrompt({ department, project });
  let result = await callXai({ prompt, model });
  let parsed;

  try {
    parsed = contract.schema.parse(parseJsonObject(result.text));
  } catch (error) {
    const validationMessage = error?.issues ? formatValidationError(error) : error.message;
    audit.status = "repaired";
    project.updatedAt = now();
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

    result = await callXai({ prompt: repairPrompt, model });
    parsed = contract.schema.parse(parseJsonObject(result.text));
  }

  project.departments[department] = parsed;
  project.updatedAt = now();
  audit.completedAt = now();
  if (audit.status === "running") audit.status = "complete";

  await saveProject(project);
  onProgress?.({ type: "department-completed", department, project });
  return parsed;
}

export async function runExistingProject(project, options = {}) {
  const model = options.model || process.env.XAI_MODEL || "grok-4.5";
  const onProgress = options.onProgress;
  project.status = "running";
  project.updatedAt = now();
  await saveProject(project);

  try {
    for (const department of PIPELINE) {
      await runDepartment({ department, project, model, onProgress });
    }

    const publishing = project.departments.publishing;
    project.deliverables.executiveReport = publishing.reportMarkdown;
    project.deliverables.onePageSummary = publishing.onePageSummary;
    project.deliverables.deckOutline = publishing.deckOutline;

    const hasUnknowns = PIPELINE.some((name) => project.departments[name]?.unknowns?.length > 0);
    project.status = hasUnknowns ? "needs-review" : "complete";
    project.updatedAt = now();
    await saveProject(project);
    onProgress?.({ type: "project-completed", project });
    return ProjectSchema.parse(project);
  } catch (error) {
    project.status = "failed";
    project.updatedAt = now();
    project.audit.warnings.push(error.message);

    const activeRun = [...project.audit.runs].reverse().find((run) => run.status === "running");
    if (activeRun) {
      activeRun.status = "failed";
      activeRun.completedAt = now();
      activeRun.error = error.message;
    }

    await saveProject(project);
    onProgress?.({ type: "project-failed", project, error: error.message });
    throw error;
  }
}

export async function runConsultingProject(input, options = {}) {
  const project = createEmptyProject(input);
  await saveProject(project);
  return runExistingProject(project, options);
}
