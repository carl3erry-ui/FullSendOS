"use client";

import { useEffect, useState } from "react";

type TourStep = {
  id: string;
  title: string;
  body: string;
  cta?: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to FullSendOS",
    body: "FullSendOS is an AI consulting operating system. It helps you manage clients, run structured AI Workforce engagements, and produce executive-ready deliverables — research, strategy, brand, and a final report.",
    cta: "Next",
  },
  {
    id: "clients",
    title: "Client Command Centers",
    body: "Each client has a Command Center that houses their company baseline, Data Room, engagements, and AI recommendations. Start by onboarding a client and building their baseline — this gives the AI Workforce the context it needs.",
    cta: "Next",
  },
  {
    id: "data-room",
    title: "The Data Room",
    body: "The Data Room is the source of truth for the AI Workforce. Upload business plans, financials, pitch decks, brand guides, market research, and SOPs. The AI reads these documents to produce better deliverables.",
    cta: "Next",
  },
  {
    id: "engagements",
    title: "Engagements",
    body: "Each engagement is a structured consulting project. Define the objective and desired deliverable — for example, 'California market entry strategy for board presentation' — then deploy the AI Workforce.",
    cta: "Next",
  },
  {
    id: "workforce",
    title: "Deploying the AI Workforce",
    body: "The AI Workforce runs seven sequential departments: Research, Competitors, Customers, Strategy, Brand, Website, and Publishing. Each department produces structured output. The Publishing department synthesizes everything into a final executive report.",
    cta: "Next",
  },
  {
    id: "deliverables",
    title: "Reviewing Deliverables",
    body: "When the AI Workforce completes, the engagement enters 'Needs Review' status. Review the Executive Brief, Supporting Analysis, Department Work Product, and Evidence sections. Export the final report as Markdown, HTML, PDF, or JSON.",
    cta: "Next",
  },
  {
    id: "demo",
    title: "Explore the Demo Workspace",
    body: "We've set up a sample engagement for 'Apex Brewing Co.' — a fictional Pacific Northwest craft brewery pursuing a California market entry strategy. Explore it to see a completed AI Workforce run with a full executive work product ready for export.",
    cta: "Finish Tour",
  },
];

type GuidedTourProps = {
  onClose: () => void;
  onViewDemo?: () => void;
};

export function GuidedTour({ onClose, onViewDemo }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const progress = Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
      if (event.key === "ArrowRight" && !isLast) setStepIndex((i) => i + 1);
      if (event.key === "ArrowLeft" && stepIndex > 0) setStepIndex((i) => i - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepIndex, isLast]);

  function handleClose() {
    setIsExiting(true);
    setTimeout(onClose, 200);
  }

  function handleNext() {
    if (isLast) {
      handleClose();
      onViewDemo?.();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm transition-opacity ${isExiting ? "opacity-0" : "opacity-100"}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Guided tour"
    >
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl shadow-slate-950/60">
        {/* Close */}
        <button
          type="button"
          className="absolute right-4 top-4 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
          onClick={handleClose}
          aria-label="Close tour"
        >
          ✕
        </button>

        {/* Step counter */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Guided Tour — Step {stepIndex + 1} of {TOUR_STEPS.length}
        </p>

        {/* Progress bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded bg-slate-800">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <h2 className="mt-5 text-xl font-semibold text-slate-50">{step.title}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">{step.body}</p>

        {/* Step dots */}
        <div className="mt-6 flex items-center gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => setStepIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIndex ? "w-6 bg-cyan-500" : "w-1.5 bg-slate-700 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={handleClose}
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
                onClick={() => setStepIndex((i) => i - 1)}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              onClick={handleNext}
            >
              {step.cta || "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
