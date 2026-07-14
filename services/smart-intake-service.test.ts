import assert from "node:assert/strict";
import test from "node:test";
import { classifySmartIntake } from "./human-input-service";

test("Hardware Brewery with website and missing address is enrichable", () => {
  assert.equal(
    classifySmartIntake({
      companyName: "Hardware Brewery",
      website: "https://hardwarebrewery.com",
      objective: "Acquisition / real estate evaluation",
    }),
    "enrichable",
  );
});
