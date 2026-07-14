import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildDepartmentPrompt, PublisherOutputSchema } from "../src/contracts/departmentContracts.js";
import { runExistingProject } from "../src/orchestrator/orchestrator.js";
import { normalizeDepartmentOutput } from "../src/orchestrator/outputNormalizer.js";
import { createEmptyProject } from "../src/schemas/projectSchema.js";
import { loadProject } from "../src/storage/projectStore.js";

const storageDir = path.resolve("data/projects");

async function cleanupProject(id: string) {
  const file = path.join(storageDir, `${id}.json`);
  await fs.rm(file, { force: true });
}

function buildValidPublishingRaw() {
  return {
    summary: "Publishing summary",
    claims: [],
    unknowns: [{ question: "Unknown pricing", whyItMatters: "Impacts confidence", recommendedMethod: "Collect evidence" }],
    sourceIdsUsed: [],
    reportTitle: "Executive report",
    subtitle: "Quarterly growth plan",
    executiveSummary: "Top-line findings and recommendations.",
    keyFindings: ["Finding one"],
    recommendations: [
      {
        priority: "immediate",
        recommendation: "Ship executive package",
        rationale: "Supports decision making",
        successMeasure: "Stakeholder approval",
      },
    ],
    reportMarkdown: "# Executive report\n\nBody",
    onePageSummary: "One-page summary",
    deckOutline: [{ slide: 1, title: "Situation", purpose: "Context", keyPoints: ["Point"] }],
  };
}

function buildValidDepartmentOutput(department: string) {
  if (department === "research") {
    return {
      summary: "Research summary",
      claims: [],
      unknowns: [],
      sourceIdsUsed: [],
      industryDefinition: "Professional services",
      marketContext: ["Demand remains steady"],
      trends: [{ name: "Trend", direction: "uncertain", implication: "Watch closely", sourceIds: [] }],
      metrics: [],
      opportunities: ["Improve conversion"],
      risks: ["Insufficient evidence"],
    };
  }

  if (department === "competitors") {
    return {
      summary: "Competitor summary",
      claims: [],
      unknowns: [],
      sourceIdsUsed: [],
      competitors: [
        {
          name: "Competitor A",
          category: "Direct",
          positioning: "Premium",
          strengths: ["Awareness"],
          weaknesses: ["Price"],
          pricing: { value: "$100", classification: "estimate", sourceIds: [] },
          sourceIds: [],
        },
      ],
      comparisonDimensions: ["positioning"],
      whitespace: ["Mid-market"],
      recommendedPosition: "Execution reliability",
    };
  }

  if (department === "customers") {
    return {
      summary: "Customer summary",
      claims: [],
      unknowns: [],
      sourceIdsUsed: [],
      personas: [
        {
          name: "Ops leader",
          segment: "SMB",
          description: "Decision maker",
          goals: ["Reliable delivery"],
          painPoints: ["Execution risk"],
          buyingTriggers: ["Missed deadlines"],
          objections: ["Cost"],
          channels: ["Referral"],
          evidenceLevel: "hypothesis",
        },
      ],
      customerJourney: [
        {
          stage: "Evaluate",
          customerQuestion: "Can this deliver?",
          recommendedResponse: "Show references",
          primaryChannel: "Sales",
        },
      ],
    };
  }

  if (department === "strategy") {
    return {
      summary: "Strategy summary",
      claims: [],
      unknowns: [],
      sourceIdsUsed: [],
      strategicThesis: "Focus on reliable execution",
      positioningStatement: "Dependable consulting OS",
      valueProposition: "Faster decision-grade output",
      strategicPillars: [{ name: "Reliability", rationale: "Trust", actions: ["Harden contracts"], kpis: ["Completion rate"] }],
      goToMarket: [{ phase: "Now", timing: "Q3", objective: "Pilot", actions: ["Run engagements"] }],
      ninetyDayPlan: [{ priority: 1, action: "Validate", ownerRole: "Ops", timing: "30 days", successMeasure: "10 successful runs" }],
    };
  }

  if (department === "brand") {
    return {
      summary: "Brand summary",
      claims: [],
      unknowns: [],
      sourceIdsUsed: [],
      brandEssence: "Confident clarity",
      mission: "Deliver complete executive output",
      vision: "Trusted AI consulting operations",
      values: ["Trust", "Clarity"],
      personality: ["Confident"],
      voice: { attributes: ["Clear"], do: ["State uncertainty"], avoid: ["Overclaiming"] },
      messaging: { taglineOptions: ["Deliver with confidence"], elevatorPitch: "Complete executive package", proofPoints: ["Fail-closed contracts"] },
      visualDirection: { palette: [{ name: "Slate", hex: "#0F172A" }], typographyDirection: ["Modern"], imageryDirection: ["Operational"] },
    };
  }

  if (department === "website") {
    return {
      summary: "Website summary",
      claims: [],
      unknowns: [],
      sourceIdsUsed: [],
      primaryGoal: "Start engagements",
      targetActions: ["Create engagement"],
      sitemap: [{ page: "Home", purpose: "Explain value", sections: ["Hero"], primaryCta: "Start" }],
      homepageWireframe: [{ order: 1, section: "Hero", objective: "Clarify offer", content: ["Outcome"], cta: "Start" }],
      imagePrompts: [{ use: "Hero", prompt: "Executive dashboard", aspectRatio: "16:9" }],
      technicalRecommendations: ["Keep rendering deterministic"],
    };
  }

  return buildValidPublishingRaw();
}

test("publishing prompt explicitly requires all three executive deliverables", () => {
  const project = createEmptyProject({ companyName: "Prompt Contract Co", objective: "Validate prompt" });
  const prompt = buildDepartmentPrompt({ department: "publishing", project });

  assert.match(prompt, /reportMarkdown/);
  assert.match(prompt, /onePageSummary/);
  assert.match(prompt, /deckOutline/);
  assert.match(prompt, /non-empty markdown/i);
  assert.match(prompt, /non-empty executive decision brief/i);
  assert.match(prompt, /at least 1 item/i);
  assert.match(prompt, /Return exactly one JSON object and nothing else/i);
});

test("valid canonical publishing payload passes", () => {
  const normalized = normalizeDepartmentOutput("publishing", buildValidPublishingRaw());
  const parsed = PublisherOutputSchema.parse(normalized);
  assert.equal(parsed.onePageSummary.length > 0, true);
  assert.equal(parsed.deckOutline.length > 0, true);
});

test("observed alias payload normalizes correctly", () => {
  const raw = buildValidPublishingRaw() as Record<string, unknown>;
  delete raw.deckOutline;
  raw.deliverableOutline = [{ slide: 1, title: "Situation", purpose: "Context", keyPoints: ["Point"] }];

  const parsed = PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw));
  assert.equal(parsed.deckOutline.length, 1);
});

test("publishing validation rejects missing reportMarkdown", () => {
  const raw = buildValidPublishingRaw() as Record<string, unknown>;
  delete raw.reportMarkdown;
  assert.throws(() => PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw)), /reportMarkdown/i);
});

test("publishing validation rejects empty reportMarkdown", () => {
  const raw = buildValidPublishingRaw();
  raw.reportMarkdown = "";
  assert.throws(() => PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw)), /reportMarkdown/i);
});

test("publishing validation rejects missing onePageSummary", () => {
  const raw = buildValidPublishingRaw() as Record<string, unknown>;
  delete raw.onePageSummary;
  assert.throws(() => PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw)), /onePageSummary/i);
});

test("publishing validation rejects empty onePageSummary", () => {
  const raw = buildValidPublishingRaw();
  raw.onePageSummary = "";
  assert.throws(() => PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw)), /onePageSummary/i);
});

test("publishing validation rejects missing deckOutline", () => {
  const raw = buildValidPublishingRaw() as Record<string, unknown>;
  delete raw.deckOutline;
  assert.throws(() => PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw)), /deckOutline/i);
});

test("publishing validation rejects empty deckOutline", () => {
  const raw = buildValidPublishingRaw();
  raw.deckOutline = [];
  assert.throws(() => PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw)), /deckOutline/i);
});

test("publishing validation rejects malformed slide", () => {
  const raw = buildValidPublishingRaw();
  raw.deckOutline = [{ slide: 0, title: "Bad", purpose: "Invalid", keyPoints: ["x"] } as any];
  assert.throws(() => PublisherOutputSchema.parse(normalizeDepartmentOutput("publishing", raw)));
});

test("normalization does not create semantic executive deliverables", () => {
  const raw = {
    summary: "Publishing summary",
    claims: [],
    unknowns: [],
    sourceIdsUsed: [],
    reportTitle: "Title",
    subtitle: "Sub",
    executiveSummary: "Exec",
    keyFindings: [],
    recommendations: [],
  };

  const normalized = normalizeDepartmentOutput("publishing", raw) as any;
  assert.equal(normalized.reportMarkdown, "");
  assert.equal(normalized.onePageSummary, "");
  assert.deepEqual(normalized.deckOutline, []);
});

test("incomplete publishing cannot become needs-review and emits concise error", async () => {
  const project = createEmptyProject({
    companyName: "Incomplete Publishing Co",
    objective: "Ensure fail-closed publishing",
  });

  const invokeModel = async ({ department }: { department: string }) => {
    if (department !== "publishing") {
      return { text: JSON.stringify(buildValidDepartmentOutput(department)), model: "test-model", raw: {} };
    }

    const invalidPublishing = buildValidPublishingRaw() as Record<string, unknown>;
    delete invalidPublishing.onePageSummary;
    return { text: JSON.stringify(invalidPublishing), model: "test-model", raw: {} };
  };

  try {
    await assert.rejects(() => runExistingProject(project, { invokeModel }));

    const persisted = await loadProject(project.id);
    assert.equal(persisted.status, "failed");
    assert.ok(persisted.audit.warnings.some((warning: string) => warning.includes("Publishing validation failed")));
    assert.ok(persisted.audit.warnings.some((warning: string) => warning.includes("onePageSummary")));
    assert.ok(persisted.audit.warnings.every((warning: string) => !warning.includes('"code"')));
  } finally {
    await cleanupProject(project.id);
  }
});

test("complete publishing persists all three executive deliverables", async () => {
  const project = createEmptyProject({
    companyName: "Complete Publishing Co",
    objective: "Ensure complete publishing persists deliverables",
  });

  const invokeModel = async ({ department }: { department: string }) => {
    return { text: JSON.stringify(buildValidDepartmentOutput(department)), model: "test-model", raw: {} };
  };

  try {
    const result = await runExistingProject(project, { invokeModel });
    assert.match(result.status, /complete|needs-review/);
    assert.ok(result.deliverables.executiveReport);
    assert.ok(result.deliverables.onePageSummary);
    assert.ok(Array.isArray(result.deliverables.deckOutline));
    assert.ok(result.deliverables.deckOutline.length > 0);

    const persisted = await loadProject(project.id);
    assert.ok(persisted.deliverables.executiveReport);
    assert.ok(persisted.deliverables.onePageSummary);
    assert.ok(Array.isArray(persisted.deliverables.deckOutline));
    assert.ok(persisted.deliverables.deckOutline.length > 0);
  } finally {
    await cleanupProject(project.id);
  }
});
