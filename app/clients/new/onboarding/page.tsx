"use client";

import { useEffect, useState } from "react";
import { ClientOnboardingWizard } from "@/app/components/client-onboarding-wizard";
import type { ClientBaseline } from "@/schemas/client-baseline";

type ClientDetail = {
  id: string;
  name: string;
};

export default function ClientOnboardingPage() {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [baseline, setBaseline] = useState<ClientBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");

    if (!clientId) {
      setError("Select or create a client first, then open onboarding from the client workspace.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [clientResponse, baselineResponse] = await Promise.all([
          fetch(`/api/clients/${clientId}`, { cache: "no-store" }),
          fetch(`/api/clients/${clientId}/baseline`, { cache: "no-store" }),
        ]);

        const clientData = await clientResponse.json();
        if (!clientResponse.ok) {
          throw new Error(clientData?.error || "Unable to load client.");
        }

        const baselineData = await baselineResponse.json();
        if (!baselineResponse.ok) {
          throw new Error(baselineData?.error || "Unable to load baseline.");
        }

        setClient({ id: clientData.id, name: clientData.name });
        setBaseline(baselineData as ClientBaseline);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to open onboarding.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">FullSendOS Intake</p>
          <h1 className="mt-2 text-3xl font-semibold">Client Onboarding Baseline Builder</h1>
          <p className="mt-2 text-sm text-slate-300">
            Build company baseline context before running AI engagements.
          </p>
        </header>

        {loading && <p className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">Loading onboarding context...</p>}

        {!loading && error && (
          <div className="rounded-xl border border-rose-800 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && client && baseline && (
          <ClientOnboardingWizard clientId={client.id} clientName={client.name} initialBaseline={baseline} />
        )}
      </div>
    </main>
  );
}
