export type ProjectStatus =
  | "draft"
  | "in-progress"
  | "needs-review"
  | "completed"
  | "failed";

export type WorkflowStageId = "intelligence" | "strategy" | "creative" | "publishing";

export type WorkflowStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type WorkflowStage = {
  id: WorkflowStageId;
  label: string;
  status: WorkflowStageStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type WorkflowState = {
  initializedAt: string;
  currentStageId?: WorkflowStageId;
  stages: WorkflowStage[];
  stageResults: Partial<Record<WorkflowStageId, unknown>>;
};

export type ProjectSource = {
  id: string;
  title: string;
  url?: string;
  type: "web" | "client-note" | "analysis" | "generated";
  capturedAt: string;
};

export type EvidenceItem = {
  id: string;
  claim: string;
  confidence: "low" | "medium" | "high";
  sourceIds: string[];
  notes?: string;
};

export type EvidenceBundle = {
  sources: ProjectSource[];
  items: EvidenceItem[];
};

export type DepartmentResult = {
  status: WorkflowStageStatus;
  summary?: string;
  outputs: Record<string, unknown>;
  unknowns: string[];
  warnings: string[];
  completedAt?: string;
};

export type DeliverableSet = {
  executiveReport?: string;
  onePageSummary?: string;
  deckOutline?: string[];
  websiteDraft?: string;
  assets: Record<string, string>;
};

export type ProjectClient = {
  companyName: string;
  contactName?: string;
  website?: string;
  industry?: string;
};

export type AuditActiveRun = {
  id: string;
  startedAt: string;
  updatedAt: string;
  model?: string;
};

export type AuditRunEntry = {
  department: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  model?: string;
  error?: string;
  type?: string;
  [key: string]: unknown;
};

export type ProjectAudit = {
  activeRun: AuditActiveRun | null;
  runs: AuditRunEntry[];
  warnings: string[];
  updatedAt?: string;
};

export type ProjectObjective = {
  summary: string;
  constraints: string[];
  requestedDeliverables: string[];
};

export type Project = {
  id: string;
  client: ProjectClient;
  objective: ProjectObjective;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  workflow: WorkflowState;
  deliverables: DeliverableSet;
  evidence: EvidenceBundle;
  departments: {
    intelligence: DepartmentResult;
    strategy: DepartmentResult;
    creative: DepartmentResult;
    publishing: DepartmentResult;
  };
  audit?: ProjectAudit;
};
