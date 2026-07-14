import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { AgentPermissions } from "../agents/permissions";
import { addFileReference } from "./client-data-room-store";
import { upsertDataRoomDocument } from "./data-room-document-store";
import { loadDataRoomRetrievalAuditEntry } from "./data-room-retrieval-audit-store";
import { retrieveDataRoomContext } from "./data-room-retrieval-service";

function uniqueClientId(label: string) {
  return `slice13-retrieval-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function cleanupClientRetrievalData(clientId: string) {
  await rm(join(process.cwd(), "data", "clients", `${clientId}-data-room.json`), { force: true });
  await rm(join(process.cwd(), "data", "clients", `${clientId}-documents.json`), { force: true });
}

test("retrieveDataRoomContext returns bounded safe excerpts and source references", async () => {
  const clientId = uniqueClientId("safe");

  try {
    const file = await addFileReference(
      clientId,
      {
        name: "board-update.txt",
        mimeType: "text/plain",
        size: 2048,
        folderId: "investor",
        approvedForAgentUse: true,
        engagementIds: ["eng-safe"],
      },
      "test-user",
      "/internal/board-update.txt"
    );

    const extractedText =
      "Revenue increased 31 percent year-over-year. Customer retention reached 92 percent. " +
      "Operating efficiency improved with lower acquisition costs and stronger conversion outcomes.";

    await upsertDataRoomDocument(clientId, {
      fileId: file.id,
      clientId,
      engagementId: "eng-safe",
      folderId: "investor",
      originalFilename: file.name,
      displayName: "Board Update",
      mimeType: file.mimeType,
      extension: "txt",
      sourceType: "upload",
      processingStatus: "completed",
      processingStartedAt: new Date().toISOString(),
      processingCompletedAt: new Date().toISOString(),
      parserVersion: "slice13-test",
      textExtracted: extractedText,
      textPreview: "Revenue increased 31 percent year-over-year.",
      textLength: extractedText.length,
      summary: "Quarterly board update with growth, retention, and efficiency metrics.",
      keywords: ["revenue", "retention", "efficiency"],
      detectedDocumentType: "financial",
      confidence: 0.92,
      extractionWarnings: [],
      approvedForAgentUse: true,
      sensitive: false,
    });

    const result = await retrieveDataRoomContext({
      clientId,
      engagementId: "eng-safe",
      agentId: "researcher",
      agentPermissions: [AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT],
      taskId: "task-safe-1",
      query: "retention efficiency",
      documentTypes: [],
      folderIds: [],
      fileIds: [],
      keywords: [],
      maxDocuments: 3,
      maxExcerpts: 3,
      maxCharacters: 100,
      maxTotalCharacters: 300,
      includeSummaries: true,
      includePreviews: true,
      allowSensitive: false,
    });

    assert.equal(result.sources.length, 1);
    assert.equal(result.excerpts.length >= 1, true);
    assert.equal(result.excerpts[0].characterCount <= 100, true);
    assert.equal(result.excerpts[0].text.length <= 100, true);
    assert.equal(result.excerpts[0].text === extractedText, false);
    assert.match(result.sources[0].citationLabel, /^Source\s[A-Z]/);
    assert.equal(result.totalCharacters > 0, true);

    const audit = await loadDataRoomRetrievalAuditEntry(result.retrievalAuditId);
    assert.equal(audit.clientId, clientId);
    assert.equal(audit.taskId, "task-safe-1");
    assert.equal(audit.documentIds.length, 1);
  } finally {
    await cleanupClientRetrievalData(clientId);
  }
});

test("retrieveDataRoomContext skips ineligible documents and warns when none are eligible", async () => {
  const clientId = uniqueClientId("eligibility");

  try {
    const file = await addFileReference(
      clientId,
      {
        name: "sensitive-notes.txt",
        mimeType: "text/plain",
        size: 1000,
        folderId: "legal",
        approvedForAgentUse: true,
        sensitive: true,
      },
      "test-user",
      "/internal/sensitive-notes.txt"
    );

    await upsertDataRoomDocument(clientId, {
      fileId: file.id,
      clientId,
      folderId: "legal",
      originalFilename: file.name,
      displayName: "Sensitive Notes",
      mimeType: file.mimeType,
      extension: "txt",
      sourceType: "upload",
      processingStatus: "completed",
      processingStartedAt: new Date().toISOString(),
      processingCompletedAt: new Date().toISOString(),
      parserVersion: "slice13-test",
      textExtracted: "Confidential notes.",
      textPreview: "Confidential notes.",
      textLength: 19,
      summary: "Sensitive material.",
      keywords: ["confidential"],
      detectedDocumentType: "legal",
      confidence: 0.7,
      extractionWarnings: [],
      approvedForAgentUse: true,
      sensitive: true,
    });

    const result = await retrieveDataRoomContext({
      clientId,
      agentId: "researcher",
      agentPermissions: [AgentPermissions.RETRIEVE_DATA_ROOM_CONTEXT],
      taskId: "task-eligibility-1",
      query: "confidential",
      documentTypes: [],
      folderIds: [],
      fileIds: [],
      keywords: [],
      maxDocuments: 5,
      maxExcerpts: 5,
      maxCharacters: 160,
      maxTotalCharacters: 500,
      includeSummaries: true,
      includePreviews: true,
      allowSensitive: false,
    });

    assert.equal(result.sources.length, 0);
    assert.equal(result.excerpts.length, 0);
    assert.equal(result.warnings.includes("no_eligible_documents_found"), true);
    assert.equal(result.skippedDocuments.some((item) => item.reason === "sensitive_document"), true);
  } finally {
    await cleanupClientRetrievalData(clientId);
  }
});
