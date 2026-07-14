import type { FormEvent } from "react";

export type ProjectFormState = {
  companyName: string;
  objective: string;
  contactName: string;
  industry: string;
  website: string;
};

type ProjectFormProps = {
  form: ProjectFormState;
  isCreating: boolean;
  isRunInProgress: boolean;
  isSecondary?: boolean;
  onSubmit: (event: FormEvent) => void;
  onFieldChange: (field: keyof ProjectFormState, value: string) => void;
};

export function ProjectForm({
  form,
  isCreating,
  isRunInProgress,
  isSecondary = false,
  onSubmit,
  onFieldChange,
}: ProjectFormProps) {
  return (
    <div
      className={`rounded-2xl p-6 ${
        isSecondary
          ? "border border-dashed border-slate-700 bg-slate-950/40"
          : "border border-slate-800 bg-slate-900/70"
      }`}
    >
      <h2 className="text-xl font-semibold">Quick engagement</h2>
      <p className="mt-2 text-sm text-slate-400">
        Secondary path for unassigned work. Primary flow remains client selection, engagement setup, and executive brief review.
      </p>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
          placeholder="Company name"
          value={form.companyName}
          onChange={(event) => onFieldChange("companyName", event.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
          placeholder="Objective"
          value={form.objective}
          onChange={(event) => onFieldChange("objective", event.target.value)}
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Contact name"
            value={form.contactName}
            onChange={(event) => onFieldChange("contactName", event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            placeholder="Industry"
            value={form.industry}
            onChange={(event) => onFieldChange("industry", event.target.value)}
          />
        </div>
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
          placeholder="Website"
          value={form.website}
          onChange={(event) => onFieldChange("website", event.target.value)}
        />
        <button
          className="rounded-xl bg-slate-100 px-4 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating || isRunInProgress}
        >
          {isCreating ? "Starting..." : "Start quick engagement"}
        </button>
      </form>
    </div>
  );
}
