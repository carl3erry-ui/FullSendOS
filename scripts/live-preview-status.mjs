import fs from "node:fs/promises";
import path from "node:path";

function summarizeFromProjectFile(projectPath, engagementId) {
  return fs
    .readFile(projectPath, "utf8")
    .then((text) => JSON.parse(text))
    .then((project) => {
      const deliverables = project.deliverables || {};
      const exportsDir = path.resolve("data/exports");
      return fs
        .readdir(exportsDir)
        .catch(() => [])
        .then(async (entries) => {
          const exportFiles = await Promise.all(
            entries.map(async (entry) => {
              if (!entry.endsWith(".json")) return null;
              try {
                const parsed = JSON.parse(await fs.readFile(path.join(exportsDir, entry), "utf8"));
                return parsed.engagementId === engagementId ? parsed : null;
              } catch {
                return null;
              }
            }),
          );

          return {
          engagementId,
          status: project.status || "unknown",
          updatedAt: project.updatedAt || null,
          terminalStateReached: ["completed", "needs-review", "failed"].includes(String(project.status || "").toLowerCase()),
          deliverables: {
            executiveReport: Boolean(deliverables.executiveReport),
            onePageSummary: Boolean(deliverables.onePageSummary),
            recommendations: Array.isArray(deliverables.recommendations) && deliverables.recommendations.length > 0,
            deckOutline: Array.isArray(deliverables.deckOutline) && deliverables.deckOutline.length > 0,
          },
          exportsAvailable: exportFiles.some(Boolean),
          clientPortalRoute: true,
          }; 
        });
    });
}

async function main() {
  const engagementId = process.argv[2];
  if (!engagementId) {
    console.error("Usage: node scripts/live-preview-status.mjs <engagementId>");
    process.exit(1);
  }

  const projectPath = path.resolve(`data/projects/${engagementId}.json`);
  try {
    const summary = await summarizeFromProjectFile(projectPath, engagementId);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ engagementId, status: "unknown", error: "Unable to read workflow status safely." }, null, 2));
    process.exit(1);
  }
}

main();
