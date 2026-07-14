"use client";

import { useEffect, useMemo, useState } from "react";
import WorkProductViewer from "./work-product-viewer";
import {
  getDefaultWorkspaceSection,
  type EngagementDetail,
  type WorkspaceProjectSummary,
} from "./work-product-model";

type ProjectWorkspaceProps = {
  project: WorkspaceProjectSummary | null;
  runningProjectId: string | null;
  onRun: (projectId: string) => void;
};

export function ProjectWorkspace({ project, runningProjectId, onRun }: ProjectWorkspaceProps) {
  const [detail, setDetail] = useState<EngagementDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("executive");

  const detailFetchKey = useMemo(() => {
    if (!project) return "none";
    return `${project.id}:${project.updatedAt || ""}:${project.status}`;
  }, [project]);

  useEffect(() => {
    if (!project) {
      setDetail(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/engagements/${project.id}`, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load engagement detail.");
        }

        if (cancelled) return;
        setDetail(data as EngagementDetail);
        setActiveSection((current) => (current === "executive" ? getDefaultWorkspaceSection(data as EngagementDetail) : current));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load engagement detail.";
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detailFetchKey, project]);

  if (!project) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold">Engagement workspace</h2>
        <p className="mt-4 text-sm text-slate-400">Select an engagement from the list below to view workspace details.</p>
      </section>
    );
  }

  return (
    <WorkProductViewer
      project={project}
      detail={detail}
      isLoading={isLoading}
      loadError={loadError}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      runningProjectId={runningProjectId}
      onRun={onRun}
    />
  );
}