import fs from "node:fs/promises";
import path from "node:path";

const storageDir = path.resolve("data/projects");

function isVisibleByLifecycle(project, options = {}) {
  const lifecycleStatus = project?.lifecycleStatus || "active";
  if (options.includeAll) return true;
  if (lifecycleStatus === "archived") return Boolean(options.includeArchived);
  if (lifecycleStatus === "deleted") return Boolean(options.includeDeleted);
  return true;
}

function computeCompletedDepartments(project) {
  const runs = Array.isArray(project?.audit?.runs) ? project.audit.runs : [];
  const departmentKeys = Object.keys(project?.departments || {});

  if (!runs.length) {
    return Object.values(project?.departments || {}).filter(Boolean).length;
  }

  let latestAttemptStart = runs.length - 1;
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    if (runs[index]?.department === "research") {
      latestAttemptStart = index;
      break;
    }
  }

  const latestAttemptRuns = runs.slice(latestAttemptStart);
  const latestStatusByDepartment = {};

  for (const run of latestAttemptRuns) {
    if (!run?.department) continue;
    latestStatusByDepartment[run.department] = run.status;
  }

  const counted = departmentKeys.filter((department) => {
    const status = latestStatusByDepartment[department];
    return status === "complete" || status === "repaired";
  }).length;

  if (counted > 0 || project?.status === "failed" || project?.status === "running") {
    return counted;
  }

  return Object.values(project?.departments || {}).filter(Boolean).length;
}

function getLastRunError(project) {
  const failedRun = [...(project?.audit?.runs || [])].reverse().find((run) => run?.status === "failed" && typeof run?.error === "string");
  if (failedRun?.error) return failedRun.error;

  const warnings = Array.isArray(project?.audit?.warnings) ? project.audit.warnings : [];
  const warning = warnings[warnings.length - 1];
  return typeof warning === "string" ? warning : null;
}

export async function saveProject(project) {
  await fs.mkdir(storageDir, { recursive: true });
  const file = path.join(storageDir, `${project.id}.json`);
  const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempFile, JSON.stringify(project, null, 2), "utf8");
  await fs.rename(tempFile, file);
  return file;
}

export async function loadProject(id) {
  const safeId = String(id).replace(/[^A-Za-z0-9._-]/g, "");
  const file = path.join(storageDir, `${safeId}.json`);
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function listProjects(options = {}) {
  await fs.mkdir(storageDir, { recursive: true });
  const files = (await fs.readdir(storageDir)).filter((name) => name.endsWith(".json"));
  const projects = await Promise.all(files.map(async (name) => {
    try {
      const project = JSON.parse(await fs.readFile(path.join(storageDir, name), "utf8"));
      if (!isVisibleByLifecycle(project, options)) {
        return null;
      }
      return {
        id: project.id,
        clientId: project.clientId || null,
        companyName: project.client?.companyName || "Untitled Project",
        objective: project.brief?.objective || "",
        status: project.status,
        lifecycleStatus: project.lifecycleStatus || "active",
        archivedAt: project.archivedAt || null,
        deletedAt: project.deletedAt || null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        activeRunId: project.audit?.activeRun?.id || null,
        activeRunUpdatedAt: project.audit?.activeRun?.updatedAt || null,
        lastRunError: getLastRunError(project),
        completedDepartments: computeCompletedDepartments(project),
        totalDepartments: Object.keys(project.departments || {}).length
      };
    } catch {
      return null;
    }
  }));

  return projects
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function updateProjectLifecycle(id, action) {
  const current = await loadProject(id);
  const now = new Date().toISOString();

  const next = {
    ...current,
    lifecycleStatus:
      action === "archive"
        ? "archived"
        : action === "delete"
          ? "deleted"
          : "active",
    archivedAt: action === "archive" ? now : undefined,
    deletedAt: action === "delete" ? now : undefined,
    updatedAt: now,
  };

  await saveProject(next);
  return next;
}
