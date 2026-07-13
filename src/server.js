import "dotenv/config";
import express from "express";
import { createEmptyProject } from "./schemas/projectSchema.js";
import { runExistingProject } from "./orchestrator/orchestrator.js";
import { listProjects, loadProject, saveProject } from "./storage/projectStore.js";
import {
  loadDataRoom, saveDataRoom, dataRoomExists,
  loadFolders, saveFolder, loadFolder,
  listFileMetas, loadFileMeta, saveFileMeta, deleteFileMeta, fileMetaExists,
  recountDataRoom,
  DataRoomSchema, DataRoomFolderSchema, DataRoomFileSchema
} from "./storage/dataRoomStore.js";
import { validateFileType, sanitizeFilename, getExtension } from "./utils/filePolicy.js";
import { writeFileToStorage, deleteFileFromStorage, computeChecksum } from "./utils/fileStorage.js";
import { DEFAULT_FOLDERS } from "./utils/defaultFolders.js";

const app = express();
const jobs = new Map();

app.use(express.json({ limit: "3mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "102mb" }));
app.use(express.static("public"));

// Fields that may be updated via PATCH on a file record
const FILE_PATCH_FIELDS = ["displayName", "description", "tags", "status", "visibility", "approvedForAgentUse", "sensitive"];

// Normalize a query parameter that Express may parse as a string or array
function queryString(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

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

// ──────────────────────────────────────────────────────────────────────────────
// Helper: safe public file metadata (no absolute storage paths)
// ──────────────────────────────────────────────────────────────────────────────

function safeFileMeta(fileMeta) {
  const { storagePath: _omit, ...safe } = fileMeta;
  return safe;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: ensure data room exists for a project, creating it if needed
// ──────────────────────────────────────────────────────────────────────────────

async function getOrCreateDataRoom(clientId) {
  if (await dataRoomExists(clientId)) {
    return loadDataRoom(clientId);
  }
  const now = new Date().toISOString();
  const roomId = `DR-${clientId}`;
  const dataRoom = DataRoomSchema.parse({
    id: roomId,
    clientId,
    name: "Client Data Room",
    description: "Source materials and documents for this engagement.",
    createdAt: now,
    updatedAt: now,
    folderCount: 0,
    fileCount: 0
  });
  await saveDataRoom(dataRoom);

  // Create default folders
  for (const def of DEFAULT_FOLDERS) {
    const folder = DataRoomFolderSchema.parse({
      id: `${roomId}-${def.slug}`,
      clientId,
      dataRoomId: roomId,
      name: def.name,
      slug: def.slug,
      description: def.description,
      category: def.category,
      sortOrder: def.sortOrder,
      createdAt: now,
      updatedAt: now
    });
    await saveFolder(folder);
  }

  const counts = await recountDataRoom(clientId, roomId);
  dataRoom.folderCount = counts.folderCount;
  dataRoom.fileCount = counts.fileCount;
  dataRoom.updatedAt = now;
  await saveDataRoom(dataRoom);
  return dataRoom;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: validate that project (clientId) exists
// ──────────────────────────────────────────────────────────────────────────────

async function requireProject(clientId, res) {
  try {
    return await loadProject(clientId);
  } catch {
    res.status(404).json({ error: "Client project not found." });
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Data Room API routes
// ──────────────────────────────────────────────────────────────────────────────

// GET /api/projects/:clientId/data-room
app.get("/api/projects/:clientId/data-room", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;
    const dataRoom = await getOrCreateDataRoom(req.params.clientId);
    const counts = await recountDataRoom(req.params.clientId, dataRoom.id);
    dataRoom.folderCount = counts.folderCount;
    dataRoom.fileCount = counts.fileCount;
    res.json(dataRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:clientId/data-room/folders
app.get("/api/projects/:clientId/data-room/folders", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;
    await getOrCreateDataRoom(req.params.clientId);
    const folders = await loadFolders(req.params.clientId);
    res.json(folders.sort((a, b) => a.sortOrder - b.sortOrder));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:clientId/data-room/folders
app.post("/api/projects/:clientId/data-room/folders", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;
    const dataRoom = await getOrCreateDataRoom(req.params.clientId);
    const now = new Date().toISOString();
    const { name, description, category, slug } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required." });

    const safeSlug = (slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "folder";

    const folders = await loadFolders(req.params.clientId);
    const maxOrder = folders.reduce((m, f) => Math.max(m, f.sortOrder), -1);

    const folder = DataRoomFolderSchema.parse({
      id: `${dataRoom.id}-${safeSlug}-${Date.now()}`,
      clientId: req.params.clientId,
      dataRoomId: dataRoom.id,
      name,
      slug: safeSlug,
      description: description || "",
      category: category || "general",
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    });
    await saveFolder(folder);
    res.status(201).json(folder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/projects/:clientId/data-room/files
app.get("/api/projects/:clientId/data-room/files", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;
    const folderId = queryString(req.query.folderId);
    const files = await listFileMetas(req.params.clientId, folderId);
    res.json(files.map(safeFileMeta));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:clientId/data-room/files/:fileId
app.get("/api/projects/:clientId/data-room/files/:fileId", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;
    const fileMeta = await loadFileMeta(req.params.clientId, req.params.fileId);
    res.json(safeFileMeta(fileMeta));
  } catch {
    res.status(404).json({ error: "File not found." });
  }
});

// POST /api/projects/:clientId/data-room/files
// Accepts:
//   - application/octet-stream with headers:
//       x-file-name: original filename
//       x-folder-id: target folder id
//       x-display-name: optional display name
//       x-description: optional description
//       x-engagement-id: optional engagement id
//       x-tags: comma-separated tags
//   - application/json for metadata-only registration (no binary)
app.post("/api/projects/:clientId/data-room/files", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;
    const dataRoom = await getOrCreateDataRoom(req.params.clientId);
    const contentType = req.headers["content-type"] || "";
    const now = new Date().toISOString();

    let originalFilename, folderId, displayName, description, engagementId, tags;
    let fileBuffer = null;
    let sizeBytes = 0;

    if (contentType.startsWith("application/octet-stream")) {
      // Binary file upload
      originalFilename = req.headers["x-file-name"] || "unnamed";
      folderId = req.headers["x-folder-id"] || "";
      displayName = req.headers["x-display-name"] || "";
      description = req.headers["x-description"] || "";
      engagementId = req.headers["x-engagement-id"] || "";
      tags = (req.headers["x-tags"] || "").split(",").map((t) => t.trim()).filter(Boolean);
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: "Binary upload requires application/octet-stream body." });
      }
      fileBuffer = req.body;
      sizeBytes = fileBuffer.length;
    } else {
      // JSON metadata registration (no binary content)
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      originalFilename = String(body.originalFilename || body.filename || "unnamed");
      folderId = String(body.folderId || "");
      displayName = String(body.displayName || "");
      description = String(body.description || "");
      engagementId = String(body.engagementId || "");
      tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
      sizeBytes = Number(body.sizeBytes) || 0;
    }

    if (!folderId) return res.status(400).json({ error: "folderId is required." });

    // Validate folder exists
    let folder;
    try {
      folder = await loadFolder(req.params.clientId, folderId);
    } catch {
      return res.status(404).json({ error: "Folder not found." });
    }

    // Validate file type
    const typeCheck = validateFileType(originalFilename, sizeBytes);
    if (!typeCheck.ok) return res.status(422).json({ error: typeCheck.reason });

    const safeFilename = sanitizeFilename(originalFilename);
    const fileId = `FILE-${req.params.clientId}-${Date.now()}`;
    let storagePath = "";
    let checksum;
    let sourceType = "registered";

    if (fileBuffer && fileBuffer.length > 0) {
      storagePath = await writeFileToStorage(req.params.clientId, fileId, safeFilename, fileBuffer);
      checksum = computeChecksum(fileBuffer);
      sourceType = "upload";
    }

    const fileMeta = DataRoomFileSchema.parse({
      id: fileId,
      clientId: req.params.clientId,
      dataRoomId: dataRoom.id,
      folderId: folder.id,
      engagementId: engagementId || undefined,
      originalFilename,
      displayName: displayName || safeFilename,
      mimeType: typeCheck.mimeType || "application/octet-stream",
      extension: typeCheck.extension || getExtension(originalFilename),
      sizeBytes,
      storagePath,
      uploadedBy: "admin",
      uploadedAt: now,
      updatedAt: now,
      description: description || undefined,
      tags,
      status: "uploaded",
      visibility: "internal",
      approvedForAgentUse: false,
      sensitive: false,
      sourceType,
      checksum,
      metadata: {}
    });

    await saveFileMeta(fileMeta);
    res.status(201).json(safeFileMeta(fileMeta));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/projects/:clientId/data-room/files/:fileId
app.patch("/api/projects/:clientId/data-room/files/:fileId", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;

    const exists = await fileMetaExists(req.params.clientId, req.params.fileId);
    if (!exists) return res.status(404).json({ error: "File not found." });

    const fileMeta = await loadFileMeta(req.params.clientId, req.params.fileId);
    const body = req.body || {};

    for (const key of FILE_PATCH_FIELDS) {
      if (key in body) fileMeta[key] = body[key];
    }
    fileMeta.updatedAt = new Date().toISOString();

    // Validate the updated record
    DataRoomFileSchema.parse(fileMeta);
    await saveFileMeta(fileMeta);
    res.json(safeFileMeta(fileMeta));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/projects/:clientId/data-room/files/:fileId
app.delete("/api/projects/:clientId/data-room/files/:fileId", async (req, res) => {
  try {
    const project = await requireProject(req.params.clientId, res);
    if (!project) return;

    const exists = await fileMetaExists(req.params.clientId, req.params.fileId);
    if (!exists) return res.status(404).json({ error: "File not found." });

    const fileMeta = await loadFileMeta(req.params.clientId, req.params.fileId);
    if (fileMeta.storagePath) {
      await deleteFileFromStorage(fileMeta.storagePath);
    }
    await deleteFileMeta(req.params.clientId, req.params.fileId);
    res.json({ deleted: true, id: req.params.fileId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Consulting OS running at http://localhost:${port}`);
});
