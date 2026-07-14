import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSmartIntakeHumanInputRequest,
  classifySmartIntake,
  createAddressEnrichmentTask,
} from "./human-input-service";

 test("Smart intake classifies strong anchors as enrichable", () => {
  assert.equal(
    classifySmartIntake({ companyName: "Hardware Brewery", website: "https://hardwarebrewery.com", objective: "Evaluate acquisition" }),
    "enrichable",
  );
});

 test("Smart intake classifies missing website as needing user input", () => {
  assert.equal(
    classifySmartIntake({ companyName: "Hardware Brewery", objective: "Evaluate acquisition" }),
    "needs_user_input",
  );
});

 test("Smart intake creates a missing address request for strong anchors", () => {
  const requests = buildSmartIntakeHumanInputRequest({
    companyName: "Hardware Brewery",
    website: "https://hardwarebrewery.com",
    objective: "Evaluate acquisition",
    engagementId: "eng-1",
    clientId: "client-1",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, "missing_information");
  assert.equal(requests[0].relatedField, "address");
  assert.equal(requests[0].requiredToContinue, false);
});

 test("Address enrichment task is queued for the researcher", async () => {
  const task = await createAddressEnrichmentTask({
    engagementId: "eng-1",
    companyName: "Hardware Brewery",
    website: "https://hardwarebrewery.com",
    objective: "Evaluate acquisition",
  });

  assert.equal(task.agentId, "researcher");
  assert.equal(task.status, "queued");
  assert.match(task.objective, /Hardware Brewery/);
});
