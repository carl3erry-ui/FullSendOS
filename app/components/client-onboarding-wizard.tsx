"use client";

import { useMemo, useState } from "react";
import type { ClientBaseline } from "@/schemas/client-baseline";

type WizardProps = {
  clientId: string;
  clientName: string;
  initialBaseline: ClientBaseline;
  onSaved?: (baseline: ClientBaseline) => void;
  onComplete?: (baseline: ClientBaseline) => void;
};

type StepKey =
  | "company"
  | "customers"
  | "goals"
  | "competitors"
  | "brand"
  | "operations"
  | "documents";

const STEPS: Array<{ key: StepKey; label: string; helper: string }> = [
  { key: "company", label: "Company Basics", helper: "Build the baseline identity and market context." },
  { key: "customers", label: "Customer Profile", helper: "Capture who buys and why they choose you." },
  { key: "goals", label: "Business Goals", helper: "Define what this engagement must accomplish." },
  { key: "competitors", label: "Competitive Context", helper: "Document threats and differentiation." },
  { key: "brand", label: "Brand and Voice", helper: "Set communication tone and writing guidance." },
  { key: "operations", label: "Operational Context", helper: "Capture practical constraints and bottlenecks." },
  { key: "documents", label: "Document Checklist", helper: "Flag what files are available right now." },
];

function csvToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToCsv(items: string[]): string {
  return items.join(", ");
}

function baselineProgressScore(baseline: ClientBaseline): number {
  const checks = [
    baseline.companyOverview.companyName,
    baseline.companyOverview.industry,
    baseline.companyOverview.locationMarketsServed,
    baseline.companyOverview.currentStage,
    baseline.customers.targetCustomers,
    baseline.goals.engagementPurpose,
    baseline.goals.desiredDeliverable,
    baseline.competitors.knownCompetitors.length ? "yes" : "",
    baseline.brandVoice.tone,
    baseline.operations.currentBottlenecks.length ? "yes" : "",
    baseline.availableDocuments.length ? "yes" : "",
  ];

  const complete = checks.filter((item) => Boolean(String(item).trim())).length;
  return Math.round((complete / checks.length) * 100);
}

export function ClientOnboardingWizard({
  clientId,
  clientName,
  initialBaseline,
  onSaved,
  onComplete,
}: WizardProps) {
  const [baseline, setBaseline] = useState<ClientBaseline>(initialBaseline);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const completion = useMemo(() => baselineProgressScore(baseline), [baseline]);
  const activeStep = STEPS[activeStepIndex];

  function update(partial: Partial<ClientBaseline>) {
    setBaseline((previous) => ({ ...previous, ...partial }));
  }

  function updateNested<K extends keyof ClientBaseline>(key: K, partial: Partial<ClientBaseline[K]>) {
    setBaseline((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] as object),
        ...(partial as object),
      },
    }));
  }

  async function persist(mode: "draft" | "complete") {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/clients/${clientId}/baseline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseline),
      });
      const data = await response.json();

      if (!response.ok) {
        const fieldErrors = Array.isArray(data?.fieldErrors)
          ? data.fieldErrors.slice(0, 5).map((entry: { path?: string; message?: string }) => `${entry.path}: ${entry.message}`)
          : [];
        const summary = typeof data?.error === "string" ? data.error : "Unable to save onboarding.";
        throw new Error(fieldErrors.length ? `${summary} ${fieldErrors.join(" | ")}` : summary);
      }

      setBaseline(data as ClientBaseline);
      setNotice(mode === "draft" ? "Draft saved." : "Onboarding baseline completed.");
      onSaved?.(data as ClientBaseline);
      if (mode === "complete") {
        onComplete?.(data as ClientBaseline);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save onboarding.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Client Onboarding</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">{clientName} baseline builder</h3>
          <p className="mt-1 text-sm text-slate-400">Guide a blank account to a usable AI-ready baseline.</p>
        </div>
        <div className="rounded-xl border border-cyan-800 bg-cyan-950/40 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Progress</p>
          <p className="text-lg font-semibold text-cyan-100">{completion}%</p>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded bg-slate-800">
        <div className="h-full bg-cyan-500 transition-all" style={{ width: `${completion}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STEPS.map((step, index) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setActiveStepIndex(index)}
            className={`rounded-lg border px-3 py-2 text-xs ${
              index === activeStepIndex
                ? "border-cyan-500 bg-cyan-950/40 text-cyan-200"
                : "border-slate-700 bg-slate-950/50 text-slate-300"
            }`}
          >
            {index + 1}. {step.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-sm font-semibold text-slate-200">{activeStep.label}</p>
        <p className="mt-1 text-xs text-slate-400">{activeStep.helper}</p>

        {activeStep.key === "company" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Company name"
              value={baseline.companyOverview.companyName}
              onChange={(event) => updateNested("companyOverview", { companyName: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Website"
              value={baseline.companyOverview.website}
              onChange={(event) => updateNested("companyOverview", { website: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Industry"
              value={baseline.companyOverview.industry}
              onChange={(event) => updateNested("companyOverview", { industry: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Locations/markets served"
              value={baseline.companyOverview.locationMarketsServed}
              onChange={(event) => updateNested("companyOverview", { locationMarketsServed: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Current stage"
              value={baseline.companyOverview.currentStage}
              onChange={(event) => updateNested("companyOverview", { currentStage: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Team size"
              value={baseline.companyOverview.teamCount}
              onChange={(event) => updateNested("companyOverview", { teamCount: event.target.value })}
            />
            <textarea
              className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Locations (comma-separated)"
              value={listToCsv(baseline.companyOverview.locations)}
              onChange={(event) => updateNested("companyOverview", { locations: csvToList(event.target.value) })}
            />
            <textarea
              className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Business model"
              value={baseline.businessModel.model}
              onChange={(event) => updateNested("businessModel", { model: event.target.value })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Services/products (comma-separated)"
              value={listToCsv(baseline.businessModel.servicesOrProducts)}
              onChange={(event) => updateNested("businessModel", { servicesOrProducts: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Markets (comma-separated)"
              value={listToCsv(baseline.markets)}
              onChange={(event) => update({ markets: csvToList(event.target.value) })}
            />
          </div>
        )}

        {activeStep.key === "customers" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <textarea
              className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Target customers"
              value={baseline.customers.targetCustomers}
              onChange={(event) => updateNested("customers", { targetCustomers: event.target.value })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Customer segments (comma-separated)"
              value={listToCsv(baseline.customers.customerSegments)}
              onChange={(event) => updateNested("customers", { customerSegments: csvToList(event.target.value) })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Price sensitivity"
              value={baseline.customers.priceSensitivity}
              onChange={(event) => updateNested("customers", { priceSensitivity: event.target.value })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Buying motivations (comma-separated)"
              value={listToCsv(baseline.customers.buyingMotivations)}
              onChange={(event) => updateNested("customers", { buyingMotivations: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Key customer problems (comma-separated)"
              value={listToCsv(baseline.customers.keyProblems)}
              onChange={(event) => updateNested("customers", { keyProblems: csvToList(event.target.value) })}
            />
          </div>
        )}

        {activeStep.key === "goals" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Growth goal"
              value={baseline.goals.growthGoal}
              onChange={(event) => updateNested("goals", { growthGoal: event.target.value })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Engagement purpose"
              value={baseline.goals.engagementPurpose}
              onChange={(event) => updateNested("goals", { engagementPurpose: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Desired deliverable"
              value={baseline.goals.desiredDeliverable}
              onChange={(event) => updateNested("goals", { desiredDeliverable: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Timeline"
              value={baseline.goals.timeline}
              onChange={(event) => updateNested("goals", { timeline: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Audience for final output"
              value={baseline.goals.finalAudience}
              onChange={(event) => updateNested("goals", { finalAudience: event.target.value })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Success definition"
              value={baseline.goals.successDefinition}
              onChange={(event) => updateNested("goals", { successDefinition: event.target.value })}
            />
          </div>
        )}

        {activeStep.key === "competitors" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Known competitors (comma-separated)"
              value={listToCsv(baseline.competitors.knownCompetitors)}
              onChange={(event) => updateNested("competitors", { knownCompetitors: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Market concerns (comma-separated)"
              value={listToCsv(baseline.competitors.marketConcerns)}
              onChange={(event) => updateNested("competitors", { marketConcerns: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Advantages (comma-separated)"
              value={listToCsv(baseline.competitors.advantages)}
              onChange={(event) => updateNested("competitors", { advantages: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Weaknesses (comma-separated)"
              value={listToCsv(baseline.competitors.weaknesses)}
              onChange={(event) => updateNested("competitors", { weaknesses: csvToList(event.target.value) })}
            />
          </div>
        )}

        {activeStep.key === "brand" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Brand tone"
              value={baseline.brandVoice.tone}
              onChange={(event) => updateNested("brandVoice", { tone: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Existing positioning"
              value={baseline.brandVoice.positioning}
              onChange={(event) => updateNested("brandVoice", { positioning: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Preferred writing style"
              value={baseline.brandVoice.writingStyle}
              onChange={(event) => updateNested("brandVoice", { writingStyle: event.target.value })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Words to use (comma-separated)"
              value={listToCsv(baseline.brandVoice.wordsToUse)}
              onChange={(event) => updateNested("brandVoice", { wordsToUse: csvToList(event.target.value) })}
            />
            <textarea
              className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Words to avoid (comma-separated)"
              value={listToCsv(baseline.brandVoice.wordsToAvoid)}
              onChange={(event) => updateNested("brandVoice", { wordsToAvoid: csvToList(event.target.value) })}
            />
          </div>
        )}

        {activeStep.key === "operations" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Services/products (comma-separated)"
              value={listToCsv(baseline.operations.servicesOrProducts)}
              onChange={(event) => updateNested("operations", { servicesOrProducts: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Revenue drivers (comma-separated)"
              value={listToCsv(baseline.operations.revenueDrivers)}
              onChange={(event) => updateNested("operations", { revenueDrivers: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Major costs (comma-separated)"
              value={listToCsv(baseline.operations.majorCosts)}
              onChange={(event) => updateNested("operations", { majorCosts: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Current bottlenecks (comma-separated)"
              value={listToCsv(baseline.operations.currentBottlenecks)}
              onChange={(event) => updateNested("operations", { currentBottlenecks: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Constraints (comma-separated)"
              value={listToCsv(baseline.operations.constraints)}
              onChange={(event) => updateNested("operations", { constraints: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Known constraints (comma-separated)"
              value={listToCsv(baseline.knownConstraints)}
              onChange={(event) => update({ knownConstraints: csvToList(event.target.value) })}
            />
          </div>
        )}

        {activeStep.key === "documents" && (
          <div className="mt-3 grid gap-3">
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={3}
              placeholder="Available documents (comma-separated)"
              value={listToCsv(baseline.availableDocuments)}
              onChange={(event) => update({ availableDocuments: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={3}
              placeholder="Missing documents (comma-separated)"
              value={listToCsv(baseline.missingDocuments)}
              onChange={(event) => update({ missingDocuments: csvToList(event.target.value) })}
            />
            <textarea
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Recommended engagement types (comma-separated)"
              value={listToCsv(baseline.recommendedEngagementTypes)}
              onChange={(event) => update({ recommendedEngagementTypes: csvToList(event.target.value) })}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
            onClick={() => setActiveStepIndex((previous) => Math.max(0, previous - 1))}
            disabled={activeStepIndex === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
            onClick={() => setActiveStepIndex((previous) => Math.min(STEPS.length - 1, previous + 1))}
            disabled={activeStepIndex === STEPS.length - 1}
          >
            Next
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200 disabled:opacity-50"
            onClick={() => void persist("draft")}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
            onClick={() => void persist("complete")}
            disabled={isSaving}
          >
            Mark Baseline Complete
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div className="mt-3 space-y-2">
          {error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p>}
          {notice && <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
        </div>
      )}
    </section>
  );
}
