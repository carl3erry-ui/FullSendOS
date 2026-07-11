type DashboardSummaryProps = {
  projectCount: number;
  runningCount: number;
  reviewCount: number;
  avgProgress: number;
};

export function DashboardSummary({ projectCount, runningCount, reviewCount, avgProgress }: DashboardSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Projects</p>
        <p className="mt-2 text-3xl font-semibold">{projectCount}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Running</p>
        <p className="mt-2 text-3xl font-semibold text-amber-300">{runningCount}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Needs Review</p>
        <p className="mt-2 text-3xl font-semibold text-orange-300">{reviewCount}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Avg Progress</p>
        <p className="mt-2 text-3xl font-semibold text-cyan-300">{avgProgress}%</p>
      </div>
    </section>
  );
}
