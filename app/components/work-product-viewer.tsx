"use client";

import {
  formatDepartmentName,
  hasExecutiveDeliverables,
  getDepartmentRunStatus,
  getLastPersistedFailure,
  type DepartmentName,
  type EngagementDetail,
  type WorkspaceProjectSummary,
  WORKFLOW_DEPARTMENTS,
} from "./work-product-model";
import { EngagementAgentTasksPanel } from "./engagement-agent-tasks-panel";
import { EngagementHumanInputPanel } from "./engagement-human-input-panel";
import { DataRoomPanel } from "./data-room-panel";
import { DeliverableExportPanel } from "./deliverable-export-panel";
import { CollaborationTracePanel } from "./collaboration-trace-panel";
import {
  inferReadiness,
  READINESS_LABELS,
  READINESS_DISCLAIMER,
  HUMAN_REVIEW_CHECKLIST,
  isClientSafe,
} from "@/services/deliverable-readiness";
import { selectAgentTeam } from "@/lib/agents/team-selection";
import {
  addHumanApprovalGate,
  addTimelineEvent,
  createCollaborationTrace,
  summarizeCollaborationTrace,
  type CollaborationTrace,
} from "@/lib/agents/collaboration-trace";
import { getWorkflowStabilityState } from "@/lib/workflows/workflow-stability";

type WorkProductViewerProps = {
  project: WorkspaceProjectSummary;
  detail: EngagementDetail | null;
  isLoading: boolean;
  loadError: string | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  runningProjectId: string | null;
  onRun: (projectId: string) => void;
  onAbort?: (projectId: string) => void;
};

type TopLevelSection =
  | "executive"
  | "analysis"
  | "department"
  | "evidence"
  | "agent-tasks"
  | "human-input"
  | "data-room"
  | "collaboration"
  | "exports";

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
  const label = status.replace(/-/g, " ");
  return (
    <span className="inline-flex w-fit rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
      {label}
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
      <div className="grid gap-3 md:grid-cols-2">
        {deck.map((slide, index) => {
          if (!slide || typeof slide !== "object") return null;
          const item = slide as {
            slide?: number;
            title?: string;
            purpose?: string;
            keyPoints?: string[];
            visualSuggestion?: string;
            evidenceNote?: string;
          };
          return (
            <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4" key={`slide-${index}`}>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Slide {item.slide ?? index + 1}</p>
              <p className="mt-1 text-base font-medium text-slate-100">{item.title || "Untitled slide"}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-cyan-300">Key Message</p>
              <p className="mt-1 text-sm text-slate-300">{item.purpose || "No key message provided."}</p>
              {Array.isArray(item.keyPoints) && item.keyPoints.length > 0 && (
                <>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-400">Supporting Points</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {item.keyPoints.map((point, keyPointIndex) => (
                      <li key={`key-point-${index}-${keyPointIndex}`}>{point}</li>
                    ))}
                  </ul>
                </>
              )}
              {item.visualSuggestion && (
                <>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-400">Visual Suggestion</p>
                  <p className="mt-1 text-sm text-slate-300">{item.visualSuggestion}</p>
                </>
              )}
              {item.evidenceNote && (
                <>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-emerald-300">Evidence Note</p>
                  <p className="mt-1 text-sm text-slate-300">{item.evidenceNote}</p>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceReferenceList({
  title,
  references,
  emptyMessage,
}: {
  title: string;
  references?: Array<{
    id: string;
    citationLabel: string;
    title: string;
    description: string;
    excerptPreview?: string;
    confidence?: number;
    verifiedStatus: string;
    sourceType?: string;
  }>;
  emptyMessage: string;
}) {
  if (!Array.isArray(references) || references.length === 0) {
    return (
      <section className="space-y-2">
        <SectionHeading title={title} />
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3 text-sm text-slate-400">{emptyMessage}</div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <SectionHeading title={title} />
      <div className="space-y-3">
        {references.map((reference) => (
          <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3" key={reference.id}>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
              <span>{reference.citationLabel}</span>
              <span>{reference.verifiedStatus.replace(/_/g, " ")}</span>
              {reference.sourceType && <span>{reference.sourceType.replace(/_/g, " ")}</span>}
            </div>
            <p className="mt-2 text-sm font-medium text-slate-100">{reference.title}</p>
            <p className="mt-1 text-sm text-slate-300">{reference.description}</p>
            {reference.excerptPreview && <p className="mt-2 text-sm text-slate-400">Excerpt: {reference.excerptPreview}</p>}
            {typeof reference.confidence === "number" && (
              <p className="mt-2 text-xs text-slate-400">Confidence: {Math.round(reference.confidence * 100)}%</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AssumptionsPanel({ assumptions }: { assumptions?: Array<{ id: string; statement: string; departmentId?: string; confidence?: number }> }) {
  if (!Array.isArray(assumptions) || assumptions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <SectionHeading title="Assumptions" subtitle="Separate these from verified facts before acting on recommendations." />
      <div className="space-y-3">
        {assumptions.map((assumption) => (
          <article className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3" key={assumption.id}>
            <p className="text-sm text-amber-100">{assumption.statement}</p>
            <p className="mt-2 text-xs text-amber-200/90">
              {assumption.departmentId ? `Department: ${assumption.departmentId}` : "Cross-functional assumption"}
              {typeof assumption.confidence === "number" ? ` | ${Math.round(assumption.confidence * 100)}% confidence` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OpenQuestionsPanel({ questions }: { questions?: Array<{ id: string; question: string; whyItMatters?: string; recommendedMethod?: string; relatedField?: string; humanInputRequestId?: string; verifiedStatus: string }> }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <SectionHeading title="Open Questions" subtitle="Unresolved items that still constrain confidence or decision quality." />
      <div className="space-y-3">
        {questions.map((question) => (
          <article className="rounded-lg border border-amber-900/70 bg-amber-950/30 p-3" key={question.id}>
            <p className="text-sm text-amber-100">{question.question}</p>
            {question.relatedField && <p className="mt-1 text-xs text-amber-200/90">Field: {question.relatedField}</p>}
            {question.humanInputRequestId && (
              <p className="mt-1 text-xs text-amber-200/90">Human Input Request: {question.humanInputRequestId}</p>
            )}
            {question.whyItMatters && <p className="mt-2 text-sm text-amber-200/90">Why it matters: {question.whyItMatters}</p>}
            {question.recommendedMethod && <p className="mt-2 text-sm text-amber-200/90">Recommended method: {question.recommendedMethod}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function ConfidenceSummaryPanel({
  summary,
  missingEvidence,
  recommendedNextActions,
}: {
  summary?: { level: "high" | "medium" | "low" | "pending"; score: number | null; rationale: string };
  missingEvidence?: string[];
  recommendedNextActions?: string[];
}) {
  if (!summary) return null;

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <SectionHeading title="Confidence Summary" />
      <p className="text-sm text-slate-100">
        {summary.level.toUpperCase()}
        {typeof summary.score === "number" ? ` (${Math.round(summary.score * 100)}%)` : ""}
      </p>
      <p className="text-sm text-slate-300">{summary.rationale}</p>
      {Array.isArray(missingEvidence) && missingEvidence.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-amber-300">Missing Evidence</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {missingEvidence.map((item, index) => (
              <li key={`missing-evidence-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(recommendedNextActions) && recommendedNextActions.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Recommended Next Actions</p>
          <ol className="mt-2 space-y-1 text-sm text-slate-300">
            {recommendedNextActions.map((item, index) => (
              <li key={`recommended-next-${index}`}>{index + 1}. {item}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function collectUnknowns(detail: EngagementDetail): Array<{ department: string; question: string; whyItMatters?: string; method?: string }> {
  const collected: Array<{ department: string; question: string; whyItMatters?: string; method?: string }> = [];

  for (const department of WORKFLOW_DEPARTMENTS) {
    const output = detail.departments?.[department] as Record<string, unknown> | null | undefined;
    const unknowns = Array.isArray(output?.unknowns) ? output.unknowns : [];

    for (const item of unknowns) {
      if (!item || typeof item !== "object") continue;
      const unknown = item as { question?: string; whyItMatters?: string; recommendedMethod?: string };
      if (!unknown.question) continue;

      collected.push({
          department: formatDepartmentName(department),
          question: unknown.question,
          whyItMatters: unknown.whyItMatters,
          method: unknown.recommendedMethod,
      });
    }
  }

  return collected;
}

function collectClaims(detail: EngagementDetail): Array<{ department: string; statement: string; confidence?: number; caveat?: string }> {
  const collected: Array<{ department: string; statement: string; confidence?: number; caveat?: string }> = [];

  for (const department of WORKFLOW_DEPARTMENTS) {
    const output = detail.departments?.[department] as Record<string, unknown> | null | undefined;
    const claims = Array.isArray(output?.claims) ? output.claims : [];

    for (const item of claims) {
      if (!item || typeof item !== "object") continue;
      const claim = item as { statement?: string; confidence?: number; caveat?: string };
      if (!claim.statement) continue;

      collected.push({
          department: formatDepartmentName(department),
          statement: claim.statement,
          confidence: claim.confidence,
          caveat: claim.caveat,
      });
    }
  }

  return collected;
}

function getTopLevelSection(section: string): TopLevelSection {
  if (section === "exports") return "exports";
  if (section === "collaboration") return "collaboration";
  if (section === "agent-tasks") return "agent-tasks";
  if (section === "human-input") return "human-input";
  if (section === "data-room") return "data-room";
  if (section.startsWith("department:")) return "department";
  if (section === "analysis") return "analysis";
  if (section === "evidence") return "evidence";
  return "executive";
}

function inferEngagementType(project: WorkspaceProjectSummary): string {
  const objective = (project.objective || "").toLowerCase();
  if (objective.includes("sba") || objective.includes("loan")) return "sba-loan";
  if (objective.includes("investor") || objective.includes("deck") || objective.includes("fundraising")) return "investor-deck";
  if (objective.includes("market") || objective.includes("entry") || objective.includes("expansion")) return "market-entry";
  if (objective.includes("brand")) return "brand-strategy";
  if (objective.includes("website") || objective.includes("digital")) return "website-strategy";
  if (objective.includes("operations") || objective.includes("process")) return "operations-review";
  if (objective.includes("financial") || objective.includes("finance")) return "financial-analysis";
  if (objective.includes("business plan") || objective.includes("plan")) return "business-plan";
  return "general-consulting";
}

function getProviderStatus(detail: EngagementDetail | null): "Configured" | "Not configured" | "Unknown" | "Live verification not run" {
  const activeModel = detail?.audit?.activeRun?.model || "";
  const runModels = Array.isArray(detail?.audit?.runs) ? detail.audit?.runs?.map((run) => run.model || "") : [];
  const combined = [activeModel, ...(runModels || [])].join(" ").toLowerCase();

  if (combined.includes("grok") || combined.includes("xai")) return "Configured";
  if (combined.trim().length === 0) return "Live verification not run";
  return "Unknown";
}

function buildCollaborationTracePreview(project: WorkspaceProjectSummary, detail: EngagementDetail | null): CollaborationTrace {
  const engagementType = inferEngagementType(project);
  const requestedDeliverables = detail?.brief?.requestedDeliverables || [];
  const team = selectAgentTeam({
    engagementType,
    title: project.companyName,
    description: project.objective,
    requestedDeliverables,
  });

  let trace = createCollaborationTrace(project.id, team.selectedAgents, team.selectionReasons);

  trace = addTimelineEvent(trace, {
    type: "task-assigned",
    message: `Workforce assigned for ${engagementType} workflow (${project.completedDepartments}/${project.totalDepartments} departments complete).`,
  });

  if (project.status === "running") {
    trace = addTimelineEvent(trace, {
      type: "task-assigned",
      message: "Live workflow in progress. Departments are actively generating output.",
    });
  }

  if (team.humanApprovalRequired) {
    for (const reason of team.humanApprovalReasons.slice(0, 2)) {
      trace = addHumanApprovalGate(trace, reason, "workflow-team-selection");
    }
  }

  if (project.status === "needs-review" || project.status === "complete" || project.status === "completed") {
    trace = addTimelineEvent(trace, {
      type: "executive-review-completed",
      message: "Executive deliverables generated. Human review required before client delivery.",
    });
  }

  trace.confidenceSummary = summarizeCollaborationTrace(trace);
  trace.principlesApplied = [
    "ACT_WITH_PURPOSE",
    "UNDERSTAND_BEFORE_RECOMMENDING",
    "COLLABORATE_ACROSS_DEPARTMENTS",
    "FINISH_WITH_ACTION",
  ];
  trace.leadershipDecisionCheck = {
    "Does this recommendation advance the stated engagement objective?": true,
    "Have relevant specialists been consulted?": team.selectedAgents.length > 2,
    "Are assumptions and risks visible?": true,
    "Would Executive Review be comfortable defending it?": project.status !== "failed",
  };

  return trace;
}

function AgentWorkforceStatusSection({
  project,
  detail,
  hasDeliverables,
}: {
  project: WorkspaceProjectSummary;
  detail: EngagementDetail | null;
  hasDeliverables: boolean;
}) {
  const providerStatus = getProviderStatus(detail);
  const readiness = inferReadiness(project.status);
  const readinessLabel = READINESS_LABELS[readiness];
  const engagementType = inferEngagementType(project);
  const team = selectAgentTeam({
    engagementType,
    title: project.companyName,
    description: project.objective,
    requestedDeliverables: detail?.brief?.requestedDeliverables || [],
  });

  const statusClass =
    providerStatus === "Configured"
      ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
      : providerStatus === "Not configured"
        ? "border-rose-700 bg-rose-950/30 text-rose-200"
        : "border-slate-700 bg-slate-950/40 text-slate-300";

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          title="Agent Workforce Status"
          subtitle="Internal Owner/Admin visibility: provider health, selected team, workflow status, review gates, and export readiness."
        />
        <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${statusClass}`}>
          Provider: {providerStatus}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Workflow status</p>
          <p className="mt-1 text-sm text-slate-200">{project.status.replace(/-/g, " ")}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Human review status</p>
          <p className="mt-1 text-sm text-slate-200">{readinessLabel}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Client-readiness</p>
          <p className="mt-1 text-sm text-slate-200">{isClientSafe(readiness) ? "Client-safe" : "Internal only"}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Export availability</p>
          <p className="mt-1 text-sm text-slate-200">{hasDeliverables ? "Available" : "Pending deliverables"}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Selected agent team</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {team.selectedAgents.map((agentId) => (
            <span key={agentId} className="rounded-full border border-cyan-800 bg-cyan-950/20 px-2 py-0.5 text-xs text-cyan-200">
              {agentId}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function getDepartmentSection(section: string): DepartmentName {
  if (!section.startsWith("department:")) return "research";
  const department = section.replace("department:", "") as DepartmentName;
  return WORKFLOW_DEPARTMENTS.includes(department) ? department : "research";
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
  const evidenceSummary = detail.deliverables?.evidenceSummary;
  const evidenceReferences = detail.deliverables?.evidenceReferences || [];
  const recommendations = Array.isArray(publishing?.recommendations) ? publishing.recommendations : [];
  const firstRecommendation = recommendations.find((item) => item && typeof item === "object") as
    | { recommendation?: string; rationale?: string }
    | undefined;
  const claims = collectClaims(detail);
  const claimsWithConfidence = claims.filter((claim) => typeof claim.confidence === "number");
  const confidencePercent =
    claimsWithConfidence.length > 0
      ? Math.round(
          claimsWithConfidence.reduce((sum, claim) => sum + (claim.confidence as number), 0) /
            claimsWithConfidence.length *
            100,
        )
      : null;
  const confidenceLabel = confidencePercent === null ? "Pending" : confidencePercent >= 75 ? "High" : confidencePercent >= 55 ? "Medium" : "Low";
  const unknowns = collectUnknowns(detail);
  const immediateActions = unknowns
    .slice(0, 4)
    .map((item) => item.method || item.question)
    .filter((item): item is string => Boolean(item));

  const readiness = inferReadiness(detail.status);
  const readinessLabel = READINESS_LABELS[readiness];
  const readinessDisclaimer = READINESS_DISCLAIMER[readiness];
  const clientSafe = isClientSafe(readiness);

  if (!report && !onePageSummary && (!Array.isArray(deckOutline) || deckOutline.length === 0)) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
        Executive deliverables are not available yet. Complete workflow execution to unlock consulting work product.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title="Executive Brief"
          subtitle="Final consulting outputs synthesized from validated department work product."
        />
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${clientSafe ? "border-emerald-700 bg-emerald-950/30 text-emerald-200" : "border-amber-700 bg-amber-950/30 text-amber-200"}`}>
          {readinessLabel}
        </span>
      </div>

      <div className={`rounded-lg border px-3 py-2 text-sm ${clientSafe ? "border-emerald-800 bg-emerald-950/20 text-emerald-200" : "border-amber-800 bg-amber-950/20 text-amber-200"}`}>
        {readinessDisclaimer}
      </div>

      <section className="space-y-4 rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-4">
        <SectionHeading
          title="Executive Decision Center"
          subtitle="Scan this first: recommendation, confidence, key reason, and immediate actions."
        />

        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Recommendation</p>
            <p className="mt-2 text-sm text-slate-100">{firstRecommendation?.recommendation || "Complete publishing synthesis to finalize recommendation."}</p>
          </article>

          <article className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Confidence</p>
            <p className="mt-2 text-sm text-slate-100">
              {confidenceLabel}
              {confidencePercent !== null ? ` (${confidencePercent}%)` : ""}
            </p>
          </article>

          <article className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Top Reason</p>
            <p className="mt-2 text-sm text-slate-100">{firstRecommendation?.rationale || "Primary rationale not yet available."}</p>
          </article>
        </div>

        {immediateActions.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Immediate Actions</p>
            <ol className="space-y-2 text-sm text-slate-100">
              {immediateActions.map((action, index) => (
                <li className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2" key={`immediate-action-${index}`}>
                  {index + 1}. {action}
                </li>
              ))}
            </ol>
          </section>
        )}
      </section>

      {onePageSummary && (
        <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <h5 className="text-sm uppercase tracking-[0.14em] text-cyan-300">One-Page Summary</h5>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{onePageSummary}</p>
        </article>
      )}

      {report && (
        <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <h5 className="text-sm uppercase tracking-[0.14em] text-cyan-300">Executive Report</h5>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{report}</p>
        </article>
      )}

      <DeckOutline deck={deckOutline} />

      <EvidenceReferenceList
        title="Sources Used"
        references={evidenceSummary?.evidenceUsed || evidenceReferences}
        emptyMessage="No evidence references are attached to this work product yet."
      />

      <AssumptionsPanel assumptions={evidenceSummary?.assumptions} />
      <OpenQuestionsPanel questions={evidenceSummary?.openQuestions} />
      <EvidenceReferenceList
        title="Human Confirmations"
        references={evidenceSummary?.humanConfirmations}
        emptyMessage="No human confirmations have been recorded yet."
      />
      <ConfidenceSummaryPanel
        summary={evidenceSummary?.confidenceSummary}
        missingEvidence={evidenceSummary?.missingEvidence}
        recommendedNextActions={evidenceSummary?.recommendedNextActions}
      />

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

      <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Human Review Checklist</p>
        <p className="text-xs text-slate-400">Complete each item before approving this work product for client delivery.</p>
        <ul className="space-y-2">
          {HUMAN_REVIEW_CHECKLIST.map((item, index) => (
            <li key={`review-${index}`} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-600 text-[10px] text-slate-500">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-amber-400">Status: {readinessLabel} — {clientSafe ? "This work product has been marked as client-ready." : "This work product has not been approved for client delivery."}</p>
      </section>
    </section>
  );
}

function AnalysisPanel({ detail }: { detail: EngagementDetail }) {
  const publishing = detail.departments?.publishing as Record<string, unknown> | null | undefined;
  const keyFindings = Array.isArray(publishing?.keyFindings) ? publishing.keyFindings : [];
  const recommendations = Array.isArray(publishing?.recommendations) ? publishing.recommendations : [];

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <SectionHeading
        title="Supporting Analysis"
        subtitle="Condensed synthesis supporting the executive recommendation."
      />

      <StringList title="Key Findings" items={keyFindings} />

      {recommendations.length > 0 && (
        <section className="space-y-2">
          <SectionHeading title="Recommendation Stack" />
          <div className="space-y-2">
            {recommendations.map((item, index) => {
              if (!item || typeof item !== "object") return null;
              const rec = item as { priority?: string; recommendation?: string; rationale?: string; successMeasure?: string };
              return (
                <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3" key={`analysis-rec-${index}`}>
                  <p className="text-sm font-medium text-slate-100">{rec.recommendation || "Recommendation"}</p>
                  {rec.priority && <p className="mt-1 text-xs uppercase tracking-[0.12em] text-cyan-300">{rec.priority}</p>}
                  {rec.rationale && <p className="mt-1 text-sm text-slate-300">Why it matters: {rec.rationale}</p>}
                  {rec.successMeasure && <p className="mt-1 text-sm text-slate-400">Success measure: {rec.successMeasure}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

function EvidencePanel({ detail }: { detail: EngagementDetail }) {
  const unknowns = collectUnknowns(detail);
  const claims = collectClaims(detail);
  const evidenceSummary = detail.deliverables?.evidenceSummary;
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <SectionHeading
        title="Evidence and Unknowns"
        subtitle="Validate assumptions and close unknowns before final decisions."
      />

      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Open Validation Questions</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">{unknowns.length}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Claims Logged</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-200">{claims.length}</p>
        </article>
      </div>

      <EvidenceReferenceList
        title="Sources Used"
        references={evidenceSummary?.evidenceUsed}
        emptyMessage="No safe evidence references are attached yet."
      />

      <AssumptionsPanel assumptions={evidenceSummary?.assumptions} />
      <OpenQuestionsPanel questions={evidenceSummary?.openQuestions} />
      <EvidenceReferenceList
        title="Human Confirmations"
        references={evidenceSummary?.humanConfirmations}
        emptyMessage="No human-confirmed facts have been recorded yet."
      />
      <ConfidenceSummaryPanel
        summary={evidenceSummary?.confidenceSummary}
        missingEvidence={evidenceSummary?.missingEvidence}
        recommendedNextActions={evidenceSummary?.recommendedNextActions}
      />

      {unknowns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-300">Action-Blocking Unknowns</p>
          <div className="space-y-2">
            {unknowns.slice(0, 8).map((unknown, index) => (
              <article className="rounded-lg border border-amber-900/70 bg-amber-950/30 p-3" key={`evidence-unknown-${index}`}>
                <p className="text-sm text-amber-100">{unknown.question}</p>
                <p className="mt-1 text-xs text-amber-200/90">Department: {unknown.department}</p>
                {unknown.whyItMatters && <p className="mt-1 text-sm text-amber-200/90">Why it matters: {unknown.whyItMatters}</p>}
                {unknown.method && <p className="mt-1 text-sm text-amber-200/90">Recommended method: {unknown.method}</p>}
              </article>
            ))}
          </div>
        </div>
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
  onAbort,
}: WorkProductViewerProps) {
  const progressText = `${project.completedDepartments}/${project.totalDepartments} departments`;
  const runFailure = getLastPersistedFailure(detail);
  const isRunActive = project.status === "running" || runningProjectId === project.id;
  const lifecycleStatus = project.lifecycleStatus || "active";
  const canRun = lifecycleStatus === "active";
  const topSection = getTopLevelSection(activeSection);
  const selectedDepartment = getDepartmentSection(activeSection);
  const hasDeliverables = hasExecutiveDeliverables(detail);
  const collaborationTrace = buildCollaborationTracePreview(project, detail);
  const workflowStability = getWorkflowStabilityState(
    {
      status: project.status,
      updatedAt: project.updatedAt,
      departments: detail?.audit?.runs
        ? detail.audit.runs.map((run) => ({
            department: run.department,
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            error: run.error,
          }))
        : undefined,
    },
    {
      timeoutMs: 10 * 60 * 1000,
      stuckDepartmentTimeoutMs: 8 * 60 * 1000,
    },
  );
  const runLabel =
    runningProjectId === project.id
      ? "Running..."
      : project.status === "running"
        ? "In Progress"
        : project.id.startsWith("DEMO-")
          ? "Run demo workflow"
          : "Run live Grok workflow";

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
          disabled={Boolean(runningProjectId) || project.status === "running" || !canRun}
          title={!canRun ? "Restore this engagement before running workflow." : undefined}
        >
          {runLabel}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Trigger workflow manually only. Live provider execution is never automatic.
      </p>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${workflowStability.state === "stuck" || workflowStability.state === "timed-out" ? "border-amber-700 bg-amber-950/20 text-amber-100" : workflowStability.state === "failed" ? "border-rose-700 bg-rose-950/20 text-rose-100" : "border-slate-700 bg-slate-950/60 text-slate-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Workflow stability: {workflowStability.state}</p>
          {(workflowStability.state === "stuck" || workflowStability.state === "timed-out") && (
            <span className="rounded-full border border-amber-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-amber-200">
              Human review required if outputs are partial
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">{workflowStability.reason}</p>
        <p className="mt-1 text-xs text-slate-400">Last updated: {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : "Unknown"}</p>
        {workflowStability.stuckDepartment?.department && (
          <p className="mt-1 text-xs text-slate-400">Current department: {workflowStability.stuckDepartment.department}</p>
        )}
        {(workflowStability.state === "stuck" || workflowStability.state === "timed-out") && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-rose-700 px-3 py-2 text-xs text-rose-200 hover:border-rose-500 disabled:opacity-60"
              type="button"
              onClick={() => onSectionChange("collaboration")}
              disabled={Boolean(runningProjectId)}
            >
              Review collaboration trace
            </button>
            <button
              className="rounded-lg border border-amber-700 px-3 py-2 text-xs text-amber-200 hover:border-amber-500 disabled:opacity-60"
              type="button"
              onClick={() => onAbort?.(project.id)}
              disabled={Boolean(runningProjectId)}
            >
              Abort stalled workflow
            </button>
          </div>
        )}
      </div>

      {!canRun && (
        <div className="mt-4 rounded-xl border border-amber-800 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          This engagement is {lifecycleStatus}. Restore it to active before running workflow again.
        </div>
      )}

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

      {(project.status === "needs-review" || project.status === "complete" || project.status === "completed") && (
        <div className="mt-6 rounded-xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          Ready for review. Executive brief leads, supporting analysis follows, then department work product and evidence details.
        </div>
      )}

      <AgentWorkforceStatusSection project={project} detail={detail} hasDeliverables={hasDeliverables} />

      <section className="mt-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "executive" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("executive")}
            type="button"
          >
            Executive Brief
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "analysis" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("analysis")}
            type="button"
          >
            Supporting Analysis
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "department" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange(`department:${selectedDepartment}`)}
            type="button"
          >
            Department Work Product
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "evidence" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("evidence")}
            type="button"
          >
            Evidence and Unknowns
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "agent-tasks" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("agent-tasks")}
            type="button"
          >
            Agent Tasks
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "human-input" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("human-input")}
            type="button"
          >
            Human Input / Action Center
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "data-room" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("data-room")}
            type="button"
          >
            Data Room
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "collaboration" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
            onClick={() => onSectionChange("collaboration")}
            type="button"
          >
            Collaboration Trace
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${topSection === "exports" ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"} ${!hasDeliverables ? "opacity-60" : ""}`}
            onClick={() => hasDeliverables && onSectionChange("exports")}
            type="button"
            title={!hasDeliverables ? "Exports unlock after executive deliverables are generated." : undefined}
          >
            Export Deliverables
          </button>
        </div>

        {topSection === "department" && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            {WORKFLOW_DEPARTMENTS.map((department) => (
              <button
                className={`rounded-lg border px-3 py-2 text-sm ${selectedDepartment === department ? "border-cyan-500 bg-cyan-950/50 text-cyan-200" : "border-slate-700 bg-slate-950/40 text-slate-300"}`}
                key={department}
                onClick={() => onSectionChange(`department:${department}`)}
                type="button"
              >
                {formatDepartmentName(department)}
              </button>
            ))}
          </div>
        )}

        {isLoading && <p className="text-sm text-slate-400">Loading engagement work product...</p>}
        {loadError && <p className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{loadError}</p>}

        {!isLoading && !loadError && detail && topSection === "executive" && <ExecutiveDeliverables detail={detail} />}

        {!isLoading && !loadError && detail && topSection === "analysis" && <AnalysisPanel detail={detail} />}

        {!isLoading && !loadError && detail && topSection === "evidence" && <EvidencePanel detail={detail} />}

        {!isLoading && !loadError && detail && topSection === "agent-tasks" && (
          <EngagementAgentTasksPanel
            engagementId={project.id}
            engagementName={project.companyName}
            engagementObjective={project.objective}
          />
        )}

        {!isLoading && !loadError && detail && topSection === "human-input" && (
          <EngagementHumanInputPanel engagementId={project.id} />
        )}

        {!isLoading && !loadError && detail && topSection === "data-room" && (
          <DataRoomPanel ownerId={project.id} scope="engagement" />
        )}

        {!isLoading && !loadError && detail && topSection === "collaboration" && (
          <section className="space-y-3">
            <div className="rounded-lg border border-cyan-800 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-200">
              Static Collaboration Preview — live trace persistence is deferred in this slice.
            </div>
            <CollaborationTracePanel trace={collaborationTrace} showGuardrailEvents />
          </section>
        )}

        {!isLoading && !loadError && detail && topSection === "exports" && (
          <DeliverableExportPanel engagementId={project.id} hasDeliverables={hasDeliverables} />
        )}

        {!isLoading &&
          !loadError &&
          detail &&
          topSection === "department" &&
          (() => {
            const department = selectedDepartment;
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
