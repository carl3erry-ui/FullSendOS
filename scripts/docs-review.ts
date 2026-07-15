#!/usr/bin/env node
/**
 * FullSendOS Documentation Review CLI
 * Run: node --import tsx scripts/docs-review.ts
 *
 * This script runs the deterministic documentation reviewer and writes a
 * safe generated report to docs/generated/DOCUMENTATION_REVIEW_REPORT.md.
 *
 * The report is advisory only. Human approval is required before committing
 * any recommended documentation changes.
 *
 * No live AI calls. No secrets. No runtime data.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { runDocumentationReview } from "../services/doc-review/reviewer";
import { renderReviewReportMarkdown } from "../services/doc-review/renderer";

const OUTPUT_DIR = path.resolve("docs/generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "DOCUMENTATION_REVIEW_REPORT.md");

async function main(): Promise<void> {
  const branch =
    process.env.GITHUB_REF_NAME ||
    (await fs
      .readFile(path.resolve(".git/HEAD"), "utf8")
      .then((head) => {
        const match = head.match(/ref: refs\/heads\/(.+)/);
        return match ? match[1].trim() : "unknown";
      })
      .catch(() => "unknown"));

  console.log(`\nFullSendOS Documentation Review System`);
  console.log(`======================================`);
  console.log(`Branch: ${branch}`);
  console.log(`Running deterministic documentation review...`);
  console.log(``);

  const report = runDocumentationReview({ branch });

  console.log(`Summary: ${report.summary}`);
  console.log(``);
  console.log(`Findings:`);
  for (const finding of report.findings) {
    const prefix = finding.severity === "high" ? "❌" : finding.severity === "warning" ? "⚠️ " : "ℹ️ ";
    console.log(`  ${prefix} [${finding.id}] ${finding.title}`);
  }

  console.log(``);
  console.log(`Recommended updates: ${report.recommendedDocUpdates.length}`);
  console.log(`Deferred items: ${report.deferredItems.length}`);
  console.log(``);
  console.log(`⚠️  Guardrail: ${report.guardrail}`);
  console.log(``);

  const markdown = renderReviewReportMarkdown(report);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, markdown, "utf8");

  console.log(`Report written to: ${OUTPUT_FILE}`);
  console.log(`\nDocumentation review complete. Review the report and obtain human approval before making any recommended changes.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Documentation review failed: ${message}`);
  process.exit(1);
});
