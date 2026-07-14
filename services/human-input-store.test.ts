import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { HumanInputRequestSchema } from "../schemas/human-input";
import { HumanInputRequestStore } from "./human-input-store";

function tmpDir(label: string) {
  return join(process.cwd(), "data", `human-input-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function clean(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

test("HumanInputRequestSchema validates a safe request", () => {
  const parsed = HumanInputRequestSchema.safeParse({
    id: "hir-1",
    clientId: "client-1",
    engagementId: "eng-1",
    type: "missing_information",
    title: "Confirm address",
    prompt: "Please confirm the address.",
    status: "open",
    priority: "medium",
    requestedBy: "system",
    requestedAt: new Date().toISOString(),
    options: [],
    requiredToContinue: false,
    evidence: [],
    sourceReferences: [],
    metadata: {},
  });

  assert.equal(parsed.success, true);
});

test("HumanInputRequestStore creates, loads, and filters requests", async () => {
  const dir = tmpDir("store");
  const store = new HumanInputRequestStore(dir);

  try {
    const created = await store.createRequest({
      clientId: "client-a",
      engagementId: "eng-a",
      type: "missing_information",
      title: "Provide address",
      prompt: "Please provide the business address.",
      priority: "high",
      requestedBy: "system",
      relatedField: "address",
      requiredToContinue: true,
      options: [
        { label: "Provide address", value: "provide" },
        { label: "Continue", value: "continue" },
      ],
      evidence: [],
      sourceReferences: [],
      metadata: {},
    });

    assert.equal(created.status, "open");
    assert.equal(created.requiredToContinue, true);

    const loaded = await store.loadRequest(created.id);
    assert.equal(loaded.id, created.id);
    assert.equal(loaded.title, "Provide address");

    const listByEngagement = await store.listRequests({ engagementId: "eng-a" });
    assert.equal(listByEngagement.length, 1);

    const listOpen = await store.listRequests({ openOnly: true });
    assert.equal(listOpen.length, 1);

    const answered = await store.answerRequest(created.id, "123 Main St", "user-1");
    assert.equal(answered.status, "answered");
    assert.equal(answered.response, "123 Main St");

    const confirmed = await store.confirmRequest(created.id, "Confirmed", "user-1");
    assert.equal(confirmed.status, "confirmed");

    const rejected = await store.rejectRequest(created.id, "Wrong address", "user-1");
    assert.equal(rejected.status, "rejected");

    const skipped = await store.skipRequest(created.id, "Skip for now", "user-1");
    assert.equal(skipped.status, "skipped");
  } finally {
    await clean(dir);
  }
});
