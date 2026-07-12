import { ZodError } from "zod";
import type { AIProvider } from "../ai/provider";
import type { DepartmentExecutionConfig, DepartmentExecutionErrorKind } from "../contracts/department-executor";
import type { DepartmentContext, DepartmentDefinition } from "../departments/department";
import { departmentRegistry } from "../departments/registry";
import type { Project, WorkflowStageId } from "../types/project";

export class DepartmentExecutionError extends Error {
  kind: DepartmentExecutionErrorKind;
  departmentId?: WorkflowStageId;
  details?: unknown;

  constructor(options: {
    kind: DepartmentExecutionErrorKind;
    message: string;
    departmentId?: WorkflowStageId;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "DepartmentExecutionError";
    this.kind = options.kind;
    this.departmentId = options.departmentId;
    this.details = options.details;
  }
}

export type DepartmentExecutor = {
  executeDepartment: (project: Project, departmentId: WorkflowStageId) => Promise<Project>;
  validateDepartmentDependencies: (project: Project, department: DepartmentDefinition<unknown>) => void;
  buildDepartmentContext: (project: Project, departmentId: WorkflowStageId) => DepartmentContext;
  storeDepartmentResult: (project: Project, departmentId: WorkflowStageId, result: unknown) => Project;
};

function now() {
  return new Date().toISOString();
}

function normalizeExecutionError(
  error: unknown,
  departmentId: WorkflowStageId,
): DepartmentExecutionError {
  if (error instanceof DepartmentExecutionError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new DepartmentExecutionError({
      kind: "schema_validation_failure",
      message: "Department output failed schema validation.",
      departmentId,
      details: error.issues,
    });
  }

  const err = error as { message?: string; kind?: string; details?: unknown };

  if (err?.kind === "validation") {
    return new DepartmentExecutionError({
      kind: "malformed_structured_response",
      message: err.message || "Malformed structured AI response.",
      departmentId,
      details: err.details,
    });
  }

  return new DepartmentExecutionError({
    kind: "provider_failure",
    message: err?.message || "Department execution failed due to provider error.",
    departmentId,
    details: err?.details,
  });
}

export function createDepartmentExecutor(config: {
  provider: AIProvider;
  defaults?: DepartmentExecutionConfig;
}): DepartmentExecutor {
  const { provider } = config;

  function getDepartment(departmentId: WorkflowStageId): DepartmentDefinition<unknown> {
    const department = departmentRegistry[departmentId];
    if (!department) {
      throw new DepartmentExecutionError({
        kind: "unknown_department",
        message: `Unknown department: ${departmentId}`,
        departmentId,
      });
    }
    return department;
  }

  function validateDepartmentDependencies(project: Project, department: DepartmentDefinition<unknown>) {
    const missing = department.dependencies.filter((dependencyId) => {
      const stage = project.workflow.stages.find((item) => item.id === dependencyId);
      return !stage || stage.status !== "completed";
    });

    if (missing.length > 0) {
      throw new DepartmentExecutionError({
        kind: "dependency_incomplete",
        message: `Department ${department.id} requires completed dependencies: ${missing.join(", ")}.`,
        departmentId: department.id,
        details: { missingDependencies: missing },
      });
    }
  }

  function buildDepartmentContext(project: Project, departmentId: WorkflowStageId): DepartmentContext {
    const department = getDepartment(departmentId);
    const dependencyResults = department.dependencies.reduce<Partial<Record<WorkflowStageId, unknown>>>(
      (acc, dependencyId) => {
        acc[dependencyId] = project.workflow.stageResults[dependencyId];
        return acc;
      },
      {},
    );

    return {
      project,
      departmentId,
      dependencyResults,
    };
  }

  function storeDepartmentResult(project: Project, departmentId: WorkflowStageId, result: unknown): Project {
    return {
      ...project,
      updatedAt: now(),
      workflow: {
        ...project.workflow,
        stageResults: {
          ...project.workflow.stageResults,
          [departmentId]: result,
        },
      },
      departments: {
        ...project.departments,
        [departmentId]: {
          ...project.departments[departmentId],
          status: "completed",
          outputs:
            result && typeof result === "object"
              ? (result as Record<string, unknown>)
              : { value: result },
          completedAt: now(),
          unknowns: project.departments[departmentId].unknowns || [],
          warnings: project.departments[departmentId].warnings || [],
        },
      },
    };
  }

  async function executeDepartment(project: Project, departmentId: WorkflowStageId): Promise<Project> {
    const department = getDepartment(departmentId);
    validateDepartmentDependencies(project, department);

    const context = buildDepartmentContext(project, departmentId);

    try {
      const result = await department.execute({
        ...context,
        provider,
      });

      const validated = department.outputSchema.parse(result);
      return storeDepartmentResult(project, departmentId, validated);
    } catch (error) {
      throw normalizeExecutionError(error, departmentId);
    }
  }

  return {
    executeDepartment,
    validateDepartmentDependencies,
    buildDepartmentContext,
    storeDepartmentResult,
  };
}
