import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createClient } from "../src/schemas/clientSchema.js";
import { saveClient } from "../src/storage/clientStore.js";
import {
  deriveMissingDocuments,
  deriveRecommendedEngagementTypes,
  DOCUMENT_CHECKLIST,
} from "../schemas/client-baseline";
import {
  ensureClientBaseline,
  loadClientBaseline,
  upsertClientBaseline,
} from "./client-baseline-store";
import { GET as getBaselineRoute, PUT as putBaselineRoute } from "../app/api/clients/[clientId]/baseline/route";

const clientStorageDir = path.resolve("data/clients");

async function cleanupClient(id: string) {
  await fs.rm(path.join(clientStorageDir, `${id}.json`), { force: true });
  await fs.rm(path.join(clientStorageDir, `${id}-baseline.json`), { force: true });
}

test("client baseline initializes and upserts without breaking missing clients", async () => {
  const client = createClient({ name: "Baseline Test Co", website: "https://baseline.example" });
  await saveClient(client);

  try {
    const initial = await ensureClientBaseline(client.id, client.name);
    assert.equal(initial.clientId, client.id);
    assert.equal(initial.companyOverview.companyName, client.name);
    assert.deepEqual(initial.missingDocuments, DOCUMENT_CHECKLIST);

    const updated = await upsertClientBaseline(client.id, {
      ...initial,
      companyOverview: {
        ...initial.companyOverview,
        industry: "Hospitality",
      },
      customers: {
        ...initial.customers,
        targetCustomers: "Urban professionals",
      },
      goals: {
        ...initial.goals,
        desiredDeliverable: "Investor strategy deck",
      },
      availableDocuments: ["financials", "pitch deck"],
      missingDocuments: [],
      recommendedEngagementTypes: [],
    });

    assert.equal(updated.companyOverview.industry, "Hospitality");
    assert.equal(updated.customers.targetCustomers, "Urban professionals");
    assert.equal(updated.missingDocuments.includes("financials"), false);
    assert.equal(updated.recommendedEngagementTypes.length > 0, true);

    const loaded = await loadClientBaseline(client.id);
    assert.ok(loaded);
    assert.equal(loaded?.goals.desiredDeliverable, "Investor strategy deck");
  } finally {
    await cleanupClient(client.id);
  }
});

test("client baseline route supports GET and PUT", async () => {
  const client = createClient({ name: "Baseline Route Co", website: "https://baseline-route.example" });
  await saveClient(client);

  try {
    const getResponse = await getBaselineRoute(new Request(`http://127.0.0.1:3000/api/clients/${client.id}/baseline`), {
      params: Promise.resolve({ clientId: client.id }),
    });
    const getBody = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(getBody.clientId, client.id);

    const putResponse = await putBaselineRoute(
      new Request(`http://127.0.0.1:3000/api/clients/${client.id}/baseline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getBody,
          companyOverview: {
            ...getBody.companyOverview,
            industry: "Consumer",
          },
          goals: {
            ...getBody.goals,
            desiredDeliverable: "Board-ready operating plan",
          },
          availableDocuments: ["business plan", "financials"],
          missingDocuments: [],
          recommendedEngagementTypes: [],
        }),
      }),
      { params: Promise.resolve({ clientId: client.id }) },
    );
    const putBody = await putResponse.json();

    assert.equal(putResponse.status, 200);
    assert.equal(putBody.companyOverview.industry, "Consumer");
    assert.equal(putBody.goals.desiredDeliverable, "Board-ready operating plan");
  } finally {
    await cleanupClient(client.id);
  }
});

test("baseline helper derivations stay deterministic", () => {
  const missing = deriveMissingDocuments(["financials", "pitch deck"]);
  assert.equal(missing.includes("financials"), false);
  assert.equal(missing.includes("pitch deck"), false);

  const recommendations = deriveRecommendedEngagementTypes({
    companyOverview: {
      companyName: "",
      website: "",
      industry: "",
      locationMarketsServed: "",
      currentStage: "",
      teamCount: "",
      locations: [],
    },
    businessModel: {
      model: "",
      servicesOrProducts: [],
      revenueDrivers: [],
      majorCosts: [],
    },
    markets: [],
    customers: {
      targetCustomers: "",
      customerSegments: ["SMB"],
      priceSensitivity: "",
      buyingMotivations: [],
      keyProblems: [],
    },
    goals: {
      growthGoal: "",
      engagementPurpose: "",
      desiredDeliverable: "Investor memo",
      timeline: "",
      finalAudience: "",
      successDefinition: "",
    },
    competitors: {
      knownCompetitors: ["Competitor A"],
      marketConcerns: [],
      advantages: [],
      weaknesses: [],
    },
    brandVoice: {
      tone: "Direct",
      positioning: "",
      writingStyle: "",
      wordsToUse: [],
      wordsToAvoid: [],
    },
    operations: {
      servicesOrProducts: [],
      revenueDrivers: [],
      majorCosts: [],
      constraints: [],
      currentBottlenecks: ["Hiring"],
    },
    knownConstraints: [],
    availableDocuments: ["financials"],
    missingDocuments: [],
    recommendedEngagementTypes: [],
  });

  assert.equal(recommendations.length > 0, true);
  assert.equal(recommendations.some((item) => item.includes("Investor")), true);
});
