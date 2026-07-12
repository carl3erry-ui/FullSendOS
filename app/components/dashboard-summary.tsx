type DashboardSummaryProps = {
  activeClients: number;
  readyForReview: number;
  actionRequired: number;
  recentWorkProducts: number;
};

export function DashboardSummary({
  activeClients,
  readyForReview,
  actionRequired,
  recentWorkProducts,
}: DashboardSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Active Clients</p>
        <p className="mt-2 text-3xl font-semibold">{activeClients}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ready For Review</p>
        <p className="mt-2 text-3xl font-semibold text-emerald-300">{readyForReview}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Action Required</p>
        <p className="mt-2 text-3xl font-semibold text-amber-300">{actionRequired}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent Work Products</p>
        <p className="mt-2 text-3xl font-semibold text-cyan-300">{recentWorkProducts}</p>
      </div>
    </section>
  );
}
