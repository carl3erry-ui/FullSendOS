import fs from "node:fs/promises";
import path from "node:path";

const storageDir = path.resolve("data/projects");

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

export async function saveProject(project) {
  await fs.mkdir(storageDir, { recursive: true });
  const file = path.join(storageDir, `${project.id}.json`);
  await fs.writeFile(file, JSON.stringify(project, null, 2), "utf8");
  return file;
}

export async function loadProject(id) {
  const safeId = String(id).replace(/[^A-Za-z0-9._-]/g, "");
  const file = path.join(storageDir, `${safeId}.json`);
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function listProjects() {
  await fs.mkdir(storageDir, { recursive: true });
  const files = (await fs.readdir(storageDir)).filter((name) => name.endsWith(".json"));
  const projects = await Promise.all(files.map(async (name) => {
    try {
      const project = JSON.parse(await fs.readFile(path.join(storageDir, name), "utf8"));
      return {
        id: project.id,
        companyName: project.client?.companyName || "Untitled Project",
        objective: project.brief?.objective || "",
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
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
