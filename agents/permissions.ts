/**
 * Agent permission vocabulary.
 *
 * These constants represent all possible actions an agent may request.
 * High-risk permissions require an ApprovalGate before execution.
 * In this first slice, agents may only hold read and draft permissions.
 */

export const AgentPermissions = {
  READ_PROJECT: "read_project",
  READ_ENGAGEMENT: "read_engagement",
  READ_DOCUMENTS: "read_documents",
  SEARCH_INTERNAL_KNOWLEDGE: "search_internal_knowledge",
  SEARCH_WEB: "search_web",
  CREATE_TASK: "create_task",
  UPDATE_TASK: "update_task",
  DRAFT_EMAIL: "draft_email",
  // High-risk — require approval gate before execution
  SEND_EMAIL: "send_email",
  PUBLISH_CONTENT: "publish_content",
  SPEND_MONEY: "spend_money",
  MODIFY_PRODUCTION: "modify_production",
  DELETE_RECORD: "delete_record",
} as const;

export type AgentPermission = (typeof AgentPermissions)[keyof typeof AgentPermissions];

/**
 * Permissions that require an ApprovalGate before an agent may execute them.
 * Agents may hold these permissions in their definition but must not act on
 * them without a completed approval review.
 */
export const HIGH_RISK_PERMISSIONS = new Set<AgentPermission>([
  AgentPermissions.SEND_EMAIL,
  AgentPermissions.PUBLISH_CONTENT,
  AgentPermissions.SPEND_MONEY,
  AgentPermissions.MODIFY_PRODUCTION,
  AgentPermissions.DELETE_RECORD,
]);

/**
 * Permissions granted to agents in the first foundation slice.
 * High-risk actions are excluded from this set.
 */
export const FIRST_SLICE_ALLOWED_PERMISSIONS = new Set<AgentPermission>([
  AgentPermissions.READ_PROJECT,
  AgentPermissions.READ_ENGAGEMENT,
  AgentPermissions.READ_DOCUMENTS,
  AgentPermissions.SEARCH_INTERNAL_KNOWLEDGE,
  AgentPermissions.CREATE_TASK,
  AgentPermissions.UPDATE_TASK,
  AgentPermissions.DRAFT_EMAIL,
]);
