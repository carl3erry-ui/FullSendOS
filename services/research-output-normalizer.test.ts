import assert from "node:assert/strict";
import test from "node:test";
import { CompetitorOutputSchema } from "../src/contracts/departmentContracts.js";
import { PublisherOutputSchema } from "../src/contracts/departmentContracts.js";
import { ResearchOutputSchema } from "../src/contracts/departmentContracts.js";
import { normalizeDepartmentOutput } from "../src/orchestrator/outputNormalizer.js";

test("normalizes research payload shape mismatches into schema-compatible structure", () => {
  const raw = {
    summary: "Market overview",
    industryDefinition: { text: "Racing and track-day services" },
    marketContext: [{ text: "Demand is fragmented" }, { description: "Regional variability" }],
    trends: [{ title: "Track-day participation", direction: "up", impact: "Higher weekend demand" }],
    metrics: [{ metric: "Average spend", value: { text: "$300" }, classification: "unknown", confidence: 0.7 }],
    opportunities: [{ label: "Expand premium packages" }],
    risks: [{ text: "Seasonal demand swings" }],
    unknowns: [{ issue: "Conversion rates by segment" }],
  };

  const normalized = normalizeDepartmentOutput("research", raw);
  const parsed = ResearchOutputSchema.parse(normalized);

  assert.equal(parsed.industryDefinition, "Racing and track-day services");
  assert.deepEqual(parsed.marketContext, ["Demand is fragmented", "Regional variability"]);
  assert.equal(parsed.trends[0].direction, "uncertain");
  assert.equal(parsed.metrics[0].classification, "estimate");
  assert.equal(parsed.opportunities[0], "Expand premium packages");
  assert.equal(parsed.unknowns[0].question, "Conversion rates by segment");
  assert.ok(typeof parsed.unknowns[0].whyItMatters === "string");
  assert.ok(typeof parsed.unknowns[0].recommendedMethod === "string");
});

test("keeps strict validation by rejecting unnormalizable fact claims without sources", () => {
  const raw = {
    summary: "Research summary",
    industryDefinition: "Industry",
    marketContext: ["Context"],
    trends: [],
    metrics: [],
    opportunities: [],
    risks: [],
    claims: [{ statement: "Uncited hard fact", classification: "fact" }],
    unknowns: [],
  };

  const normalized = normalizeDepartmentOutput("research", raw);

  assert.throws(() => ResearchOutputSchema.parse(normalized));
});

test("normalizes competitor payload shape mismatches into schema-compatible structure", () => {
  const raw = {
    summary: "Competitor readout",
    competitors: [
      {
        name: { text: "TrackMax" },
        category: { text: "Premium" },
        positioning: { description: "High-performance focus" },
        strengths: [{ text: "Loyal customer base" }],
        weaknesses: [{ text: "Higher pricing" }],
        pricing: { value: { text: "$250" }, classification: "unknownish" },
      },
    ],
    comparisonDimensions: [{ text: "pricing" }, { text: "positioning" }],
    whitespace: { note: "underserved beginner segment" },
    recommendedPosition: { text: "Own premium beginner transition" },
    unknowns: [{ issue: "Exact competitor margins" }],
  };

  const normalized = normalizeDepartmentOutput("competitors", raw);
  const parsed = CompetitorOutputSchema.parse(normalized);

  assert.deepEqual(parsed.comparisonDimensions, ["pricing", "positioning"]);
  assert.equal(parsed.whitespace.length, 0);
  assert.equal(parsed.competitors[0].name, "TrackMax");
  assert.equal(parsed.competitors[0].pricing.classification, "unknown");
  assert.equal(parsed.recommendedPosition, "Own premium beginner transition");
});

function buildValidPublishingRaw() {
  return {
    summary: "Publishing summary",
    claims: [],
    unknowns: [],
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

test("normalizes publishing deliverableOutline alias into deckOutline", () => {
  const raw = buildValidPublishingRaw();
  delete raw.deckOutline;
  raw.deliverableOutline = [{ slide: 1, title: "Situation", purpose: "Context", keyPoints: ["Point"] }];

  const normalized = normalizeDepartmentOutput("publishing", raw);
  const parsed = PublisherOutputSchema.parse(normalized);

  assert.equal(parsed.deckOutline.length, 1);
  assert.equal(parsed.deckOutline[0].title, "Situation");
});

test("publishing validation rejects missing executive report markdown", () => {
  const raw = buildValidPublishingRaw();
  delete raw.reportMarkdown;

  const normalized = normalizeDepartmentOutput("publishing", raw);
  assert.throws(() => PublisherOutputSchema.parse(normalized), /reportMarkdown/i);
});

test("publishing validation rejects missing one-page summary", () => {
  const raw = buildValidPublishingRaw();
  delete raw.onePageSummary;

  const normalized = normalizeDepartmentOutput("publishing", raw);
  assert.throws(() => PublisherOutputSchema.parse(normalized), /onePageSummary/i);
});

test("publishing validation rejects missing deck outline", () => {
  const raw = buildValidPublishingRaw();
  delete raw.deckOutline;

  const normalized = normalizeDepartmentOutput("publishing", raw);
  assert.throws(() => PublisherOutputSchema.parse(normalized), /deckOutline/i);
});
