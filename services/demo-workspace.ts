/**
 * Safe fictional demo workspace data.
 * All names, financials, and content are entirely fictional.
 * No real client data, secrets, or runtime information is included.
 */
import { createClient } from "@/src/schemas/clientSchema.js";
import { saveClient } from "@/src/storage/clientStore.js";
import { saveProject } from "@/src/storage/projectStore.js";
import { ensureClientBaseline } from "./client-baseline-store";

export const DEMO_CLIENT_ID_PREFIX = "DEMO-APEX-BREW";
export const DEMO_ENGAGEMENT_ID_PREFIX = "DEMO-APEX-ENG";

export function isDemoRecord(id: string): boolean {
  return id.startsWith(DEMO_CLIENT_ID_PREFIX) || id.startsWith(DEMO_ENGAGEMENT_ID_PREFIX);
}

export async function seedDemoWorkspace(): Promise<{ clientId: string; engagementId: string; alreadyExists: boolean }> {
  const { listClients } = await import("@/src/storage/clientStore.js");
  const { listProjects } = await import("@/src/storage/projectStore.js");

  const [existingClients, existingProjects] = await Promise.all([
    listClients({ includeAll: true }),
    listProjects({ includeAll: true }),
  ]);

  const existingDemo = existingClients.find((c): c is NonNullable<typeof c> => c !== null && c !== undefined && (c as { id: string }).id.startsWith(DEMO_CLIENT_ID_PREFIX));
  const existingEngagement = existingProjects.find((p): p is NonNullable<typeof p> => p !== null && p !== undefined && (p as { id: string }).id.startsWith(DEMO_ENGAGEMENT_ID_PREFIX));

  if (existingDemo && existingEngagement) {
    return {
      clientId: existingDemo.id,
      engagementId: existingEngagement.id,
      alreadyExists: true,
    };
  }

  const now = new Date("2026-07-01T10:00:00.000Z").toISOString();
  const clientId = `${DEMO_CLIENT_ID_PREFIX}-001`;
  const engagementId = `${DEMO_ENGAGEMENT_ID_PREFIX}-001`;

  // --- Demo Client ---
  const demoClient = {
    schemaVersion: "1.0.0" as const,
    id: clientId,
    name: "Apex Brewing Co.",
    industry: "Food & Beverage",
    website: "https://apexbrewing.example",
    primaryContact: "Jordan Mills",
    lifecycleStatus: "active" as const,
    createdAt: now,
    updatedAt: now,
  };

  // --- Demo Baseline ---
  const demoBaseline = {
    clientId,
    companyOverview: {
      companyName: "Apex Brewing Co.",
      website: "https://apexbrewing.example",
      industry: "Food & Beverage — Craft Brewery",
      locationMarketsServed: "Pacific Northwest, expanding to Northern California",
      currentStage: "Growth — Series A equivalent",
      teamCount: "18 full-time",
      locations: ["Portland, OR", "Seattle, WA"],
    },
    businessModel: {
      model: "Taproom + wholesale distribution to independent retailers and restaurants",
      servicesOrProducts: ["Craft lager", "IPA", "Seasonal sours", "Private label contract brewing"],
      revenueDrivers: ["Taproom sales", "Wholesale distribution", "Events and private parties"],
      majorCosts: ["Raw ingredients", "Distribution", "Labor", "Taproom lease"],
    },
    markets: ["Pacific Northwest", "Northern California"],
    customers: {
      targetCustomers: "Urban craft beer drinkers aged 28–45 seeking premium local brands",
      customerSegments: ["Taproom regulars", "Retailer buyers", "Restaurant buyers"],
      priceSensitivity: "Medium — quality-driven, willing to pay a premium for local craft",
      buyingMotivations: ["Local provenance", "Craft quality", "Brand story"],
      keyProblems: ["Finding reliable local supply", "Discovering new breweries", "Trust in quality"],
    },
    goals: {
      growthGoal: "Expand wholesale distribution to 200 retail accounts in Northern California within 18 months",
      engagementPurpose: "Develop an investor-ready market entry strategy for California expansion",
      desiredDeliverable: "Executive strategy memo with financial scenarios and brand positioning",
      timeline: "Q3 2026 decision deadline",
      finalAudience: "Board of directors and lead investor",
      successDefinition: "Board approves expansion budget and timeline with confidence",
    },
    competitors: {
      knownCompetitors: ["Stone Brewing", "Sierra Nevada", "Anchor Steam", "Lagunitas"],
      marketConcerns: ["Oversaturated California market", "Shelf space competition", "Distribution partner reliability"],
      advantages: ["Authentic Pacific Northwest story", "Award-winning IPA", "Strong taproom margin"],
      weaknesses: ["Limited brand awareness outside Oregon", "Small distribution team"],
    },
    brandVoice: {
      tone: "Confident, honest, craft-forward",
      positioning: "The Northwest's most thoughtful brewery",
      writingStyle: "Direct and warm — no corporate jargon",
      wordsToUse: ["craft", "local", "honest", "bold"],
      wordsToAvoid: ["artisan", "curated", "bespoke"],
    },
    operations: {
      servicesOrProducts: ["Craft beer production", "Taproom", "Contract brewing"],
      revenueDrivers: ["Taproom", "Distribution", "Events"],
      majorCosts: ["Ingredients", "Labor", "Lease", "Distribution"],
      constraints: ["Production capacity at 80% utilization", "Distribution team of 2 people"],
      currentBottlenecks: ["Distribution bandwidth", "Brand awareness outside Oregon"],
    },
    knownConstraints: ["Distribution team headcount", "Production capacity"],
    availableDocuments: ["financials", "pitch deck", "brand guide", "market research"],
    missingDocuments: ["business plan", "investor docs", "SOPs"],
    recommendedEngagementTypes: [
      "Market Entry Strategy",
      "Investor Narrative and Fundraising Strategy",
      "Brand and Messaging System",
    ],
    createdAt: now,
    updatedAt: now,
  };

  // --- Demo Engagement (completed, needs-review) ---
  const demoEngagement = {
    id: engagementId,
    clientId,
    schemaVersion: "1.0.0",
    status: "needs-review",
    lifecycleStatus: "active",
    createdAt: now,
    updatedAt: now,
    client: {
      companyName: "Apex Brewing Co.",
      contactName: "Jordan Mills",
      website: "https://apexbrewing.example",
      industry: "Food & Beverage",
    },
    brief: {
      objective: "Develop a California market entry strategy for Apex Brewing Co.",
      requestedDeliverables: ["market-research", "investor-deck", "brand-strategy", "expansion-plan"],
    },
    workflow: {
      initializedAt: now,
      currentStageId: "publishing",
      stages: [
        { id: "intelligence", label: "Intelligence", status: "completed", startedAt: now, completedAt: now },
        { id: "strategy", label: "Strategy", status: "completed", startedAt: now, completedAt: now },
        { id: "creative", label: "Creative", status: "completed", startedAt: now, completedAt: now },
        { id: "publishing", label: "Publishing", status: "completed", startedAt: now, completedAt: now },
      ],
      stageResults: {},
    },
    departments: {
      research: {
        summary:
          "California's craft beer market represents a $4.2B opportunity with 15% projected CAGR through 2028. The Northern California segment is consolidating around premium regional brands, creating a window for Pacific Northwest entrants with distinctive provenance stories.",
        industryDefinition: "Craft brewery competing in the premium segment of the California independent retail and on-premise channel",
        marketContext: [
          "California craft beer volume grew 8% YoY in 2025 despite national flat growth",
          "Northern California independent retail is recovering after chain consolidation",
          "Pacific Northwest brands carry a 12% brand perception premium in Northern California markets",
        ],
        trends: [
          { name: "Regional brand preference", direction: "growing", implication: "Origin story creates price premium", sourceIds: [] },
          { name: "On-premise recovery", direction: "growing", implication: "Restaurant channel reopening creates distributor capacity", sourceIds: [] },
          { name: "IPA saturation", direction: "uncertain", implication: "Flagship IPA positioning may require differentiation", sourceIds: [] },
        ],
        metrics: [
          { name: "California craft beer market size", value: 4.2, unit: "B USD", classification: "estimate", confidence: 0.74, sourceIds: [] },
          { name: "CAGR forecast 2026–2028", value: 15, unit: "%", classification: "estimate", confidence: 0.66, sourceIds: [] },
          { name: "PNW brand premium in NorCal", value: 12, unit: "%", classification: "estimate", confidence: 0.71, sourceIds: [] },
        ],
        opportunities: [
          "Underserved independent retailer channel in Sacramento and Bay Area",
          "Limited PNW craft representation in Northern California on-premise accounts",
          "Contract brewing capacity could serve California brands looking for Pacific partners",
        ],
        risks: [
          "Distribution partner reliability in a new market",
          "Shelf space competition with established California incumbents",
          "Margin compression from California distribution costs",
        ],
        unknowns: [
          {
            question: "What is the current distributor margin structure in Northern California for craft imports?",
            whyItMatters: "Determines whether price positioning is viable without margin sacrifice",
            recommendedMethod: "Primary interviews with 2–3 Northern California distributors",
          },
        ],
        claims: [
          { statement: "The Northern California independent retail channel is underserved by Pacific Northwest craft brands", classification: "inference", confidence: 0.71, sourceIds: [] },
          { statement: "Apex Brewing's IPA has won regional awards that are recognizable to California retail buyers", classification: "estimate", confidence: 0.65, sourceIds: [] },
        ],
        sourceIdsUsed: [],
      },
      competitors: {
        summary:
          "Apex Brewing faces established incumbents in the California craft market but benefits from a clear geographic differentiation angle. No dominant Pacific Northwest brand has captured the Northern California premium slot.",
        competitors: [
          { name: "Sierra Nevada", strengths: "Scale, national distribution, brand awareness", weakness: "Perceived as large/corporate by premium buyers" },
          { name: "Stone Brewing", strengths: "Strong California identity, broad distribution", weakness: "Price premium ceiling already established" },
          { name: "Lagunitas", strengths: "NorCal loyalty, Heineken distribution network", weakness: "Less craft credibility post-acquisition" },
        ],
        whitespace: ["Premium PNW import positioning in independent NorCal retail", "Authentic small-batch story for on-premise restaurant channel"],
        recommendedPosition: "Position Apex as the Pacific Northwest's most honest brewery — authentic provenance, award-winning craft, responsibly scaled.",
        unknowns: [],
        claims: [],
        sourceIdsUsed: [],
        risks: [],
        opportunities: [],
        metrics: [],
        trends: [],
      },
      customers: {
        summary:
          "Apex's ideal California customer is a 32–44 year old urban professional in Sacramento or Oakland who already buys craft beer weekly and values origin story over celebrity branding.",
        personas: [
          { name: "The Curious Retailer", description: "Independent bottle shop buyer looking for differentiated PNW imports to set their shelf apart", buyingSignal: "Looking for story-driven brands with proof of awards" },
          { name: "The Loyal Taproom Regular", description: "Apex taproom visitor from Portland or Seattle who would become an ambassador in California", buyingSignal: "Already advocates for Apex in social contexts" },
        ],
        unknowns: [],
        claims: [],
        sourceIdsUsed: [],
        risks: [],
        opportunities: [],
        metrics: [],
        trends: [],
      },
      strategy: {
        summary:
          "Apex should pursue a phased California entry: secure 3–5 anchor distributor relationships in Northern California in Q3 2026, then expand to 50 independent retail accounts by Q1 2027 before seeking Series A capital for production expansion.",
        strategicThesis:
          "Apex Brewing can capture a defensible premium position in Northern California by being the first Pacific Northwest craft brand to build authentic retailer relationships before pursuing scale.",
        positioningStatement: "For independent craft beer buyers who want local provenance without compromise — Apex Brewing is the Pacific Northwest's most honest brewery.",
        valueProposition: "Award-winning Pacific Northwest craft beer with an honest origin story and a team that shows up.",
        strategicPillars: [
          "Distribution first — build relationships before volume",
          "Story-led sales — lead with origin, not discount",
          "Taproom-to-ambassador pipeline — convert Portland visitors to California advocates",
        ],
        goToMarket: "Direct distributor partnership with 2–3 independent Northern California distributors, supported by a California-specific brand ambassador program",
        ninetyDayPlan: [
          "Hire or contract a California-based sales rep with distributor relationships",
          "Select 3 target distributor partners and initiate conversations",
          "Brief all front-of-house taproom staff on California ambassador program",
          "Commission California-specific brand asset package",
        ],
        unknowns: [],
        claims: [],
        sourceIdsUsed: [],
        risks: [],
        opportunities: [],
        metrics: [],
        trends: [],
      },
      brand: {
        summary: "Apex's brand voice is confident, honest, and craft-forward. The California campaign should lean into the Pacific Northwest origin story without feeling imported or distant.",
        brandEssence: "Honest craft from the Pacific Northwest",
        mission: "Make great beer that tells the truth about where it comes from.",
        vision: "Be the Pacific Northwest's most trusted craft brewery on every shelf we earn.",
        values: ["Honesty", "Craft quality", "Community", "Sustainability"],
        personality: ["Direct", "Warm", "Confident", "Grounded"],
        voice: "We write and speak like people who love making beer, not people who love talking about making beer.",
        messaging: {
          tagline: "From the Northwest. Honestly.",
          elevator: "Apex Brewing makes award-winning craft beer in Portland and Seattle. We're bringing our honest Pacific Northwest story to Northern California — one retailer relationship at a time.",
        },
        unknowns: [],
        claims: [],
        sourceIdsUsed: [],
        risks: [],
        opportunities: [],
        metrics: [],
        trends: [],
      },
      website: {
        summary: "The Apex website should serve as a trust anchor for California buyers. Add a California-specific landing page that speaks directly to distributors and retail buyers.",
        primaryGoal: "Convert California distributor and retail buyer curiosity into partnership conversations",
        targetActions: ["Download trade sheet", "Request samples", "Book a meeting with sales rep"],
        sitemap: ["Home", "Our Story", "Beers", "Trade (distributor/buyer portal)", "Find Apex", "Contact"],
        technicalRecommendations: ["Add California distributor inquiry form", "Geotarget California visitors to trade page"],
        unknowns: [],
        claims: [],
        sourceIdsUsed: [],
        risks: [],
        opportunities: [],
        metrics: [],
        trends: [],
      },
      publishing: {
        summary: "Executive work product is complete and ready for board review.",
        reportTitle: "Apex Brewing Co. — California Market Entry Strategy",
        subtitle: "Executive Strategy Memo for Board Review — Q3 2026",
        executiveSummary:
          "Apex Brewing has a credible and differentiated path to capturing a premium position in the Northern California craft beer market. The strategy requires a distribution-first approach, story-led sales, and a targeted California brand ambassador pipeline. With 18 months of focused execution, Apex can reach 200 retail accounts and achieve $1.8M in California annual revenue — creating the foundation for a Series A raise in Q4 2027.",
        keyFindings: [
          "The Northern California independent retail channel is underserved by Pacific Northwest craft brands",
          "Apex's award-winning IPA carries a measurable premium in the NorCal perception landscape",
          "A distribution-first market entry reduces upfront capital requirements and builds sustainable retailer relationships",
          "The California campaign is viable without production expansion if constrained to Northern California in Year 1",
        ],
        recommendations: [
          {
            priority: "immediate",
            recommendation: "Hire a California-based sales representative with existing distributor relationships",
            rationale: "Distribution relationships are the single highest-leverage investment for a successful California entry",
            successMeasure: "3 signed distributor letters of intent within 90 days",
          },
          {
            priority: "short-term",
            recommendation: "Commission a California-specific brand asset package",
            rationale: "California retail buyers expect regional relevance — the existing PNW brand assets will not convert in isolation",
            successMeasure: "California trade sheet and digital assets ready before first distributor meeting",
          },
          {
            priority: "medium-term",
            recommendation: "Launch a Portland taproom ambassador program for California visitors",
            rationale: "Taproom regulars who travel to California are the highest-trust brand advocates and require zero incremental marketing spend",
            successMeasure: "50 ambassador referrals tracked within the first 6 months",
          },
        ],
        reportMarkdown: `# Apex Brewing Co. — California Market Entry Strategy

## Executive Summary

Apex Brewing has a credible and differentiated path to capturing a premium position in the Northern California craft beer market.

The strategy requires a distribution-first approach, story-led sales, and a targeted California brand ambassador pipeline.

With 18 months of focused execution, Apex can reach 200 retail accounts and achieve $1.8M in California annual revenue — creating the foundation for a Series A raise in Q4 2027.

## Market Context

California's craft beer market represents a $4.2B opportunity with 15% projected CAGR through 2028.

The Northern California segment is consolidating around premium regional brands, creating a window for Pacific Northwest entrants with distinctive provenance stories.

## Strategic Recommendation

Position Apex as the Pacific Northwest's most honest brewery and build distributor relationships before pursuing volume.

## 90-Day Action Plan

1. Hire California-based sales representative
2. Identify 3 target distributor partners
3. Commission California brand asset package
4. Launch Portland taproom ambassador program

## Financial Scenario

| Scenario | Year 1 Revenue | Accounts |
|---|---|---|
| Conservative | $800K | 75 accounts |
| Base | $1.2M | 130 accounts |
| Upside | $1.8M | 200 accounts |

*All figures are estimates. Validate with distributor conversations before board presentation.*`,
        onePageSummary:
          "Apex Brewing can capture a defensible premium position in Northern California by being the first Pacific Northwest craft brand to build authentic retailer relationships before pursuing scale. Hire a California sales rep, sign 3 distributor LOIs in 90 days, and target 200 retail accounts in 18 months to support a Series A raise in Q4 2027.",
        deckOutline: [
          { slide: 1, title: "Situation", purpose: "Frame the California opportunity", keyPoints: ["$4.2B California craft market", "Northern California underserved by PNW brands", "18-month window before consolidation"], visualSuggestion: "Market map showing PNW brand presence gap in NorCal" },
          { slide: 2, title: "Our Positioning", purpose: "State the strategic bet", keyPoints: ["Pacific Northwest's most honest brewery", "Distribution-first entry reduces capital risk", "Story-led sales creates sustainable retailer loyalty"], visualSuggestion: "Brand positioning quadrant vs. Stone, Sierra Nevada, Lagunitas" },
          { slide: 3, title: "Go-to-Market", purpose: "Outline the 90-day plan", keyPoints: ["Hire California sales rep", "3 distributor LOIs in 90 days", "50 retail accounts in 6 months"], visualSuggestion: "90-day timeline with milestones" },
          { slide: 4, title: "Financial Scenarios", purpose: "Show the range of outcomes", keyPoints: ["Conservative: $800K / 75 accounts", "Base: $1.2M / 130 accounts", "Upside: $1.8M / 200 accounts"], visualSuggestion: "Scenario waterfall chart" },
          { slide: 5, title: "Ask", purpose: "State what the board needs to decide", keyPoints: ["Approve $120K California launch budget", "Authorize California sales hire", "Set 18-month review milestone"], visualSuggestion: "Decision checklist" },
        ],
        unknowns: [],
        claims: [],
        sourceIdsUsed: [],
        risks: [],
        opportunities: [],
        metrics: [],
        trends: [],
      },
    },
    deliverables: {
      executiveReport: `# Apex Brewing Co. — California Market Entry Strategy

## Executive Summary

Apex Brewing has a credible and differentiated path to capturing a premium position in the Northern California craft beer market. The strategy requires a distribution-first approach, story-led sales, and a targeted California brand ambassador pipeline. With 18 months of focused execution, Apex can reach 200 retail accounts and achieve $1.8M in California annual revenue.

## Key Recommendation

Hire a California-based sales representative with existing distributor relationships before spending on marketing or brand assets. Distribution relationships are the single highest-leverage investment for this market entry.

## 90-Day Plan

1. Hire California-based sales rep
2. Identify and approach 3 target distributor partners
3. Commission California-specific brand assets
4. Launch Portland taproom ambassador program for California visitors`,
      onePageSummary:
        "Apex Brewing can capture a defensible premium position in Northern California by being the first Pacific Northwest craft brand to build authentic retailer relationships before pursuing scale. Target: 200 retail accounts in 18 months. Path to Series A in Q4 2027.",
      deckOutline: [
        { slide: 1, title: "Situation", purpose: "Frame the California opportunity", keyPoints: ["$4.2B market", "Underserved NorCal independent retail", "18-month window"] },
        { slide: 2, title: "Positioning", purpose: "State the strategic bet", keyPoints: ["Honest PNW story", "Distribution-first", "Story-led sales"] },
        { slide: 3, title: "Go-to-Market", purpose: "90-day action plan", keyPoints: ["California sales hire", "3 distributor LOIs", "50 accounts in 6 months"] },
        { slide: 4, title: "Scenarios", purpose: "Financial outcomes", keyPoints: ["Conservative $800K", "Base $1.2M", "Upside $1.8M"] },
        { slide: 5, title: "Ask", purpose: "Board decision required", keyPoints: ["$120K budget", "Sales hire auth", "18-month review"] },
      ],
    },
    evidence: { sources: [], items: [] },
    audit: {
      runs: [
        { department: "research", status: "complete", startedAt: now, completedAt: now, model: "grok-4.5" },
        { department: "competitors", status: "complete", startedAt: now, completedAt: now, model: "grok-4.5" },
        { department: "customers", status: "complete", startedAt: now, completedAt: now, model: "grok-4.5" },
        { department: "strategy", status: "complete", startedAt: now, completedAt: now, model: "grok-4.5" },
        { department: "brand", status: "complete", startedAt: now, completedAt: now, model: "grok-4.5" },
        { department: "website", status: "complete", startedAt: now, completedAt: now, model: "grok-4.5" },
        { department: "publishing", status: "complete", startedAt: now, completedAt: now, model: "grok-4.5" },
      ],
      warnings: [],
    },
  };

  await saveClient(demoClient);
  await saveProject(demoEngagement);
  await ensureClientBaseline(clientId, demoClient.name);

  // Overwrite baseline with full demo context
  const { upsertClientBaseline } = await import("./client-baseline-store");
  await upsertClientBaseline(clientId, demoBaseline);

  return { clientId, engagementId, alreadyExists: false };
}
