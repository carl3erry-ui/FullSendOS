export const WORKFLOW_POLL_INTERVAL_MS = 5000;
export const WORKFLOW_POST_TIMEOUT_MS = 30000;

type ProjectSummary = {
  id: string;
  status: string;
  lastRunError?: string | null;
};

export function hasRunningProjects(projects: ProjectSummary[]): boolean {
  return projects.some((project) => project.status === "running");
}

export function resolveRunTimeoutMessage(project: ProjectSummary | null): string | null {
  if (!project) {
    return "Workflow request timed out and project state could not be recovered.";
  }

  if (project.status === "running") {
    return null;
  }

  if (project.status === "failed") {
    return project.lastRunError || "Workflow failed.";
  }

  return null;
}

export function shouldStopPolling(projects: ProjectSummary[]): boolean {
  return !hasRunningProjects(projects);
}

export type PollController = {
  tick: () => Promise<boolean>;
  stop: () => void;
  isStopped: () => boolean;
};

export function createPollController(refresh: () => Promise<void>): PollController {
  let stopped = false;
  let inFlight = false;

  return {
    async tick() {
      if (stopped || inFlight) return false;

      inFlight = true;
      try {
        await refresh();
        return true;
      } finally {
        inFlight = false;
      }
    },
    stop() {
      stopped = true;
    },
    isStopped() {
      return stopped;
    },
  };
}
