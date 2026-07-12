import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { createGrokClient } from "./grok-client";
import { GrokProviderError } from "./types";

test("generateText returns normalized response for successful provider output", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        id: "resp_1",
        model: "grok-4.5",
        output_text: "Hello from xAI",
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      }),
      {
        status: 200,
        headers: { "x-request-id": "req_123" },
      },
    );

  const client = createGrokClient({ apiKey: "test-key", fetchImpl });
  const response = await client.generateText({ userPrompt: "Hi" });

  assert.equal(response.text, "Hello from xAI");
  assert.equal(response.provider, "xai");
  assert.equal(response.model, "grok-4.5");
  assert.equal(response.requestId, "req_123");
  assert.equal(response.usage?.totalTokens, 30);
});

test("generateStructuredResult fails clearly on malformed JSON", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ output_text: "not-json" }), { status: 200 });

  const client = createGrokClient({ apiKey: "test-key", fetchImpl });

  await assert.rejects(
    () => client.generateStructuredResult({ userPrompt: "Hi" }, z.object({ ok: z.boolean() })),
    (error: unknown) => {
      assert.ok(error instanceof GrokProviderError);
      assert.equal(error.kind, "validation");
      assert.match(error.message, /not valid JSON/i);
      return true;
    },
  );
});

test("generateText maps 401 to authentication error", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: "invalid key" } }), { status: 401 });

  const client = createGrokClient({ apiKey: "bad-key", fetchImpl });

  await assert.rejects(
    () => client.generateText({ userPrompt: "Hi" }),
    (error: unknown) => {
      assert.ok(error instanceof GrokProviderError);
      assert.equal(error.kind, "authentication");
      return true;
    },
  );
});

test("generateText maps 429 to rate limit error", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 });

  const client = createGrokClient({ apiKey: "test-key", fetchImpl });

  await assert.rejects(
    () => client.generateText({ userPrompt: "Hi" }),
    (error: unknown) => {
      assert.ok(error instanceof GrokProviderError);
      assert.equal(error.kind, "rate_limit");
      return true;
    },
  );
});

test("generateText maps abort to timeout error", async () => {
  const fetchImpl: typeof fetch = async (_url, init) =>
    new Promise((_, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener("abort", () => {
        const abortError = new Error("aborted");
        (abortError as Error & { name: string }).name = "AbortError";
        reject(abortError);
      });
    });

  const client = createGrokClient({ apiKey: "test-key", fetchImpl, timeoutMs: 5 });

  await assert.rejects(
    () => client.generateText({ userPrompt: "Hi" }),
    (error: unknown) => {
      assert.ok(error instanceof GrokProviderError);
      assert.equal(error.kind, "timeout");
      return true;
    },
  );
});

test("createGrokClient fails when API key is missing", () => {
  assert.throws(
    () => createGrokClient({ apiKey: "" }),
    (error: unknown) => {
      assert.ok(error instanceof GrokProviderError);
      assert.equal(error.kind, "validation");
      assert.match(error.message, /XAI_API_KEY/i);
      return true;
    },
  );
});
