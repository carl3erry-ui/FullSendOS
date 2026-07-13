"use client";

type IntakeClassification = "complete" | "enrichable" | "needs_user_input" | "blocked";

type IntakeStatusBannerProps = {
  intakeStatus: IntakeClassification;
  enrichmentNote?: string;
  enrichmentTaskId?: string | null;
  companyName?: string;
};

const CONFIG: Record<IntakeClassification, { label: string; color: string; border: string; text: string }> = {
  complete: {
    label: "Ready",
    color: "bg-emerald-950/30",
    border: "border-emerald-700",
    text: "text-emerald-200",
  },
  enrichable: {
    label: "Enriching",
    color: "bg-violet-950/30",
    border: "border-violet-700",
    text: "text-violet-200",
  },
  needs_user_input: {
    label: "Needs input",
    color: "bg-amber-950/30",
    border: "border-amber-700",
    text: "text-amber-200",
  },
  blocked: {
    label: "Blocked",
    color: "bg-rose-950/30",
    border: "border-rose-700",
    text: "text-rose-200",
  },
};

const MESSAGES: Record<IntakeClassification, string> = {
  complete: "FullSendOS has enough information to begin this engagement.",
  enrichable:
    "FullSendOS has enough to begin research, but some fields need enrichment. A research enrichment task has been created.",
  needs_user_input:
    "FullSendOS needs one or two details before this workflow can run accurately.",
  blocked:
    "Not enough information to start. Please provide a company name, website, document, address, or market.",
};

export function IntakeStatusBanner({
  intakeStatus,
  enrichmentNote,
  enrichmentTaskId,
  companyName,
}: IntakeStatusBannerProps) {
  if (intakeStatus === "complete") return null;

  const cfg = CONFIG[intakeStatus];
  const message = MESSAGES[intakeStatus];

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.color} p-3 text-xs`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-semibold ${cfg.text}`}>
          Intake: {cfg.label}
          {companyName ? ` — ${companyName}` : ""}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cfg.border} border ${cfg.color} ${cfg.text}`}>
          {intakeStatus.replace(/_/g, " ")}
        </span>
      </div>
      <p className={`mt-1 ${cfg.text}`}>{message}</p>
      {enrichmentNote && enrichmentNote !== message && (
        <p className="mt-1 text-slate-400">{enrichmentNote}</p>
      )}
      {enrichmentTaskId && (
        <p className="mt-1 text-slate-500">
          Enrichment task: <span className="font-mono text-slate-400">{enrichmentTaskId}</span>
        </p>
      )}
      {intakeStatus === "blocked" && (
        <p className={`mt-1 font-medium ${cfg.text}`}>
          Please update the engagement with a company name, website, or other identifying information.
        </p>
      )}
    </div>
  );
}
