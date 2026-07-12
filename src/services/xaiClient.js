function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data?.output)) {
    const parts = [];
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const block of item.content) {
        if (block?.type === "output_text" && typeof block.text === "string") {
          parts.push(block.text);
        }
      }
    }
    if (parts.length) return parts.join("\n").trim();
  }

  throw new Error("No output_text found in xAI response.");
}

function detectDepartmentFromPrompt(prompt) {
  const direct = prompt.match(/department:\s*([a-z-]+)/i);
  if (direct?.[1]) return direct[1].toLowerCase();

  const repair = prompt.match(/matching the\s+([a-z-]+)\s+contract/i);
  if (repair?.[1]) return repair[1].toLowerCase();

  return "research";
}

function buildDepartmentFallback(department) {
  const base = {
    summary: `Deterministic ${department} output generated in development fallback mode.`,
    claims: [],
    unknowns: [
      {
        question: "Live xAI output unavailable in local development fallback mode.",
        whyItMatters: "Department output is deterministic and should not be used as production intelligence.",
        recommendedMethod: "Configure XAI_API_KEY to run real workflow intelligence."
      }
    ],
    sourceIdsUsed: []
  };

  if (department === "research") {
    return {
      ...base,
      industryDefinition: "Industry context requires live research validation.",
      marketContext: ["No external calls were made in deterministic fallback mode."],
      trends: [
        {
          name: "Demand clarity",
          direction: "uncertain",
          implication: "Validate with real evidence once xAI is configured.",
          sourceIds: []
        }
      ],
      metrics: [],
      opportunities: ["Enable live model execution for sourced findings."],
      risks: ["Recommendations remain provisional without live model output."]
    };
  }

  if (department === "competitors") {
    return {
      ...base,
      competitors: [],
      comparisonDimensions: ["positioning", "offer", "distribution"],
      whitespace: ["No validated whitespace yet in fallback mode."],
      recommendedPosition: "Differentiate after live competitor research is available."
    };
  }

  if (department === "customers") {
    return {
      ...base,
      personas: [
        {
          name: "Primary Buyer",
          segment: "Core segment",
          description: "Placeholder persona for development fallback.",
          goals: ["Improve outcomes"],
          painPoints: ["Insufficient validated data"],
          buyingTriggers: ["Clear value evidence"],
          objections: ["Unverified assumptions"],
          channels: ["Website"],
          evidenceLevel: "hypothesis"
        }
      ],
      customerJourney: [
        {
          stage: "Awareness",
          customerQuestion: "Why this solution now?",
          recommendedResponse: "Share validated proof once live workflow is enabled.",
          primaryChannel: "Web"
        }
      ]
    };
  }

  if (department === "strategy") {
    return {
      ...base,
      strategicThesis: "Use deterministic local output only for workflow validation.",
      positioningStatement: "Transition to evidence-led positioning once xAI is configured.",
      valueProposition: "Reliable execution pipeline with traceable updates.",
      strategicPillars: [
        {
          name: "Execution reliability",
          rationale: "Ensure workflow run path is operational.",
          actions: ["Enable xAI credentials", "Re-run full workflow"],
          kpis: ["Run success rate"]
        }
      ],
      goToMarket: [
        {
          phase: "Alpha",
          timing: "Now",
          objective: "Validate the end-to-end run interaction.",
          actions: ["Run workflow", "Review status transition"]
        }
      ],
      ninetyDayPlan: [
        {
          priority: 1,
          action: "Enable production-grade AI configuration",
          ownerRole: "Engineering",
          timing: "Week 1",
          successMeasure: "Live runs complete without fallback"
        }
      ]
    };
  }

  if (department === "brand") {
    return {
      ...base,
      brandEssence: "Execution first",
      mission: "Turn strategy into dependable workflow outcomes.",
      vision: "A consistent operating system for consulting delivery.",
      values: ["Clarity", "Reliability", "Evidence"],
      personality: ["Direct", "Confident", "Practical"],
      voice: {
        attributes: ["Clear", "Actionable"],
        do: ["State assumptions", "Show next steps"],
        avoid: ["Overclaiming"]
      },
      messaging: {
        taglineOptions: ["Run. Learn. Deliver."],
        elevatorPitch: "FullSendOS helps teams execute consulting workflows with visible progress.",
        proofPoints: ["Traceable stage updates", "Deterministic development fallback"]
      },
      visualDirection: {
        palette: [{ name: "Slate", hex: "#0F172A" }],
        typographyDirection: ["Modern sans-serif"],
        imageryDirection: ["Operational dashboards"]
      }
    };
  }

  if (department === "website") {
    return {
      ...base,
      primaryGoal: "Guide visitors to initiate a workflow.",
      targetActions: ["Create project", "Run workflow"],
      sitemap: [
        {
          page: "Home",
          purpose: "Explain workflow value",
          sections: ["Overview", "Process", "CTA"],
          primaryCta: "Start workflow"
        }
      ],
      homepageWireframe: [
        {
          order: 1,
          section: "Hero",
          objective: "Position FullSendOS clearly",
          content: ["What it does", "Why it matters"],
          cta: "Create project"
        }
      ],
      imagePrompts: [
        {
          use: "Hero illustration",
          prompt: "Operational consulting dashboard with stage progress",
          aspectRatio: "16:9"
        }
      ],
      technicalRecommendations: ["Keep API route responses structured and observable."]
    };
  }

  return {
    ...base,
    reportTitle: "FullSendOS Alpha Workflow Report (Development Fallback)",
    subtitle: "Deterministic local output",
    executiveSummary: "Workflow execution completed in deterministic local fallback mode.",
    keyFindings: ["Run interaction is operational."],
    recommendations: [
      {
        priority: "immediate",
        recommendation: "Configure XAI_API_KEY for live outputs.",
        rationale: "Fallback mode is only for local development validation.",
        successMeasure: "Live workflow run returns modeled department outputs"
      }
    ],
    reportMarkdown: "# FullSendOS Alpha Workflow Report\n\nDevelopment fallback mode completed successfully.",
    onePageSummary: "Development fallback run succeeded; configure xAI key for production intelligence.",
    deckOutline: [
      {
        slide: 1,
        title: "Run status",
        purpose: "Confirm execution path",
        keyPoints: ["Workflow completed", "Fallback mode active"]
      }
    ]
  };
}

function buildDevFallbackResponse({ prompt, model }) {
  const department = detectDepartmentFromPrompt(prompt);
  const payload = buildDepartmentFallback(department);

  return {
    text: JSON.stringify(payload),
    model: `dev-fallback:${model}`,
    raw: { fallback: true, department }
  };
}

export async function callXai({ prompt, model = process.env.XAI_MODEL || "grok-4.5", maxOutputTokens }) {
  const apiKey = process.env.XAI_API_KEY;
  const allowDevFallback = process.env.NODE_ENV !== "production" && process.env.XAI_DEV_FALLBACK !== "false";
  const configuredMaxOutputTokens = Number(process.env.XAI_MAX_OUTPUT_TOKENS || 5000);
  const resolvedMaxOutputTokens = Number.isFinite(maxOutputTokens)
    ? maxOutputTokens
    : configuredMaxOutputTokens;

  if (!apiKey) {
    if (allowDevFallback) {
      return buildDevFallbackResponse({ prompt, model });
    }

    throw new Error("XAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      store: false,
      temperature: 0.2,
      max_output_tokens: Math.max(1000, Math.floor(resolvedMaxOutputTokens))
    })
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`xAI returned non-JSON HTTP ${response.status}: ${raw.slice(0, 500)}`);
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.message || raw;
    const normalizedMessage = typeof message === "string" ? message : JSON.stringify(message);
    const looksLikeCredentialError = /api key|incorrect api key|unauthorized|invalid api/i.test(normalizedMessage);

    if (allowDevFallback && looksLikeCredentialError) {
      return buildDevFallbackResponse({ prompt, model });
    }

    throw new Error(`xAI HTTP ${response.status}: ${normalizedMessage}`);
  }

  return { text: extractOutputText(data), model: data.model || model, raw: data };
}
