export type ProjectStatus =
  | "draft"
  | "in-progress"
  | "needs-review"
  | "completed"
  | "failed";

export type WorkflowStage =
  | "draft"
  | "research"
  | "strategy"
  | "creative"
  | "publishing"
  | "completed"
  | "failed";

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";

export type WorkflowStep = {
  stage: WorkflowStage;
  status: WorkflowStepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type WorkflowState = {
  currentStage: WorkflowStage;
  steps: WorkflowStep[];
  lastRunAt?: string;
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
  status: WorkflowStepStatus;
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
    research: DepartmentResult;
    strategy: DepartmentResult;
    creative: DepartmentResult;
    publishing: DepartmentResult;
  };
};
