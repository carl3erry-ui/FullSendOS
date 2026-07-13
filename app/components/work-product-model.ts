export const WORKFLOW_DEPARTMENTS = [
  "research",
  "competitors",
  "customers",
  "strategy",
  "brand",
  "website",
  "publishing",
] as const;

export type DepartmentName = (typeof WORKFLOW_DEPARTMENTS)[number];

export type DepartmentRunStatus = "running" | "complete" | "failed" | "repaired" | "pending";

export type WorkspaceProjectSummary = {
  id: string;
  companyName: string;
  objective: string;
  status: string;
  updatedAt?: string;
  completedDepartments: number;
  totalDepartments: number;
  lastRunError?: string | null;
};

export type EngagementDetail = {
  id: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  intakeStatus?: "complete" | "enrichable" | "needs_user_input" | "blocked";
  enrichmentNote?: string;
  enrichmentTaskId?: string | null;
  client?: {
    companyName?: string;
    contactName?: string;
    website?: string;
    industry?: string;
    geography?: string[];
  };
  brief?: {
    objective?: string;
    requestedDeliverables?: string[];
  };
  departments: Partial<Record<DepartmentName, Record<string, unknown> | null>>;
  deliverables?: {
    executiveReport?: string;
    onePageSummary?: string;
    deckOutline?: Array<{
      slide?: number;
      title?: string;
      purpose?: string;
      keyPoints?: string[];
      visualSuggestion?: string;
    }>;
  };
  audit?: {
    activeRun?: {
      id: string;
      startedAt: string;
      updatedAt: string;
      model: string;
    } | null;
    runs?: Array<{
      department?: string;
      startedAt?: string;
      completedAt?: string;
      status?: "running" | "complete" | "failed" | "repaired";
      model?: string;
      error?: string;
    }>;
    warnings?: string[];
  };
};

export function hasExecutiveDeliverables(detail: EngagementDetail | null): boolean {
  if (!detail?.deliverables) return false;
  return Boolean(
    detail.deliverables.executiveReport ||
      detail.deliverables.onePageSummary ||
      (detail.deliverables.deckOutline && detail.deliverables.deckOutline.length > 0),
  );
}

export function getDefaultWorkspaceSection(detail: EngagementDetail | null): string {
  if (hasExecutiveDeliverables(detail)) return "executive";

  for (const department of WORKFLOW_DEPARTMENTS) {
    if (detail?.departments?.[department]) {
      return `department:${department}`;
    }
  }

  return "executive";
}

export function getDepartmentRunStatus(detail: EngagementDetail | null, department: DepartmentName): DepartmentRunStatus {
  const runs = detail?.audit?.runs;
  if (Array.isArray(runs)) {
    for (let index = runs.length - 1; index >= 0; index -= 1) {
      const run = runs[index];
      if (run?.department === department && run.status) {
        return run.status;
      }
    }
  }

  if (detail?.departments?.[department]) {
    return "complete";
  }

  if (detail?.status === "running") {
    return "running";
  }

  return "pending";
}

export function getLastPersistedFailure(detail: EngagementDetail | null): string | null {
  const runs = detail?.audit?.runs;
  if (Array.isArray(runs)) {
    for (let index = runs.length - 1; index >= 0; index -= 1) {
      const run = runs[index];
      if (run?.status === "failed" && typeof run.error === "string" && run.error.length > 0) {
        return run.error;
      }
    }
  }

  const warnings = detail?.audit?.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    return warnings[warnings.length - 1] || null;
  }

  return null;
}

export function formatDepartmentName(department: DepartmentName): string {
  const labels: Record<DepartmentName, string> = {
    research: "Research",
    competitors: "Competitors",
    customers: "Customers",
    strategy: "Strategy",
    brand: "Brand",
    website: "Website",
    publishing: "Executive Review",
  };

  return labels[department];
}
