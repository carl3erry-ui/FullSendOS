import assert from "node:assert/strict";
import test from "node:test";
import { extractResponseText, normalizeProviderError } from "./response-parser";
import { GrokProviderError } from "./types";

test("extractResponseText returns text from nested xAI output blocks", () => {
  const response = {
    output: [
      {
        content: [
          { type: "output_text", text: "First line" },
          { type: "output_text", text: "Second line" },
        ],
      },
    ],
  };

  const text = extractResponseText(response);
  assert.equal(text, "First line\nSecond line");
});

test("normalizeProviderError classifies validation errors", () => {
  const normalized = normalizeProviderError({ status: 422, message: "bad payload" });
  assert.ok(normalized instanceof GrokProviderError);
  assert.equal(normalized.kind, "validation");
});
