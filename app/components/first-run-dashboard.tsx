"use client";

import { useState } from "react";

type FirstRunDashboardProps = {
  onCreateClient: () => void;
  onCreateEngagement: () => void;
  onTakeTour?: () => void;
  onViewDemo?: () => void;
};

const SETUP_STEPS = [
  {
    step: "01",
    title: "Onboard Client",
    description:
      "Capture company basics, goals, market context, customers, brand voice, and constraints. This forms the AI-ready baseline.",
    cta: "Start Client Onboarding",
    color: "cyan",
  },
  {
    step: "02",
    title: "Build Data Room",
    description:
      "Upload business plans, financials, pitch decks, brand guides, SOPs, and other source materials. The AI Workforce reads them.",
    cta: "Upload Documents",
    color: "indigo",
  },
  {
    step: "03",
    title: "Create Engagement",
    description:
      "Define the business question, desired deliverable, and audience. Each engagement produces a full executive work product.",
    cta: "Create Engagement",
    color: "violet",
  },
  {
    step: "04",
    title: "Deploy AI Workforce",
    description:
      "The AI Workforce runs research, competitor analysis, customer insight, strategy, brand, and publishing departments in sequence.",
    cta: "Deploy AI Workforce",
    color: "emerald",
  },
] as const;

const colorMap: Record<string, { border: string; bg: string; text: string; label: string; btn: string }> = {
  cyan:    { border: "border-cyan-800",   bg: "bg-cyan-950/20",   text: "text-cyan-200",   label: "text-cyan-400",   btn: "border-cyan-700 text-cyan-200 hover:border-cyan-500" },
  indigo:  { border: "border-indigo-800", bg: "bg-indigo-950/20", text: "text-indigo-200", label: "text-indigo-400", btn: "border-indigo-700 text-indigo-200 hover:border-indigo-500" },
  violet:  { border: "border-violet-800", bg: "bg-violet-950/20", text: "text-violet-200", label: "text-violet-400", btn: "border-violet-700 text-violet-200 hover:border-violet-500" },
  emerald: { border: "border-emerald-800",bg: "bg-emerald-950/20",text: "text-emerald-200",label: "text-emerald-400",btn: "border-emerald-700 text-emerald-200 hover:border-emerald-500" },
};

export function FirstRunDashboard({ onCreateClient, onCreateEngagement, onTakeTour, onViewDemo }: FirstRunDashboardProps) {
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function handleViewDemo() {
    setIsSeedingDemo(true);
    setDemoError(null);
    try {
      const response = await fetch("/api/demo/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Demo seed failed");
      onViewDemo?.();
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Unable to load demo workspace.");
      setIsSeedingDemo(false);
    }
  }

  return (
    <section className="space-y-10">
      {/* Hero */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-10">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-cyan-400">FullSendOS Executive OS</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-slate-50 md:text-4xl">
          Build your first AI-powered consulting engagement.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Onboard a client, create a company baseline, organize the Data Room, and deploy the AI Workforce to produce
          executive-ready deliverables — research, strategy, brand, and an executive report.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={onCreateClient}
            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-400 active:scale-[0.98]"
          >
            Start Client Onboarding
          </button>
          <button
            onClick={() => void handleViewDemo()}
            disabled={isSeedingDemo}
            className="rounded-xl border border-indigo-600 bg-indigo-950/30 px-5 py-3 text-sm font-medium text-indigo-200 transition hover:border-indigo-400 hover:bg-indigo-950/50 disabled:opacity-60"
          >
            {isSeedingDemo ? "Loading demo…" : "View Demo Workspace"}
          </button>
          {onTakeTour && (
            <button
              onClick={onTakeTour}
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:text-slate-50"
            >
              Take Guided Tour
            </button>
          )}
        </div>

        {demoError && (
          <p className="mt-3 text-sm text-rose-300">{demoError}</p>
        )}

        {/* Capability pills */}
        <div className="mt-8 flex flex-wrap gap-2">
          {["Research", "Market Analysis", "Competitive Intelligence", "Strategy", "Brand", "Executive Reports", "PDF Exports"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Four-step setup path */}
      <div>
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-slate-500">How It Works</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SETUP_STEPS.map((item) => {
            const c = colorMap[item.color];
            return (
              <div
                key={item.step}
                className={`flex flex-col justify-between rounded-2xl border ${c.border} ${c.bg} p-5 transition hover:brightness-110`}
              >
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.3em] ${c.label}`}>{item.step}</p>
                  <h3 className={`mt-2 text-base font-semibold ${c.text}`}>{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                </div>
                <button
                  className={`mt-5 self-start rounded-lg border ${c.btn} px-3 py-2 text-xs font-medium transition`}
                  onClick={item.step === "01" ? onCreateClient : item.step === "03" ? onCreateEngagement : undefined}
                  type="button"
                >
                  {item.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* What FullSendOS produces */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">What The AI Workforce Produces</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Research Report", desc: "Market size, trends, and data validation with source citations." },
            { label: "Competitive Map", desc: "Known competitors, advantages, gaps, and differentiation." },
            { label: "Customer Profile", desc: "Segments, motivations, and key buying problems." },
            { label: "Strategy Memo", desc: "Growth path, risks, and key prioritization." },
            { label: "Brand Voice Guide", desc: "Tone, positioning, and messaging guardrails." },
            { label: "Executive Report", desc: "Decision-ready work product with one-page summary and deck outline." },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm font-semibold text-slate-200">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
