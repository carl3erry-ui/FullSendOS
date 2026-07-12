import assert from "node:assert/strict";
import test from "node:test";
import { parseJsonObject } from "../src/utils/json.js";

test("parseJsonObject handles fenced JSON with prose wrapper", () => {
  const input = "Here is your output:\n```json\n{\n  \"foo\": \"bar\"\n}\n```\nThanks";
  const parsed = parseJsonObject(input) as { foo: string };
  assert.equal(parsed.foo, "bar");
});

test("parseJsonObject repairs trailing commas", () => {
  const input = "{\n  \"list\": [1, 2,],\n  \"name\": \"ok\",\n}";
  const parsed = parseJsonObject(input) as { list: number[]; name: string };
  assert.deepEqual(parsed.list, [1, 2]);
  assert.equal(parsed.name, "ok");
});

test("parseJsonObject throws when content is not recoverable JSON", () => {
  assert.throws(() => parseJsonObject("totally not json"));
});
