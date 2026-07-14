"use client";

import { useEffect, useState } from "react";
import type { HumanInputRequest } from "@/schemas/human-input";
import {
  answerHumanInputRequest,
  confirmHumanInputRequest,
  fetchHumanInputRequests,
  rejectHumanInputRequest,
  skipHumanInputRequest,
} from "./human-input-client";
import { HumanInputRequestList } from "./human-input-list";

export function HumanInputCenter() {
  const [requests, setRequests] = useState<HumanInputRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setRequests(await fetchHumanInputRequests({ openOnly: true }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load human input requests.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const refresh = async () => {
    await loadRequests();
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">FullSendOS needs your input</p>
        <h2 className="mt-2 text-2xl font-semibold">Human Input Center</h2>
        <p className="mt-2 text-sm text-slate-400">Open requests, confirmations, clarifications, and assumptions that need a human decision.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-700 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>}

      {isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">Loading human input requests...</div>
      ) : (
        <HumanInputRequestList
          requests={requests}
          emptyMessage="No human input is needed right now."
          onAnswer={async (id, response) => {
            await answerHumanInputRequest(id, response, "admin");
            await refresh();
          }}
          onConfirm={async (id, response) => {
            await confirmHumanInputRequest(id, response, "admin");
            await refresh();
          }}
          onReject={async (id, response) => {
            await rejectHumanInputRequest(id, response, "admin");
            await refresh();
          }}
          onSkip={async (id, response) => {
            await skipHumanInputRequest(id, response, "admin");
            await refresh();
          }}
        />
      )}
    </section>
  );
}
