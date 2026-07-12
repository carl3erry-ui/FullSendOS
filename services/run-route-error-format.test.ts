import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRouteError } from "../app/api/projects/[id]/run/route";

test("normalizeRouteError returns concise structured validation errors", () => {
  const error = {
    issues: [
      { path: ["marketContext", 0], message: "Expected string, received object" },
      { path: ["unknowns", 0, "question"], message: "Required" },
    ],
  };

  const normalized = normalizeRouteError(error);

  assert.equal(normalized.status, 422);
  assert.equal(normalized.message, "Workflow validation failed.");
  assert.deepEqual(normalized.fieldErrors, [
    { path: "marketContext.0", message: "Expected string, received object" },
    { path: "unknowns.0.question", message: "Required" },
  ]);
});
