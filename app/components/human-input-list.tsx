"use client";

import { useState } from "react";
import type { HumanInputRequest } from "@/schemas/human-input";

type HumanInputRequestListProps = {
  requests: HumanInputRequest[];
  emptyMessage: string;
  onAnswer: (id: string, response: string) => Promise<void>;
  onConfirm: (id: string, response: string) => Promise<void>;
  onReject: (id: string, response: string) => Promise<void>;
  onSkip: (id: string, response: string) => Promise<void>;
};

function RequestCard({
  request,
  onAnswer,
  onConfirm,
  onReject,
  onSkip,
}: {
  request: HumanInputRequest;
  onAnswer: (id: string, response: string) => Promise<void>;
  onConfirm: (id: string, response: string) => Promise<void>;
  onReject: (id: string, response: string) => Promise<void>;
  onSkip: (id: string, response: string) => Promise<void>;
}) {
  const [response, setResponse] = useState(request.response || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (action: (id: string, responseText: string) => Promise<void>) => {
    setIsSubmitting(true);
    try {
      await action(request.id, response.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{request.type.replace(/_/g, " ")}</p>
          <h4 className="mt-1 text-base font-medium text-slate-100">{request.title}</h4>
          <p className="mt-2 text-sm text-slate-300">{request.prompt}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-300">
          <span className="rounded-full border border-slate-700 px-2 py-1">{request.status}</span>
          <span className="rounded-full border border-slate-700 px-2 py-1">{request.priority}</span>
          {request.requiredToContinue && (
            <span className="rounded-full border border-amber-700 px-2 py-1 text-amber-200">blocking</span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2 text-xs text-slate-400">
        {request.relatedField && <p>Related field: {request.relatedField}</p>}
        {typeof request.confidence === "number" && <p>Confidence: {Math.round(request.confidence * 100)}%</p>}
        {request.inferredValue !== undefined && request.inferredValue !== null && (
          <p>Inferred value: {typeof request.inferredValue === "string" ? request.inferredValue : JSON.stringify(request.inferredValue)}</p>
        )}
        {request.evidence.length > 0 && <p>Evidence items: {request.evidence.length}</p>}
        {request.sourceReferences.length > 0 && <p>Source references: {request.sourceReferences.length}</p>}
      </div>

      {request.options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {request.options.map((option) => (
            <span key={option.value} className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
              {option.label}
            </span>
          ))}
        </div>
      )}

      <textarea
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        rows={3}
        placeholder="Add a response or confirmation note"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit(onAnswer)}
          disabled={isSubmitting}
          className="rounded-lg border border-cyan-700 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-300 disabled:opacity-60"
        >
          Answer
        </button>
        <button
          type="button"
          onClick={() => submit(onConfirm)}
          disabled={isSubmitting}
          className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300 disabled:opacity-60"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => submit(onReject)}
          disabled={isSubmitting}
          className="rounded-lg border border-rose-700 bg-rose-950/30 px-3 py-2 text-sm text-rose-300 disabled:opacity-60"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => submit(onSkip)}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 disabled:opacity-60"
        >
          Skip
        </button>
      </div>
    </article>
  );
}

export function HumanInputRequestList({
  requests,
  emptyMessage,
  onAnswer,
  onConfirm,
  onReject,
  onSkip,
}: HumanInputRequestListProps) {
  if (requests.length === 0) {
    return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          onAnswer={onAnswer}
          onConfirm={onConfirm}
          onReject={onReject}
          onSkip={onSkip}
        />
      ))}
    </div>
  );
}
