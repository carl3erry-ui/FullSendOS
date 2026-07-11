import "dotenv/config";
import express from "express";
import { createEmptyProject } from "./schemas/projectSchema.js";
import { runExistingProject } from "./orchestrator/orchestrator.js";
import { listProjects, loadProject, saveProject } from "./storage/projectStore.js";

const app = express();
const jobs = new Map();

app.use(express.json({ limit: "3mb" }));
app.use(express.static("public"));

function markdownDownloadName(project) {
  return `${project.client.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "consulting-report"}.md`;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    providerConfigured: Boolean(process.env.XAI_API_KEY),
    model: process.env.XAI_MODEL || "grok-4.5"
  });
});

app.get("/api/projects", async (_req, res) => {
  res.json(await listProjects());
});

app.post("/api/projects", async (req, res) => {
  try {
    const project = createEmptyProject(req.body);
    await saveProject(project);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/projects/:id/run", async (req, res) => {
  try {
    if (!process.env.XAI_API_KEY) {
      return res.status(503).json({ error: "XAI_API_KEY is not configured in .env." });
    }

    const project = await loadProject(req.params.id);
    if (jobs.has(project.id)) {
      return res.status(409).json({ error: "This project is already running." });
    }

    const job = runExistingProject(project)
      .catch((error) => console.error(`Project ${project.id} failed:`, error))
      .finally(() => jobs.delete(project.id));

    jobs.set(project.id, job);
    res.status(202).json({ id: project.id, status: "running" });
  } catch (error) {
    res.status(404).json({ error: error.message || "Project not found." });
  }
});

app.post("/api/projects/run", async (req, res) => {
  try {
    if (!process.env.XAI_API_KEY) {
      return res.status(503).json({ error: "XAI_API_KEY is not configured in .env." });
    }
    const project = createEmptyProject(req.body);
    await saveProject(project);
    const job = runExistingProject(project)
      .catch((error) => console.error(`Project ${project.id} failed:`, error))
      .finally(() => jobs.delete(project.id));
    jobs.set(project.id, job);
    res.status(202).json({ id: project.id, status: "running" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    res.json(await loadProject(req.params.id));
  } catch {
    res.status(404).json({ error: "Project not found." });
  }
});

app.get("/api/projects/:id/report.md", async (req, res) => {
  try {
    const project = await loadProject(req.params.id);
    const report = project.deliverables?.executiveReport || "Report has not been generated yet.";
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${markdownDownloadName(project)}"`);
    res.send(report);
  } catch {
    res.status(404).send("Project not found.");
  }
});

app.get("/api/projects/:id/project.json", async (req, res) => {
  try {
    const project = await loadProject(req.params.id);
    res.setHeader("Content-Disposition", `attachment; filename="${project.id}.json"`);
    res.json(project);
  } catch {
    res.status(404).json({ error: "Project not found." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Consulting OS running at http://localhost:${port}`);
});
