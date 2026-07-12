import assert from "node:assert/strict";
import test from "node:test";
import { formatApiError } from "../app/components/api-error";

test("formatApiError includes field-level validation details when requested", () => {
  const payload = {
    error: "Engagement validation failed.",
    fieldErrors: [
      { path: "client.website", message: "Invalid url" },
      { path: "objective", message: "Required" },
    ],
  };

  const message = formatApiError(payload, "Unable to create engagement.", { includeFieldErrors: true });
  assert.equal(message, "Engagement validation failed. client.website: Invalid url | objective: Required");
});

test("formatApiError returns base message when no field errors exist", () => {
  const payload = { error: "Engagement validation failed." };
  const message = formatApiError(payload, "Unable to create engagement.", { includeFieldErrors: true });
  assert.equal(message, "Engagement validation failed.");
});
