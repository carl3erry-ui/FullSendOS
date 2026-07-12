import type { WorkflowStageId } from "../types/project";
import type { DepartmentDefinition } from "./department";
import { creativeDepartment } from "./creative";
import { intelligenceDepartment } from "./intelligence";
import { publishingDepartment } from "./publishing";
import { strategyDepartment } from "./strategy";

export const departmentRegistry: Record<WorkflowStageId, DepartmentDefinition<unknown>> = {
  intelligence: intelligenceDepartment,
  strategy: strategyDepartment,
  creative: creativeDepartment,
  publishing: publishingDepartment,
};
