"use client";

import {
  formatDepartmentName,
  getDepartmentRunStatus,
  getLastPersistedFailure,
  type DepartmentName,
  type EngagementDetail,
  type WorkspaceProjectSummary,
  WORKFLOW_DEPARTMENTS,
} from "./work-product-model";

type WorkProductViewerProps = {
  project: WorkspaceProjectSummary;
  detail: EngagementDetail | null;
  isLoading: boolean;
  loadError: string | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  runningProjectId: string | null;
  onRun: (projectId: string) => void;
};

const INTERNAL_FIELD_PATTERN = /(debug|diagnostic|raw|provider|prompt|token|secret|api.?key|stack)/i;

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h4 className="text-sm uppercase tracking-[0.16em] text-cyan-300">{title}</h4>
      {subtitle && <p className="mt-2 text-sm text-slate-300">{subtitle}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
      {status}
    </span>
  );
}

function Narrative({ text }: { text?: unknown }) {
  if (typeof text !== "string" || !text.trim()) return null;
  return <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{text}</p>;
}

function StringList({ title, items }: { title: string; items?: unknown }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionHeading title={title} />
      <ul className="space-y-2 text-sm text-slate-200">
        {items.map((item, index) => (
          <li className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2" key={`${title}-${index}`}>
            {typeof item === "string" ? item : "Structured value"}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClaimsList({ claims }: { claims?: unknown }) {
  if (!Array.isArray(claims) || claims.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionHeading title="Claims" subtitle="Evidence classifications are preserved from validated output." />
      <div className="space-y-3">
        {claims.map((claim, index) => {
          if (!claim || typeof claim !== "object") return null;
          const item = claim as {
            statement?: string;
            classification?: string;
            confidence?: number;
            caveat?: string;
            sourceIds?: string[];
          };

          return (
            <article className="rounded-lg border border-slate-800 bg-slate-950/60 p-3" key={`claim-${index}`}>
              <p className="text-sm text-slate-100">{item.statement || "Claim unavailable"}</p>
              <p className="mt-2 text-xs text-slate-400">
                {(item.classification || "unknown").toUpperCase()} | {typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}% confidence` : "confidence unavailable"} | {Array.isArray(item.sourceIds) ? `${item.sourceIds.length} source references` : "0 source references"}
              </p>
              {item.caveat && <p className="mt-2 text-xs text-amber-300">Caveat: {item.caveat}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetricsCards({ metrics }: { metrics?: unknown }) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionHeading title="Metrics" />
      <div className="grid gap-3 md:grid-cols-2">
        {metrics.map((metric, index) => {
          if (!metric || typeof metric !== "object") return null;
          const item = metric as {
            name?: string;
            value?: string | number;
            unit?: string;
            period?: string;
            classification?: string;
            confidence?: number;
          };

          return (
            <article className="rounded-lg border border-slate-800 bg-slate-950/60 p-3" key={`metric-${index}`}>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{item.name || "Metric"}</p>
              <p className="mt-2 text-lg font-medium text-slate-100">
                {typeof item.value === "number" || typeof item.value === "string" ? String(item.value) : "Unavailable"}
                {item.unit ? ` ${item.unit}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {(item.classification || "unknown").toUpperCase()} | {typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}% confidence` : "confidence unavailable"}
              </p>
              {item.period && <p className="mt-1 text-xs text-slate-500">Period: {item.period}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrendsList({ trends }: { trends?: unknown }) {
  if (!Array.isArray(trends) || trends.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionHeading title="Trends" />
      <div className="space-y-3">
        {trends.map((trend, index) => {
          if (!trend || typeof trend !== "object") return null;
          const item = trend as { name?: string; direction?: string; implication?: string };
          return (
            <article className="rounded-lg border border-slate-800 bg-slate-950/60 p-3" key={`trend-${index}`}>
              <p className="text-sm text-slate-100">{item.name || "Trend"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-cyan-300">{item.direction || "unknown"}</p>
              <p className="mt-2 text-sm text-slate-300">{item.implication || "No implication supplied."}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UnknownsList({ unknowns }: { unknowns?: unknown }) {
  if (!Array.isArray(unknowns) || unknowns.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionHeading title="Open Unknowns" subtitle="Questions that still require human validation." />
      <div className="space-y-3">
        {unknowns.map((unknown, index) => {
          if (!unknown || typeof unknown !== "object") return null;
          const item = unknown as { question?: string; whyItMatters?: string; recommendedMethod?: string };
          return (
            <article className="rounded-lg border border-amber-900 bg-amber-950/25 p-3" key={`unknown-${index}`}>
              <p className="text-sm text-amber-100">{item.question || "Unknown question"}</p>
              <p className="mt-2 text-sm text-amber-200/90">Why it matters: {item.whyItMatters || "Not provided"}</p>
              <p className="mt-2 text-sm text-amber-200/90">Recommended method: {item.recommendedMethod || "Not provided"}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DeckOutline({ deck }: { deck?: unknown }) {
  if (!Array.isArray(deck) || deck.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionHeading title="Presentation Deck Outline" />
      <div className="space-y-3">
        {deck.map((slide, index) => {
          if (!slide || typeof slide !== "object") return null;
          const item = slide as { slide?: number; title?: string; purpose?: string; keyPoints?: string[] };
          return (
            <article className="rounded-lg border border-slate-800 bg-slate-950/60 p-3" key={`slide-${index}`}>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Slide {item.slide ?? index + 1}</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{item.title || "Untitled slide"}</p>
              <p className="mt-2 text-sm text-slate-300">Key message: {item.purpose || "No key message provided."}</p>
              {Array.isArray(item.keyPoints) && item.keyPoints.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {item.keyPoints.map((point, keyPointIndex) => (
                    <li key={`key-point-${index}-${keyPointIndex}`}>{point}</li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RenderUnformatted({ output, knownKeys }: { output: Record<string, unknown>; knownKeys: string[] }) {
  const entries = Object.entries(output).filter(([key, value]) => {
    if (knownKeys.includes(key)) return false;
    if (INTERNAL_FIELD_PATTERN.test(key)) return false;
    return value !== null && value !== undefined;
  });

  if (entries.length === 0) return null;

  return (
    <section className="space-y-2">
      <SectionHeading title="Additional Structured Content" subtitle="Unformatted fields from validated output." />
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <article className="rounded-lg border border-slate-800 bg-slate-950/60 p-3" key={key}>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{key}</p>
            {typeof value === "string" && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{value}</p>}
            {Array.isArray(value) && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {value.slice(0, 8).map((item, index) => (
                  <li key={`${key}-${index}`}>{typeof item === "string" ? item : "Structured value"}</li>
                ))}
              </ul>
            )}
            {!Array.isArray(value) && typeof value === "object" && value && (
              <div className="mt-2 space-y-1 text-sm text-slate-300">
                {Object.entries(value as Record<string, unknown>)
                  .filter(([nestedKey]) => !INTERNAL_FIELD_PATTERN.test(nestedKey))
                  .slice(0, 8)
                  .map(([nestedKey, nestedValue]) => (
                    <p key={`${key}-${nestedKey}`}>
                      <span className="text-slate-400">{nestedKey}:</span>{" "}
                      {typeof nestedValue === "string" || typeof nestedValue === "number" ? String(nestedValue) : "Structured value"}
                    </p>
                  ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function DepartmentPanel({ detail, department }: { detail: EngagementDetail; department: DepartmentName }) {
  const output = detail.departments?.[department] as Record<string, unknown> | null | undefined;
  const status = getDepartmentRunStatus(detail, department);
  const failedRun = [...(detail.audit?.runs || [])]
    .reverse()
    .find((run) => run?.department === department && run.status === "failed");

  if (!output) {
    return (
      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between">
          <SectionHeading title={formatDepartmentName(department)} subtitle="Department output" />
          <StatusPill status={status} />
        </div>
        {status === "failed" ? (
          <p className="text-sm text-rose-200">Failed validation in this department. {failedRun?.error || "Review persisted warnings."}</p>
        ) : (
          <p className="text-sm text-slate-400">No validated output is available yet for this department.</p>
        )}
      </section>
    );
  }

  const commonKnownKeys = ["summary", "claims", "unknowns", "sourceIdsUsed", "opportunities", "risks", "metrics", "trends"];
  const departmentSpecificKeys: Record<DepartmentName, string[]> = {
    research: ["industryDefinition", "marketContext"],
    competitors: ["competitors", "comparisonDimensions", "whitespace", "recommendedPosition"],
    customers: ["personas", "customerJourney"],
    strategy: ["strategicThesis", "positioningStatement", "valueProposition", "strategicPillars", "goToMarket", "ninetyDayPlan"],
    brand: ["brandEssence", "mission", "vision", "values", "personality", "voice", "messaging", "visualDirection"],
    website: ["primaryGoal", "targetActions", "sitemap", "homepageWireframe", "imagePrompts", "technicalRecommendations"],
    publishing: ["reportTitle", "subtitle", "executiveSummary", "keyFindings", "recommendations", "reportMarkdown", "onePageSummary", "deckOutline"],
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title={formatDepartmentName(department)} subtitle="Validated consulting work product" />
        <StatusPill status={status} />
      </div>

      <Narrative text={output.summary} />
      {department === "research" && <Narrative text={output.industryDefinition} />}
      {department === "competitors" && <Narrative text={output.recommendedPosition} />}
      {department === "strategy" && <Narrative text={output.strategicThesis} />}
      {department === "brand" && <Narrative text={output.brandEssence} />}
      {department === "website" && <Narrative text={output.primaryGoal} />}
      {department === "publishing" && <Narrative text={output.executiveSummary} />}

      <ClaimsList claims={output.claims} />
      <MetricsCards metrics={output.metrics} />
      <TrendsList trends={output.trends} />
      <StringList title="Market Context" items={output.marketContext} />
      <StringList title="Opportunities" items={output.opportunities} />
      <StringList title="Risks" items={output.risks} />
      <StringList title="Comparison Dimensions" items={output.comparisonDimensions} />
      <StringList title="Whitespace Opportunities" items={output.whitespace} />
      <StringList title="Key Findings" items={output.keyFindings} />
      <StringList title="Target Actions" items={output.targetActions} />
      <StringList title="Technical Recommendations" items={output.technicalRecommendations} />
      <UnknownsList unknowns={output.unknowns} />
      <DeckOutline deck={output.deckOutline} />
      <RenderUnformatted output={output} knownKeys={[...commonKnownKeys, ...departmentSpecificKeys[department]]} />
    </section>
  );
}

function ExecutiveDeliverables({ detail }: { detail: EngagementDetail }) {
  const report = detail.deliverables?.executiveReport;
  const onePageSummary = detail.deliverables?.onePageSummary;
  const deckOutline = detail.deliverables?.deckOutline;
  const publishing = detail.departments?.publishing as Record<string, unknown> | null | undefined;
  const recommendations = Array.isArray(publishing?.recommendations) ? publishing.recommendations : [];

  if (!report && !onePageSummary && (!Array.isArray(deckOutline) || deckOutline.length === 0)) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
        Executive deliverables are not available yet. Complete workflow execution to unlock consulting work product.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <SectionHeading
        title="Executive Deliverables"
        subtitle="Final consulting outputs synthesized from validated department work product."
      />

      {report && (
        <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <h5 className="text-sm uppercase tracking-[0.14em] text-cyan-300">Executive Report</h5>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{report}</p>
        </article>
      )}

      {onePageSummary && (
        <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <h5 className="text-sm uppercase tracking-[0.14em] text-cyan-300">One-Page Summary</h5>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{onePageSummary}</p>
        </article>
      )}

      <DeckOutline deck={deckOutline} />

      {recommendations.length > 0 && (
        <section className="space-y-2">
          <SectionHeading title="Recommended Next Steps" />
          <ul className="space-y-2 text-sm text-slate-200">
            {recommendations.map((item, index) => {
              if (!item || typeof item !== "object") return null;
              const rec = item as { priority?: string; recommendation?: string; rationale?: string; successMeasure?: string };
              return (
                <li className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2" key={`next-step-${index}`}>
                  <p className="font-medium text-slate-100">{rec.recommendation || "Recommendation"}</p>
                  {rec.priority && <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{rec.priority}</p>}
                  {rec.rationale && <p className="mt-1 text-slate-300">{rec.rationale}</p>}
                  {rec.successMeasure && <p className="mt-1 text-slate-400">Success measure: {rec.successMeasure}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

export function WorkProductViewer({
  project,
  detail,
  isLoading,
  loadError,
  activeSection,
  onSectionChange,
  runningProjectId,
  onRun,
}: WorkProductViewerProps) {
  const progressText = `${project.completedDepartments}/${project.totalDepartments} departments`;
  const runFailure = getLastPersistedFailure(detail);
  const isRunActive = project.status === "running" || runningProjectId === project.id;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Engagement workspace</p>
          <h2 className="mt-2 text-2xl font-semibold">{project.companyName}</h2>
          <p className="mt-2 text-sm text-slate-300">{project.objective || "No objective defined."}</p>
        </div>
        <StatusPill status={project.status} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Engagement ID</p>
          <p className="mt-2 break-all text-sm text-slate-200">{project.id}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Progress</p>
          <p className="mt-2 text-sm text-slate-200">{progressText}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Last update</p>
          <p className="mt-2 text-sm text-slate-200">{project.updatedAt ? new Date(project.updatedAt).toLocaleString() : "Not available"}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-xl border border-cyan-700 px-3 py-2 text-sm text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => onRun(project.id)}
          disabled={Boolean(runningProjectId) || project.status === "running"}
        >
          {runningProjectId === project.id ? "Running..." : project.status === "running" ? "In Progress" : "Run engagement workflow"}
        </button>
      </div>

      {project.status === "draft" && (
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
          No validated work product is available yet. Run the engagement workflow to generate consulting deliverables.
        </div>
      )}

      {isRunActive && (
        <div className="mt-6 rounded-xl border border-cyan-800 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-100">
          Consulting departments are currently producing work product. Completed outputs remain visible while processing continues.
        </div>
      )}

      {project.status === "failed" && (
        <div className="mt-6 rounded-xl border border-rose-800 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          Engagement did not complete successfully. {runFailure || "Review run history and retry after resolving the issue."}
        </div>
      )}

      {(project.status === "needs-review" || project.status === "complete") && (
        <div className="mt-6 rounded-xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          Ready for review. Executive deliverables are shown first, followed by department work product.
        </div>
      )}

      <section className="mt-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${activeSection === "executive" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("executive")}
            type="button"
          >
            Executive Deliverables
          </button>
          {WORKFLOW_DEPARTMENTS.map((department) => (
            <button
              className={`rounded-lg border px-3 py-2 text-sm ${activeSection === `department:${department}` ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
              key={department}
              onClick={() => onSectionChange(`department:${department}`)}
              type="button"
            >
              {formatDepartmentName(department)}
            </button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-slate-400">Loading engagement work product...</p>}
        {loadError && <p className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{loadError}</p>}

        {!isLoading && !loadError && detail && activeSection === "executive" && <ExecutiveDeliverables detail={detail} />}

        {!isLoading &&
          !loadError &&
          detail &&
          activeSection.startsWith("department:") &&
          (() => {
            const department = activeSection.replace("department:", "") as DepartmentName;
            if (!WORKFLOW_DEPARTMENTS.includes(department)) {
              return (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                  Department section unavailable.
                </div>
              );
            }

            return <DepartmentPanel detail={detail} department={department} />;
          })()}
      </section>
    </section>
  );
}

export const __testOnly = {
  INTERNAL_FIELD_PATTERN,
};

export default WorkProductViewer;
