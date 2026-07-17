import assert from "node:assert/strict";
import test from "node:test";
import {
  getSafeResponseError,
  parseJsonResponseSafely,
} from "../app/components/safe-json-response";

test("empty successful response does not throw raw JSON parse errors", async () => {
  const response = new Response("", { status: 200, headers: { "Content-Type": "application/json" } });
  const parsed = await parseJsonResponseSafely(response);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.empty, true);
  assert.equal(parsed.invalid, false);
  assert.equal(parsed.data, null);
  assert.equal(
    getSafeResponseError(parsed, "Unable to load engagements."),
    "The server returned an empty response. Please refresh or try the action again.",
  );
});

test("empty failed response does not throw raw JSON parse errors", async () => {
  const response = new Response("", { status: 500, headers: { "Content-Type": "application/json" } });
  const parsed = await parseJsonResponseSafely(response);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.empty, true);
  assert.equal(parsed.invalid, false);
  assert.equal(
    getSafeResponseError(parsed, "Workflow could not be started."),
    "The server returned an empty response. Please refresh or try the action again.",
  );
});

test("invalid JSON response does not throw raw JSON parse errors", async () => {
  const response = new Response("not-json", { status: 200, headers: { "Content-Type": "application/json" } });
  const parsed = await parseJsonResponseSafely(response);

  assert.equal(parsed.ok, false);
  assert.equal(parsed.empty, false);
  assert.equal(parsed.invalid, true);
  assert.equal(
    getSafeResponseError(parsed, "Workflow could not be started.", {
      invalidMessage: "The server returned an invalid response. No workflow was started.",
    }),
    "The server returned an invalid response. No workflow was started.",
  );
});

test("unsafe server errors are sanitized before reaching UI", async () => {
  const response = new Response(JSON.stringify({ error: "Authorization: Bearer secret-token" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
  const parsed = await parseJsonResponseSafely(response);

  assert.equal(
    getSafeResponseError(parsed, "Workflow action failed safely."),
    "Workflow action failed safely.",
  );
});
