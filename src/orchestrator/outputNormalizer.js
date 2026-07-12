function toStringValue(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    for (const key of ["text", "summary", "title", "name", "value", "description", "label"]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return fallback;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toStringValue(item, ""))
    .map((item) => item.trim())
    .filter(Boolean);
}

function toObjectArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object");
}

function normalizeDirection(value) {
  if (value === "growing" || value === "stable" || value === "declining" || value === "uncertain") {
    return value;
  }

  return "uncertain";
}

function normalizeUnknowns(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          question: item,
          whyItMatters: "This information is required for higher confidence recommendations.",
          recommendedMethod: "Collect client evidence or validated external sources."
        };
      }

      if (!item || typeof item !== "object") return null;

      const question = toStringValue(
        item.question ?? item.unknown ?? item.issue ?? item.title ?? item.name,
        ""
      );

      if (!question) return null;

      return {
        question,
        whyItMatters: toStringValue(
          item.whyItMatters ?? item.impact ?? item.reason,
          "This information is required for higher confidence recommendations."
        ),
        recommendedMethod: toStringValue(
          item.recommendedMethod ?? item.nextStep ?? item.recommendation,
          "Collect client evidence or validated external sources."
        )
      };
    })
    .filter(Boolean);
}

function normalizeClaims(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const statement = toStringValue(item.statement ?? item.claim ?? item.text, "");
      if (!statement) return null;

      const classification = item.classification;
      const normalizedClassification =
        classification === "fact" ||
        classification === "estimate" ||
        classification === "assumption" ||
        classification === "recommendation"
          ? classification
          : "estimate";

      const sourceIds = Array.isArray(item.sourceIds)
        ? item.sourceIds.filter((sourceId) => typeof sourceId === "string")
        : [];

      const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? Math.max(0, Math.min(1, item.confidence))
        : 0.5;

      return {
        statement,
        classification: normalizedClassification,
        confidence,
        sourceIds,
        caveat: typeof item.caveat === "string" ? item.caveat : undefined
      };
    })
    .filter(Boolean);
}

function normalizeMetrics(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const name = toStringValue(item.name ?? item.metric ?? item.title, "");
      if (!name) return null;

      const rawClassification = item.classification;
      const classification =
        rawClassification === "fact" ||
        rawClassification === "estimate" ||
        rawClassification === "assumption"
          ? rawClassification
          : "estimate";

      const valueField = item.value;
      const metricValue =
        typeof valueField === "string" || typeof valueField === "number"
          ? valueField
          : toStringValue(valueField, "unknown");

      const sourceIds = Array.isArray(item.sourceIds)
        ? item.sourceIds.filter((sourceId) => typeof sourceId === "string")
        : [];

      const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? Math.max(0, Math.min(1, item.confidence))
        : 0.5;

      return {
        name,
        value: metricValue,
        unit: typeof item.unit === "string" ? item.unit : undefined,
        period: typeof item.period === "string" ? item.period : undefined,
        classification,
        confidence,
        sourceIds
      };
    })
    .filter(Boolean);
}

function normalizeResearchOutput(raw) {
  if (!raw || typeof raw !== "object") return raw;

  return {
    ...raw,
    summary: toStringValue(raw.summary, "Research summary requires validation."),
    claims: normalizeClaims(raw.claims),
    unknowns: normalizeUnknowns(raw.unknowns),
    sourceIdsUsed: Array.isArray(raw.sourceIdsUsed)
      ? raw.sourceIdsUsed.filter((sourceId) => typeof sourceId === "string")
      : [],
    industryDefinition: toStringValue(raw.industryDefinition, "Industry definition requires validation."),
    marketContext: toStringArray(raw.marketContext),
    trends: Array.isArray(raw.trends)
      ? raw.trends
          .map((trend) => {
            if (!trend || typeof trend !== "object") return null;
            return {
              name: toStringValue(trend.name ?? trend.title, "Unspecified trend"),
              direction: normalizeDirection(trend.direction),
              implication: toStringValue(
                trend.implication ?? trend.impact,
                "Further validation is required for this trend."
              ),
              sourceIds: Array.isArray(trend.sourceIds)
                ? trend.sourceIds.filter((sourceId) => typeof sourceId === "string")
                : []
            };
          })
          .filter(Boolean)
      : [],
    metrics: normalizeMetrics(raw.metrics),
    opportunities: toStringArray(raw.opportunities),
    risks: toStringArray(raw.risks)
  };
}

function normalizeBaseOutput(raw, fallbackSummary) {
  return {
    summary: toStringValue(raw.summary, fallbackSummary),
    claims: normalizeClaims(raw.claims),
    unknowns: normalizeUnknowns(raw.unknowns),
    sourceIdsUsed: Array.isArray(raw.sourceIdsUsed)
      ? raw.sourceIdsUsed.filter((sourceId) => typeof sourceId === "string")
      : []
  };
}

function normalizeCompetitorOutput(raw) {
  if (!raw || typeof raw !== "object") return raw;

  return {
    ...normalizeBaseOutput(raw, "Competitor analysis requires validation."),
    competitors: toObjectArray(raw.competitors).map((competitor) => {
      const pricing = competitor.pricing && typeof competitor.pricing === "object"
        ? competitor.pricing
        : {};
      const pricingClassification =
        pricing.classification === "fact" ||
        pricing.classification === "estimate" ||
        pricing.classification === "unknown"
          ? pricing.classification
          : "unknown";

      return {
        name: toStringValue(competitor.name, "Unspecified competitor"),
        category: toStringValue(competitor.category, "General"),
        geography: toStringValue(competitor.geography, undefined),
        positioning: toStringValue(competitor.positioning, "Positioning requires validation."),
        strengths: toStringArray(competitor.strengths),
        weaknesses: toStringArray(competitor.weaknesses),
        pricing: {
          value: toStringValue(pricing.value, "unknown"),
          classification: pricingClassification,
          sourceIds: Array.isArray(pricing.sourceIds)
            ? pricing.sourceIds.filter((sourceId) => typeof sourceId === "string")
            : []
        },
        sourceIds: Array.isArray(competitor.sourceIds)
          ? competitor.sourceIds.filter((sourceId) => typeof sourceId === "string")
          : []
      };
    }),
    comparisonDimensions: toStringArray(raw.comparisonDimensions),
    whitespace: toStringArray(raw.whitespace),
    recommendedPosition: toStringValue(
      raw.recommendedPosition,
      "Differentiate using validated market evidence."
    )
  };
}

function normalizeCustomerOutput(raw) {
  if (!raw || typeof raw !== "object") return raw;

  return {
    ...normalizeBaseOutput(raw, "Customer analysis requires validation."),
    personas: toObjectArray(raw.personas).map((persona) => {
      const evidenceLevel =
        persona.evidenceLevel === "validated" ||
        persona.evidenceLevel === "inferred" ||
        persona.evidenceLevel === "hypothesis"
          ? persona.evidenceLevel
          : "hypothesis";

      return {
        name: toStringValue(persona.name, "Unspecified persona"),
        segment: toStringValue(persona.segment, "General"),
        description: toStringValue(persona.description, "Persona details require validation."),
        goals: toStringArray(persona.goals),
        painPoints: toStringArray(persona.painPoints),
        buyingTriggers: toStringArray(persona.buyingTriggers),
        objections: toStringArray(persona.objections),
        channels: toStringArray(persona.channels),
        evidenceLevel
      };
    }),
    customerJourney: toObjectArray(raw.customerJourney).map((stage) => ({
      stage: toStringValue(stage.stage, "Unspecified stage"),
      customerQuestion: toStringValue(stage.customerQuestion, "What is the primary value?"),
      recommendedResponse: toStringValue(
        stage.recommendedResponse,
        "Provide evidence-backed response."
      ),
      primaryChannel: toStringValue(stage.primaryChannel, "Web")
    }))
  };
}

function normalizeStrategyOutput(raw) {
  if (!raw || typeof raw !== "object") return raw;

  return {
    ...normalizeBaseOutput(raw, "Strategy output requires validation."),
    strategicThesis: toStringValue(raw.strategicThesis, "Strategic thesis requires validation."),
    positioningStatement: toStringValue(raw.positioningStatement, "Positioning statement requires validation."),
    valueProposition: toStringValue(raw.valueProposition, "Value proposition requires validation."),
    strategicPillars: toObjectArray(raw.strategicPillars).map((pillar) => ({
      name: toStringValue(pillar.name, "Unspecified pillar"),
      rationale: toStringValue(pillar.rationale, "Rationale requires validation."),
      actions: toStringArray(pillar.actions),
      kpis: toStringArray(pillar.kpis)
    })),
    goToMarket: toObjectArray(raw.goToMarket).map((phase) => ({
      phase: toStringValue(phase.phase, "Unspecified phase"),
      timing: toStringValue(phase.timing, "TBD"),
      objective: toStringValue(phase.objective, "Objective requires validation."),
      actions: toStringArray(phase.actions)
    })),
    ninetyDayPlan: toObjectArray(raw.ninetyDayPlan).map((item, index) => ({
      priority: Number.isFinite(item.priority) ? Math.max(1, Math.floor(item.priority)) : index + 1,
      action: toStringValue(item.action, "Action requires validation."),
      ownerRole: toStringValue(item.ownerRole, "Owner"),
      timing: toStringValue(item.timing, "TBD"),
      successMeasure: toStringValue(item.successMeasure, "Success criteria requires validation.")
    }))
  };
}

function normalizeBrandOutput(raw) {
  if (!raw || typeof raw !== "object") return raw;

  const voice = raw.voice && typeof raw.voice === "object" ? raw.voice : {};
  const messaging = raw.messaging && typeof raw.messaging === "object" ? raw.messaging : {};
  const visualDirection = raw.visualDirection && typeof raw.visualDirection === "object" ? raw.visualDirection : {};

  return {
    ...normalizeBaseOutput(raw, "Brand output requires validation."),
    brandEssence: toStringValue(raw.brandEssence, "Brand essence requires validation."),
    mission: toStringValue(raw.mission, "Mission requires validation."),
    vision: toStringValue(raw.vision, "Vision requires validation."),
    values: toStringArray(raw.values),
    personality: toStringArray(raw.personality),
    voice: {
      attributes: toStringArray(voice.attributes),
      do: toStringArray(voice.do),
      avoid: toStringArray(voice.avoid)
    },
    messaging: {
      taglineOptions: toStringArray(messaging.taglineOptions),
      elevatorPitch: toStringValue(messaging.elevatorPitch, "Pitch requires validation."),
      proofPoints: toStringArray(messaging.proofPoints)
    },
    visualDirection: {
      palette: toObjectArray(visualDirection.palette).map((item) => ({
        name: toStringValue(item.name, "Primary"),
        hex: /^#[0-9A-Fa-f]{6}$/.test(toStringValue(item.hex, ""))
          ? toStringValue(item.hex, "")
          : "#0F172A"
      })),
      typographyDirection: toStringArray(visualDirection.typographyDirection),
      imageryDirection: toStringArray(visualDirection.imageryDirection)
    }
  };
}

function normalizeWebsiteOutput(raw) {
  if (!raw || typeof raw !== "object") return raw;

  return {
    ...normalizeBaseOutput(raw, "Website output requires validation."),
    primaryGoal: toStringValue(raw.primaryGoal, "Primary goal requires validation."),
    targetActions: toStringArray(raw.targetActions),
    sitemap: toObjectArray(raw.sitemap).map((page) => ({
      page: toStringValue(page.page, "Untitled page"),
      purpose: toStringValue(page.purpose, "Purpose requires validation."),
      sections: toStringArray(page.sections),
      primaryCta: toStringValue(page.primaryCta, "Learn more")
    })),
    homepageWireframe: toObjectArray(raw.homepageWireframe).map((section, index) => ({
      order: Number.isFinite(section.order) ? Math.max(1, Math.floor(section.order)) : index + 1,
      section: toStringValue(section.section, "Section"),
      objective: toStringValue(section.objective, "Objective requires validation."),
      content: toStringArray(section.content),
      cta: typeof section.cta === "string" ? section.cta : undefined
    })),
    imagePrompts: toObjectArray(raw.imagePrompts).map((prompt) => ({
      use: toStringValue(prompt.use, "General"),
      prompt: toStringValue(prompt.prompt, "Prompt requires validation."),
      aspectRatio: toStringValue(prompt.aspectRatio, "16:9")
    })),
    technicalRecommendations: toStringArray(raw.technicalRecommendations)
  };
}

function normalizePublishingOutput(raw) {
  if (!raw || typeof raw !== "object") return raw;

  return {
    ...normalizeBaseOutput(raw, "Publishing output requires validation."),
    reportTitle: toStringValue(raw.reportTitle, "Executive report"),
    subtitle: toStringValue(raw.subtitle, "Consulting output"),
    executiveSummary: toStringValue(raw.executiveSummary, "Executive summary requires validation."),
    keyFindings: toStringArray(raw.keyFindings),
    recommendations: toObjectArray(raw.recommendations).map((item) => {
      const priority =
        item.priority === "immediate" || item.priority === "near-term" || item.priority === "long-term"
          ? item.priority
          : "near-term";

      return {
        priority,
        recommendation: toStringValue(item.recommendation, "Recommendation requires validation."),
        rationale: toStringValue(item.rationale, "Rationale requires validation."),
        successMeasure: toStringValue(item.successMeasure, "Success measure requires validation.")
      };
    }),
    reportMarkdown: toStringValue(raw.reportMarkdown, "# Report\n\nContent requires validation."),
    onePageSummary: toStringValue(raw.onePageSummary, "Summary requires validation."),
    deckOutline: toObjectArray(raw.deckOutline).map((item, index) => ({
      slide: Number.isFinite(item.slide) ? Math.max(1, Math.floor(item.slide)) : index + 1,
      title: toStringValue(item.title, "Slide"),
      purpose: toStringValue(item.purpose, "Purpose requires validation."),
      keyPoints: toStringArray(item.keyPoints)
    }))
  };
}

export function normalizeDepartmentOutput(department, raw) {
  if (department === "research") return normalizeResearchOutput(raw);
  if (department === "competitors") return normalizeCompetitorOutput(raw);
  if (department === "customers") return normalizeCustomerOutput(raw);
  if (department === "strategy") return normalizeStrategyOutput(raw);
  if (department === "brand") return normalizeBrandOutput(raw);
  if (department === "website") return normalizeWebsiteOutput(raw);
  if (department === "publishing") return normalizePublishingOutput(raw);

  if (!raw || typeof raw !== "object") {
    return raw;
  }

  return {
    ...normalizeBaseOutput(raw, "Department output requires validation."),
    ...raw
  };
}