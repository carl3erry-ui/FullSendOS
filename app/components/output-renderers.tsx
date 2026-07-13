"use client";

import { sanitizeOutputForDisplay } from "./agent-task-client";

/**
 * Structured output renderers for different agent types.
 * These components safely render structured task output without exposing raw data.
 */

// Orchestrator Output Renderer
export function OrchestratorOutputRenderer({ data }: { data: unknown }) {
  const safeData = sanitizeOutputForDisplay(data);

  if (!safeData || typeof safeData !== "object") {
    return <div className="text-sm text-slate-400">No output available.</div>;
  }

  const output = safeData as Record<string, unknown>;
  const summary = typeof output.summary === "string" ? output.summary : null;
  const assumptions = Array.isArray(output.assumptions) ? output.assumptions : [];
  const planned_tasks = Array.isArray(output.planned_tasks) ? output.planned_tasks : [];
  const risks = Array.isArray(output.risks) ? output.risks : [];
  const success_criteria = Array.isArray(output.success_criteria) ? output.success_criteria : [];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-1 text-sm font-medium text-cyan-300">Summary</h4>
          <p className="text-sm text-slate-200">{summary}</p>
        </div>
      )}

      {assumptions.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-2 text-sm font-medium text-cyan-300">Assumptions</h4>
          <ul className="space-y-1">
            {assumptions.map((assumption: unknown, idx: number) => (
              <li key={idx} className="text-sm text-slate-200">
                • {typeof assumption === "string" ? assumption : JSON.stringify(assumption)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {planned_tasks.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-2 text-sm font-medium text-cyan-300">Planned Tasks</h4>
          <div className="space-y-2">
            {planned_tasks.map((task: unknown, idx: number) => (
              <div
                key={idx}
                className="rounded bg-slate-800/50 p-2 text-sm text-slate-200"
              >
                {typeof task === "object" && task !== null
                  ? JSON.stringify(sanitizeOutputForDisplay(task), null, 2).split("\n").slice(0, 5).join("\n")
                  : String(task)}
              </div>
            ))}
          </div>
        </div>
      )}

      {risks.length > 0 && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/20 p-3">
          <h4 className="mb-2 text-sm font-medium text-amber-300">Risks</h4>
          <ul className="space-y-1">
            {risks.map((risk: unknown, idx: number) => (
              <li key={idx} className="text-sm text-amber-100">
                • {typeof risk === "string" ? risk : JSON.stringify(risk)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {success_criteria.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-2 text-sm font-medium text-emerald-300">Success Criteria</h4>
          <ul className="space-y-1">
            {success_criteria.map((criterion: unknown, idx: number) => (
              <li key={idx} className="text-sm text-slate-200">
                ✓ {typeof criterion === "string" ? criterion : JSON.stringify(criterion)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Research Output Renderer
export function ResearchOutputRenderer({ data }: { data: unknown }) {
  const safeData = sanitizeOutputForDisplay(data);

  if (!safeData || typeof safeData !== "object") {
    return <div className="text-sm text-slate-400">No output available.</div>;
  }

  const output = safeData as Record<string, unknown>;
  const executive_summary = typeof output.executive_summary === "string" ? output.executive_summary : null;
  const research_questions = Array.isArray(output.research_questions) ? output.research_questions : [];
  const findings = Array.isArray(output.findings) ? output.findings : [];
  const confidence = typeof output.confidence === "number" ? output.confidence : null;
  const gaps = Array.isArray(output.gaps) ? output.gaps : [];
  const recommendations = Array.isArray(output.recommendations) ? output.recommendations : [];

  return (
    <div className="space-y-4">
      {executive_summary && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-1 text-sm font-medium text-cyan-300">Executive Summary</h4>
          <p className="text-sm text-slate-200">{executive_summary}</p>
        </div>
      )}

      {research_questions.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-2 text-sm font-medium text-cyan-300">Research Questions</h4>
          <ul className="space-y-1">
            {research_questions.map((q: unknown, idx: number) => (
              <li key={idx} className="text-sm text-slate-200">
                ? {typeof q === "string" ? q : JSON.stringify(q)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings.length > 0 && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/20 p-3">
          <h4 className="mb-2 text-sm font-medium text-emerald-300">Findings</h4>
          <ul className="space-y-2">
            {findings.map((finding: unknown, idx: number) => (
              <li key={idx} className="text-sm text-emerald-100">
                {typeof finding === "object" && finding !== null
                  ? JSON.stringify(sanitizeOutputForDisplay(finding), null, 2)
                    .split("\n")
                    .slice(0, 3)
                    .join("\n")
                  : String(finding)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {confidence !== null && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-1 text-sm font-medium text-cyan-300">Confidence</h4>
          <p className="text-sm text-slate-200">
            {`${Math.round(confidence * 100)}%`}
          </p>
        </div>
      )}

      {gaps.length > 0 && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/20 p-3">
          <h4 className="mb-2 text-sm font-medium text-amber-300">Research Gaps</h4>
          <ul className="space-y-1">
            {gaps.map((gap: unknown, idx: number) => (
              <li key={idx} className="text-sm text-amber-100">
                ○ {typeof gap === "string" ? gap : JSON.stringify(gap)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-2 text-sm font-medium text-cyan-300">Recommendations</h4>
          <ul className="space-y-1">
            {recommendations.map((rec: unknown, idx: number) => (
              <li key={idx} className="text-sm text-slate-200">
                → {typeof rec === "string" ? rec : JSON.stringify(rec)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Quality Control Output Renderer
export function QualityControlOutputRenderer({ data }: { data: unknown }) {
  const safeData = sanitizeOutputForDisplay(data);

  if (!safeData || typeof safeData !== "object") {
    return <div className="text-sm text-slate-400">No output available.</div>;
  }

  const output = safeData as Record<string, unknown>;
  const verdict = typeof output.verdict === "string" ? output.verdict : null;
  const score = typeof output.score === "number" ? output.score : null;
  const summary = typeof output.summary === "string" ? output.summary : null;
  const passed_checks = Array.isArray(output.passed_checks) ? output.passed_checks : [];
  const failed_checks = Array.isArray(output.failed_checks) ? output.failed_checks : [];
  const unsupported_claims = Array.isArray(output.unsupported_claims) ? output.unsupported_claims : [];
  const required_revisions = Array.isArray(output.required_revisions) ? output.required_revisions : [];

  const isPass = verdict === "pass" || verdict === "approved";

  return (
    <div className="space-y-4">
      {verdict && (
        <div
          className={`rounded-lg border p-3 ${
            isPass
              ? "border-emerald-700 bg-emerald-950/20"
              : "border-rose-700 bg-rose-950/20"
          }`}
        >
          <h4 className="mb-1 text-sm font-medium text-cyan-300">Verdict</h4>
          <p
            className={`text-sm font-semibold ${
              isPass
                ? "text-emerald-300"
                : "text-rose-300"
            }`}
          >
            {verdict.toUpperCase()}
          </p>
        </div>
      )}

      {score !== null && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-1 text-sm font-medium text-cyan-300">Score</h4>
          <p className="text-sm font-semibold text-slate-200">
            {`${score.toFixed(1)}/10`}
          </p>
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
          <h4 className="mb-1 text-sm font-medium text-cyan-300">Summary</h4>
          <p className="text-sm text-slate-200">{summary}</p>
        </div>
      )}

      {passed_checks.length > 0 && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/20 p-3">
          <h4 className="mb-2 text-sm font-medium text-emerald-300">Passed Checks</h4>
          <ul className="space-y-1">
            {passed_checks.map((check: unknown, idx: number) => (
              <li key={idx} className="text-sm text-emerald-200">
                ✓ {typeof check === "string" ? check : JSON.stringify(check)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed_checks.length > 0 && (
        <div className="rounded-lg border border-rose-700 bg-rose-950/20 p-3">
          <h4 className="mb-2 text-sm font-medium text-rose-300">Failed Checks</h4>
          <ul className="space-y-1">
            {failed_checks.map((check: unknown, idx: number) => (
              <li key={idx} className="text-sm text-rose-200">
                ✗ {typeof check === "string" ? check : JSON.stringify(check)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unsupported_claims.length > 0 && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/20 p-3">
          <h4 className="mb-2 text-sm font-medium text-amber-300">Unsupported Claims</h4>
          <ul className="space-y-1">
            {unsupported_claims.map((claim: unknown, idx: number) => (
              <li key={idx} className="text-sm text-amber-200">
                ? {typeof claim === "string" ? claim : JSON.stringify(claim)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {required_revisions.length > 0 && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/20 p-3">
          <h4 className="mb-2 text-sm font-medium text-amber-300">Required Revisions</h4>
          <ul className="space-y-1">
            {required_revisions.map((rev: unknown, idx: number) => (
              <li key={idx} className="text-sm text-amber-200">
                ⚠ {typeof rev === "string" ? rev : JSON.stringify(rev)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Generic Fallback Renderer
export function GenericOutputRenderer({ data }: { data: unknown }) {
  const safeData = sanitizeOutputForDisplay(data);

  if (!safeData) {
    return <div className="text-sm text-slate-400">No output available.</div>;
  }

  if (typeof safeData === "string") {
    return <p className="text-sm text-slate-200">{safeData}</p>;
  }

  if (typeof safeData === "object") {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
        <pre className="overflow-auto text-xs text-slate-300">
          {JSON.stringify(safeData, null, 2)}
        </pre>
      </div>
    );
  }

  return <div className="text-sm text-slate-400">Unknown output format.</div>;
}
