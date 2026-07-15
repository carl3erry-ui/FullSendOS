type DashboardSummaryProps = {
  activeClients: number;
  readyForReview: number;
  actionRequired: number;
  recentWorkProducts: number;
  engagementsInProgress?: number;
};

export function DashboardSummary({
  activeClients,
  readyForReview,
  actionRequired,
  recentWorkProducts,
  engagementsInProgress = 0,
}: DashboardSummaryProps) {
  const metrics = [
    {
      label: "Client Command Centers",
      value: activeClients,
      color: "text-slate-100",
      accent: "border-slate-700",
      hint: activeClients === 0 ? "No active clients yet" : `${activeClients} active`,
    },
    {
      label: "Engagements Running",
      value: engagementsInProgress,
      color: "text-cyan-300",
      accent: "border-cyan-900",
      hint: engagementsInProgress === 0 ? "No workflows active" : `${engagementsInProgress} in progress`,
    },
    {
      label: "Ready for Review",
      value: readyForReview,
      color: "text-emerald-300",
      accent: "border-emerald-900",
      hint: readyForReview === 0 ? "No deliverables ready" : `${readyForReview} awaiting review`,
    },
    {
      label: "Action Required",
      value: actionRequired,
      color: "text-amber-300",
      accent: "border-amber-900",
      hint: actionRequired === 0 ? "No blockers" : `${actionRequired} need attention`,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={`rounded-xl border ${m.accent} bg-slate-900/60 px-4 py-4 transition hover:bg-slate-900/80`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">{m.label}</p>
          <p className={`mt-2 text-3xl font-bold ${m.color}`}>{m.value}</p>
          <p className="mt-1 text-xs text-slate-500">{m.hint}</p>
        </div>
      ))}
    </section>
  );
}
