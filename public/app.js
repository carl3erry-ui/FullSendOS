const DEPARTMENTS = [
  ["research", "Market Research", "Sourced market context"],
  ["competitors", "Competitive Intelligence", "Competitor matrix and whitespace"],
  ["customers", "Customer Intelligence", "Personas and customer journey"],
  ["strategy", "Growth Strategy", "Positioning and 90-day plan"],
  ["brand", "Brand Strategy", "Voice, messaging, visual direction"],
  ["website", "Digital Experience", "Sitemap and conversion wireframe"],
  ["publishing", "Executive Publishing", "Unified client deliverables"]
];

const state = {
  projects: [],
  activeProject: null,
  pollTimer: null,
  activePage: "projects"
};

const $ = (id) => document.getElementById(id);
const dialog = $("projectDialog");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown = "") {
  const lines = String(markdown).replace(/\r/g, "").split("\n");
  let html = "";
  let listType = null;
  let tableRows = [];

  const closeList = () => {
    if (listType) html += `</${listType}>`;
    listType = null;
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const parsed = tableRows.map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));
    const dividerIndex = parsed.findIndex((row) => row.every((cell) => /^:?-{3,}:?$/.test(cell)));
    if (dividerIndex === 1) {
      html += "<table><thead><tr>" + parsed[0].map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("") + "</tr></thead><tbody>";
      html += parsed.slice(2).map((row) => "<tr>" + row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("") + "</tr>").join("");
      html += "</tbody></table>";
    } else {
      html += tableRows.map((row) => `<p>${inlineMarkdown(row)}</p>`).join("");
    }
    tableRows = [];
  };

  for (const line of lines) {
    if (/^\|.*\|\s*$/.test(line)) {
      closeList();
      tableRows.push(line);
      continue;
    }
    flushTable();

    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 3);
      html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
      continue;
    }
    const unordered = line.match(/^\s*[-*]\s+(.+)/);
    if (unordered) {
      if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
      html += `<li>${inlineMarkdown(unordered[1])}</li>`;
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (ordered) {
      if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; }
      html += `<li>${inlineMarkdown(ordered[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  flushTable();
  closeList();
  return html;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function checkHealth() {
  const card = $("providerCard");
  try {
    const health = await request("/api/health");
    const dot = card.querySelector(".status-dot");
    dot.classList.toggle("ok", health.providerConfigured);
    dot.classList.toggle("bad", !health.providerConfigured);
    card.querySelector("strong").textContent = health.providerConfigured ? "xAI connected" : "xAI key needed";
    card.querySelector("small").textContent = health.providerConfigured ? health.model : "Add XAI_API_KEY to .env";
  } catch {
    card.querySelector("strong").textContent = "Server unavailable";
    card.querySelector(".status-dot").classList.add("bad");
  }
}

async function loadProjects() {
  state.projects = await request("/api/projects");
  renderProjectList();
  if (!state.activeProject && state.projects.length) await openProject(state.projects[0].id);
  if (!state.projects.length) showEmpty();
}

function renderProjectList() {
  const list = $("projectList");
  if (!state.projects.length) {
    list.innerHTML = '<div class="muted">No projects yet</div>';
    return;
  }
  list.innerHTML = state.projects.map((project) => `
    <button data-project-id="${escapeHtml(project.id)}" class="${state.activeProject?.id === project.id ? "active" : ""}">
      ${escapeHtml(project.companyName)}
    </button>`).join("");
  list.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => openProject(button.dataset.projectId)));
}

function showEmpty() {
  $("emptyState").classList.remove("hidden");
  $("projectView").classList.add("hidden");
  $("methodView").classList.add("hidden");
  $("pageTitle").textContent = "Projects";
}

async function openProject(id) {
  clearInterval(state.pollTimer);
  state.activeProject = await request(`/api/projects/${encodeURIComponent(id)}`);
  state.activePage = "projects";
  $("emptyState").classList.add("hidden");
  $("methodView").classList.add("hidden");
  $("projectView").classList.remove("hidden");
  $("pageTitle").textContent = "Engagement";
  renderProject();
  renderProjectList();
  if (state.activeProject.status === "running") startPolling();
}

function getAuditStatus(project, name) {
  const run = [...(project.audit?.runs || [])].reverse().find((item) => item.department === name);
  if (run) return run.status;
  return project.departments?.[name] ? "complete" : "pending";
}

function collectUnknowns(project) {
  return DEPARTMENTS.flatMap(([name, label]) => (project.departments?.[name]?.unknowns || []).map((item) => ({ ...item, department: label })));
}

function renderProject() {
  const project = state.activeProject;
  if (!project) return;
  const completed = DEPARTMENTS.filter(([name]) => Boolean(project.departments?.[name])).length;
  const percent = Math.round(completed / DEPARTMENTS.length * 100);
  const unknowns = collectUnknowns(project);

  $("projectName").textContent = project.client.companyName;
  $("projectObjective").textContent = project.brief.objective;
  $("projectId").textContent = project.id;
  $("projectStatus").textContent = project.status.replaceAll("-", " ");
  $("projectStatus").className = `status-badge ${project.status}`;
  $("completionMetric").textContent = `${percent}%`;
  $("completionBar").style.width = `${percent}%`;
  $("departmentMetric").textContent = `${completed} / ${DEPARTMENTS.length}`;
  $("sourceMetric").textContent = project.evidence?.sources?.length || 0;
  $("unknownMetric").textContent = unknowns.length;
  $("lastUpdated").textContent = `Updated ${new Date(project.updatedAt).toLocaleString()}`;

  const running = project.status === "running";
  $("runProjectButton").disabled = running;
  $("runProjectButton").textContent = running ? "Departments running…" : completed ? "Run again" : "Run departments";
  $("downloadReport").href = `/api/projects/${encodeURIComponent(project.id)}/report.md`;
  $("downloadJson").href = `/api/projects/${encodeURIComponent(project.id)}/project.json`;
  $("downloadReport").classList.toggle("disabled", !project.deliverables?.executiveReport);

  $("departmentTimeline").innerHTML = DEPARTMENTS.map(([name, label, description], index) => {
    const status = getAuditStatus(project, name);
    const icon = status === "complete" || status === "repaired" ? "✓" : status === "running" ? "•" : status === "failed" ? "!" : index + 1;
    return `<div class="timeline-item ${status}"><span class="timeline-icon">${icon}</span><div><b>${label}</b><small>${description}</small></div><span class="muted">${status}</span></div>`;
  }).join("");

  const warnings = project.audit?.warnings || [];
  $("warningBox").classList.toggle("hidden", !warnings.length);
  $("warningBox").textContent = warnings.join(" • ");

  const report = project.deliverables?.executiveReport;
  $("reportContent").innerHTML = report ? renderMarkdown(report) : '<div class="report-placeholder">Run the project to generate the executive report.</div>';

  $("workspaceAccordion").innerHTML = DEPARTMENTS.map(([name, label]) => {
    const output = project.departments?.[name];
    return `<article class="accordion-item"><button class="accordion-button"><span><b>${label}</b><br><small>${output ? escapeHtml(output.summary || "Validated output") : "Not generated"}</small></span><span>+</span></button><div class="accordion-content"><div class="json-view">${escapeHtml(output ? JSON.stringify(output, null, 2) : "No output yet.")}</div></div></article>`;
  }).join("");
  document.querySelectorAll(".accordion-button").forEach((button) => button.addEventListener("click", () => button.parentElement.classList.toggle("open")));

  const sources = project.evidence?.sources || [];
  $("sourceTable").innerHTML = sources.length ? `<table class="data-table"><thead><tr><th>ID</th><th>Source</th><th>Type</th><th>Notes</th></tr></thead><tbody>${sources.map((source) => `<tr><td>${escapeHtml(source.id)}</td><td>${escapeHtml(source.title)}</td><td>${escapeHtml(source.sourceType)}</td><td>${escapeHtml(source.notes || "")}</td></tr>`).join("")}</tbody></table>` : '<p>No sources registered.</p>';

  $("unknownList").innerHTML = unknowns.length ? unknowns.map((item) => `<div class="unknown-card"><span class="eyebrow">${escapeHtml(item.department)}</span><b>${escapeHtml(item.question)}</b><p>${escapeHtml(item.whyItMatters)}</p><p><strong>Validate:</strong> ${escapeHtml(item.recommendedMethod)}</p></div>`).join("") : '<p>No open unknowns recorded.</p>';
}

async function runProject() {
  if (!state.activeProject) return;
  try {
    await request(`/api/projects/${encodeURIComponent(state.activeProject.id)}/run`, { method: "POST" });
    state.activeProject.status = "running";
    renderProject();
    startPolling();
    showToast("Consulting departments launched");
  } catch (error) {
    showToast(error.message);
  }
}

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    try {
      state.activeProject = await request(`/api/projects/${encodeURIComponent(state.activeProject.id)}`);
      renderProject();
      if (state.activeProject.status !== "running") {
        clearInterval(state.pollTimer);
        await loadProjects();
        showToast(state.activeProject.status === "failed" ? "Project failed — review warnings" : "Client deliverables ready");
      }
    } catch (error) {
      clearInterval(state.pollTimer);
      showToast(error.message);
    }
  }, 2500);
}

function openDialog() {
  dialog.showModal();
  $("companyName").focus();
}

async function createProject(event) {
  event.preventDefault();
  const companyName = $("companyName").value.trim();
  const objective = $("objective").value.trim();
  const context = $("context").value.trim();
  const geography = $("geography").value.split(",").map((value) => value.trim()).filter(Boolean);
  const audience = $("audience").value.split(",").map((value) => value.trim()).filter(Boolean);
  const constraints = $("constraints").value.split("\n").map((value) => value.trim()).filter(Boolean);

  try {
    const project = await request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        industry: $("industry").value.trim() || undefined,
        objective,
        geography,
        audience,
        constraints,
        requestedDeliverables: ["executive-report", "one-page-summary", "pitch-deck-outline"],
        knownFacts: context ? [context] : [],
        clientProvidedContext: context,
        sources: [{
          id: "SRC-CLIENT-001",
          title: "Client-provided engagement brief",
          sourceType: "client-provided",
          notes: context || "Project details entered by the engagement owner."
        }]
      })
    });
    dialog.close();
    $("projectForm").reset();
    await loadProjects();
    await openProject(project.id);
    showToast("Engagement created");
  } catch (error) {
    showToast(error.message);
  }
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
  $(`tab-${name}`).classList.remove("hidden");
  if (name === "dataroom" && state.activeProject) loadDataRoom();
}

function showMethod() {
  clearInterval(state.pollTimer);
  state.activePage = "method";
  $("emptyState").classList.add("hidden");
  $("projectView").classList.add("hidden");
  $("methodView").classList.remove("hidden");
  $("pageTitle").textContent = "Method";
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === "method"));
}

function showProjectsPage() {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === "projects"));
  if (state.activeProject) openProject(state.activeProject.id); else showEmpty();
}

function renderMethod() {
  $("methodGrid").innerHTML = DEPARTMENTS.map(([name, label, description], index) => `<div class="method-card"><span>0${index + 1}</span><h3>${label}</h3><p>${description}</p><small class="muted">Writes project.departments.${name}</small></div>`).join("");
}

$("newProjectButton").addEventListener("click", openDialog);
$("headerNewButton").addEventListener("click", openDialog);
$("heroNewButton").addEventListener("click", openDialog);
$("closeDialog").addEventListener("click", () => dialog.close());
$("cancelDialog").addEventListener("click", () => dialog.close());
$("projectForm").addEventListener("submit", createProject);
$("runProjectButton").addEventListener("click", runProject);
$("refreshButton").addEventListener("click", async () => { await loadProjects(); showToast("Projects refreshed"); });
$("printButton").addEventListener("click", () => window.print());
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => item.dataset.page === "method" ? showMethod() : showProjectsPage()));

// ──────────────────────────────────────────────────────────────────────────────
// Data Room
// ──────────────────────────────────────────────────────────────────────────────

const drState = {
  dataRoom: null,
  folders: [],
  files: [],
  activeFolderId: null
};

const drDialog = $("drRegisterDialog");

async function loadDataRoom() {
  if (!state.activeProject) return;
  const clientId = encodeURIComponent(state.activeProject.id);
  try {
    const [dataRoom, folders] = await Promise.all([
      request(`/api/projects/${clientId}/data-room`),
      request(`/api/projects/${clientId}/data-room/folders`)
    ]);
    drState.dataRoom = dataRoom;
    drState.folders = folders;
    $("drRoomName").textContent = dataRoom.name;
    renderDrFolders();
    if (folders.length > 0) {
      await selectDrFolder(folders[0].id);
    } else {
      renderDrFiles([]);
    }
  } catch (error) {
    $("drFolderList").innerHTML = `<div class="muted">${escapeHtml(error.message)}</div>`;
  }
}

function renderDrFolders() {
  const list = $("drFolderList");
  if (!drState.folders.length) {
    list.innerHTML = '<div class="muted">No folders yet.</div>';
    return;
  }
  list.innerHTML = drState.folders.map((folder) => `
    <button class="dr-folder-item ${drState.activeFolderId === folder.id ? "active" : ""}" data-folder-id="${escapeHtml(folder.id)}">
      <span class="dr-folder-icon">📁</span>
      <span>${escapeHtml(folder.name)}</span>
    </button>
  `).join("");
  list.querySelectorAll(".dr-folder-item").forEach((btn) => {
    btn.addEventListener("click", () => selectDrFolder(btn.dataset.folderId));
  });
}

async function selectDrFolder(folderId) {
  drState.activeFolderId = folderId;
  const folder = drState.folders.find((f) => f.id === folderId);
  if (!folder) return;

  $("drFolderEyebrow").textContent = folder.category || "folder";
  $("drFolderTitle").textContent = folder.name;
  $("drFolderDescription").textContent = folder.description || "";
  $("drUploadButton").style.display = "";
  renderDrFolders();

  try {
    const clientId = encodeURIComponent(state.activeProject.id);
    const files = await request(`/api/projects/${clientId}/data-room/files?folderId=${encodeURIComponent(folderId)}`);
    drState.files = files;
    renderDrFiles(files);
  } catch (error) {
    $("drFileList").innerHTML = `<div class="muted">${escapeHtml(error.message)}</div>`;
  }
}

function renderDrFiles(files) {
  const container = $("drFileList");
  if (!files.length) {
    container.innerHTML = `
      <div class="dr-empty-state">
        <p class="eyebrow">No files yet</p>
        <p>No files have been added to this client data room yet.<br>
        Upload financials, brand assets, legal documents, real estate files, or other source materials.</p>
        <button class="primary" id="drEmptyUploadButton">+ Add file</button>
      </div>`;
    const emptyBtn = $("drEmptyUploadButton");
    if (emptyBtn) emptyBtn.addEventListener("click", openDrRegisterDialog);
    return;
  }

  container.innerHTML = `
    <table class="data-table dr-file-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Size</th>
          <th>Status</th>
          <th>Agent</th>
          <th>Sensitive</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${files.map((file) => `
          <tr data-file-id="${escapeHtml(file.id)}">
            <td>
              <b>${escapeHtml(file.displayName)}</b>
              <br><small class="muted">${escapeHtml(file.originalFilename)}</small>
              ${file.description ? `<br><small class="muted">${escapeHtml(file.description)}</small>` : ""}
            </td>
            <td><span class="dr-ext-badge">${escapeHtml(file.extension.toUpperCase() || "—")}</span></td>
            <td class="muted">${file.sizeBytes > 0 ? formatBytes(file.sizeBytes) : "—"}</td>
            <td><span class="status-badge ${escapeHtml(file.status)}">${escapeHtml(file.status)}</span></td>
            <td>${file.approvedForAgentUse ? '<span class="dr-flag approved">✓ Approved</span>' : '<span class="dr-flag">—</span>'}</td>
            <td>${file.sensitive ? '<span class="dr-flag sensitive">⚠ Sensitive</span>' : '<span class="dr-flag">—</span>'}</td>
            <td>
              <button class="ghost small dr-toggle-agent" data-id="${escapeHtml(file.id)}" data-value="${file.approvedForAgentUse}" title="Toggle agent approval">Agent</button>
              <button class="ghost small dr-delete-file" data-id="${escapeHtml(file.id)}" title="Delete file">✕</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  container.querySelectorAll(".dr-toggle-agent").forEach((btn) => {
    btn.addEventListener("click", () => toggleAgentApproval(btn.dataset.id, btn.dataset.value === "true"));
  });
  container.querySelectorAll(".dr-delete-file").forEach((btn) => {
    btn.addEventListener("click", () => deleteDrFile(btn.dataset.id));
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function toggleAgentApproval(fileId, current) {
  if (!state.activeProject) return;
  try {
    const clientId = encodeURIComponent(state.activeProject.id);
    await request(`/api/projects/${clientId}/data-room/files/${encodeURIComponent(fileId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedForAgentUse: !current })
    });
    await selectDrFolder(drState.activeFolderId);
    showToast(!current ? "Approved for agent use" : "Agent approval removed");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteDrFile(fileId) {
  if (!state.activeProject) return;
  if (!confirm("Delete this file record? This cannot be undone.")) return;
  try {
    const clientId = encodeURIComponent(state.activeProject.id);
    await request(`/api/projects/${clientId}/data-room/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
    await selectDrFolder(drState.activeFolderId);
    showToast("File deleted");
  } catch (error) {
    showToast(error.message);
  }
}

function openDrRegisterDialog() {
  $("drRegisterForm").reset();
  drDialog.showModal();
  $("drFilename").focus();
}

async function registerDrFile(event) {
  event.preventDefault();
  if (!state.activeProject || !drState.activeFolderId) return;

  const originalFilename = $("drFilename").value.trim();
  const displayName = $("drDisplayName").value.trim();
  const description = $("drDescription").value.trim();
  const tagsRaw = $("drTags").value.trim();
  const sensitive = $("drSensitive").checked;
  const approvedForAgentUse = $("drApprovedForAgent").checked;
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  try {
    const clientId = encodeURIComponent(state.activeProject.id);
    await request(`/api/projects/${clientId}/data-room/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename,
        displayName: displayName || originalFilename,
        folderId: drState.activeFolderId,
        description: description || undefined,
        tags,
        sensitive,
        approvedForAgentUse
      })
    });
    drDialog.close();
    await selectDrFolder(drState.activeFolderId);
    showToast("File registered");
  } catch (error) {
    showToast(error.message);
  }
}

$("drUploadButton").addEventListener("click", openDrRegisterDialog);
$("drCloseDialog").addEventListener("click", () => drDialog.close());
$("drCancelDialog").addEventListener("click", () => drDialog.close());
$("drRegisterForm").addEventListener("submit", registerDrFile);

renderMethod();
await Promise.all([checkHealth(), loadProjects()]);
