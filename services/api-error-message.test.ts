import assert from "node:assert/strict";
import test from "node:test";
import { getApiErrorMessage } from "../app/components/api-error";

test("getApiErrorMessage prefers payload.error", () => {
  const message = getApiErrorMessage({ error: "XAI_API_KEY is not configured in .env." }, "Workflow could not be started.");
  assert.equal(message, "XAI_API_KEY is not configured in .env.");
});

test("getApiErrorMessage falls back when payload has no usable message", () => {
  const message = getApiErrorMessage({ details: "missing" }, "Workflow could not be started.");
  assert.equal(message, "Workflow could not be started.");
});
