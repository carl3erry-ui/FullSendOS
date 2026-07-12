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
  onSubmit: (event: FormEvent) => void;
  onFieldChange: (field: keyof ProjectFormState, value: string) => void;
};

export function ProjectForm({ form, isCreating, isRunInProgress, onSubmit, onFieldChange }: ProjectFormProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h2 className="text-xl font-semibold">Start a new engagement</h2>
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
          className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating || isRunInProgress}
        >
          {isCreating ? "Creating..." : "Create engagement"}
        </button>
      </form>
    </div>
  );
}
