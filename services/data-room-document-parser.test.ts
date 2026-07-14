import assert from "node:assert/strict";
import test from "node:test";
import { parseDataRoomDocument } from "./data-room-document-parser";

test("parser extracts safe text metadata for plain text", () => {
  const result = parseDataRoomDocument({
    filename: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Quarterly revenue increased by 24 percent in Q2."),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.detectedDocumentType, "text");
  assert.equal(result.textLength > 0, true);
  assert.equal(result.summary.length > 0, true);
  assert.equal(result.keywords.length > 0, true);
});

test("parser returns unsupported for binary formats", () => {
  const result = parseDataRoomDocument({
    filename: "slides.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from("dummy"),
  });

  assert.equal(result.status, "unsupported");
  assert.match(result.summary, /not supported/i);
});

test("parser returns structured summary for CSV files", () => {
  const result = parseDataRoomDocument({
    filename: "table.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,amount\nalpha,10\nbeta,20\n"),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.detectedDocumentType, "csv");
  assert.match(result.summary, /row\(s\)/i);
});

test("parser safely normalizes JSON files", () => {
  const result = parseDataRoomDocument({
    filename: "payload.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"company":"FullSend","metrics":{"growth":42}}'),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.detectedDocumentType, "json");
  assert.equal(result.textPreview.length > 0, true);
});
