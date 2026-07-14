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

type EngagementHumanInputPanelProps = {
  engagementId: string;
};

export function EngagementHumanInputPanel({ engagementId }: EngagementHumanInputPanelProps) {
  const [requests, setRequests] = useState<HumanInputRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setRequests(await fetchHumanInputRequests({ engagementId, openOnly: true }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load engagement human input requests.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [engagementId]);

  const refresh = async () => {
    await loadRequests();
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Engagement human input</p>
        <h4 className="mt-2 text-lg font-semibold text-slate-100">Open questions and confirmations</h4>
        <p className="mt-1 text-sm text-slate-400">Missing facts, inferred values, and approval prompts for this engagement.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-700 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>}

      {isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">Loading engagement requests...</div>
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
