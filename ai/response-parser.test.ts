import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { extractResponseText, normalizeProviderError } from "./response-parser";
import { GrokProviderError } from "./types";
import { parseStructuredJson } from "./response-parser";

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

test("extractResponseText supports modern xAI responses payload variants", () => {
  const response = {
    model: "grok-4.5",
    usage: {
      input_tokens: null,
      output_tokens: 12,
      total_tokens: 12,
    },
    output: [
      {
        type: "reasoning",
        status: "completed",
      },
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: "GROK_PROVIDER_OK",
            annotations: [],
          },
        ],
      },
    ],
  };

  const text = extractResponseText(response);
  assert.equal(text, "GROK_PROVIDER_OK");
});

test("parseStructuredJson parses plain JSON safely", () => {
  const schema = z.object({ ok: z.boolean() });
  const parsed = parseStructuredJson('{"ok":true}', schema);
  assert.equal(parsed.ok, true);
});

test("parseStructuredJson parses markdown-fenced JSON safely", () => {
  const schema = z.object({ ok: z.boolean(), message: z.string() });
  const parsed = parseStructuredJson('```json\n{"ok":true,"message":"fine"}\n```', schema);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.message, "fine");
});

test("parseStructuredJson fails safely on invalid JSON", () => {
  const schema = z.object({ ok: z.boolean() });

  assert.throws(
    () => parseStructuredJson("not-json", schema),
    (error: unknown) => {
      assert.ok(error instanceof GrokProviderError);
      assert.equal(error.kind, "validation");
      assert.match(error.message, /not valid json/i);
      return true;
    },
  );
});
