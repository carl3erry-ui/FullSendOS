/**
 * Agent permission vocabulary.
 *
 * These constants represent all possible actions an agent may request.
 * High-risk permissions require an ApprovalGate before execution.
 * In this first slice, agents may only hold read and draft permissions.
 */

export const AgentPermissions = {
  // Legacy compatibility permissions
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

  // Slice 11 workforce permissions
  READ_ENGAGEMENT_CONTEXT: "read_engagement_context",
  READ_CLIENT_PROFILE: "read_client_profile",
  READ_DATA_ROOM_METADATA: "read_data_room_metadata",
  REQUEST_DATA_ROOM_FILE_ACCESS_LATER: "request_data_room_file_access_later",
  CREATE_RESEARCH_SUMMARY: "create_research_summary",
  CREATE_FINANCIAL_ANALYSIS: "create_financial_analysis",
  CREATE_MARKET_ANALYSIS: "create_market_analysis",
  CREATE_STRATEGY_RECOMMENDATION: "create_strategy_recommendation",
  CREATE_BRAND_RECOMMENDATION: "create_brand_recommendation",
  CREATE_OPERATIONS_RECOMMENDATION: "create_operations_recommendation",
  CREATE_INVESTOR_MATERIALS: "create_investor_materials",
  CREATE_WEBSITE_RECOMMENDATION: "create_website_recommendation",
  CREATE_SALES_RECOMMENDATION: "create_sales_recommendation",
  CREATE_LEGAL_RISK_REVIEW: "create_legal_risk_review",
  CREATE_QUALITY_CONTROL_REVIEW: "create_quality_control_review",
  CREATE_EXECUTIVE_SUMMARY: "create_executive_summary",
  RECOMMEND_EXPORT: "recommend_export",
  REQUEST_HUMAN_APPROVAL: "request_human_approval",

  // Explicitly disallowed for this slice
  PUBLISH_EXTERNAL: "publish_external",
  MODIFY_ACCOUNTING_SYSTEMS: "modify_accounting_systems",
  MODIFY_CLIENT_DATA_ROOM_FILES: "modify_client_data_room_files",
  DELETE_CLIENT_FILES: "delete_client_files",
  ACCESS_RAW_FILE_CONTENTS: "access_raw_file_contents",
  ACCESS_SECRETS: "access_secrets",
  BYPASS_APPROVAL: "bypass_approval",
  EXECUTE_EXTERNAL_ACTIONS: "execute_external_actions",
} as const;

export type AgentPermission = (typeof AgentPermissions)[keyof typeof AgentPermissions];

/**
 * Permissions that require an ApprovalGate before an agent may execute them.
 * Agents may hold these permissions in their definition but must not act on
 * them without a completed approval review.
 */
export const HIGH_RISK_PERMISSIONS = new Set<AgentPermission>([
  AgentPermissions.SEND_EMAIL,
  AgentPermissions.PUBLISH_EXTERNAL,
  AgentPermissions.PUBLISH_CONTENT,
  AgentPermissions.SPEND_MONEY,
  AgentPermissions.MODIFY_ACCOUNTING_SYSTEMS,
  AgentPermissions.MODIFY_PRODUCTION,
  AgentPermissions.MODIFY_CLIENT_DATA_ROOM_FILES,
  AgentPermissions.DELETE_CLIENT_FILES,
  AgentPermissions.ACCESS_RAW_FILE_CONTENTS,
  AgentPermissions.ACCESS_SECRETS,
  AgentPermissions.BYPASS_APPROVAL,
  AgentPermissions.EXECUTE_EXTERNAL_ACTIONS,
  AgentPermissions.DELETE_RECORD,
]);

/**
 * Permissions that must never be granted in Slice 11.
 */
export const DANGEROUS_PERMISSIONS = new Set<AgentPermission>([
  AgentPermissions.SEND_EMAIL,
  AgentPermissions.PUBLISH_EXTERNAL,
  AgentPermissions.PUBLISH_CONTENT,
  AgentPermissions.SPEND_MONEY,
  AgentPermissions.MODIFY_ACCOUNTING_SYSTEMS,
  AgentPermissions.MODIFY_PRODUCTION,
  AgentPermissions.MODIFY_CLIENT_DATA_ROOM_FILES,
  AgentPermissions.DELETE_CLIENT_FILES,
  AgentPermissions.ACCESS_RAW_FILE_CONTENTS,
  AgentPermissions.ACCESS_SECRETS,
  AgentPermissions.BYPASS_APPROVAL,
  AgentPermissions.EXECUTE_EXTERNAL_ACTIONS,
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
  AgentPermissions.READ_ENGAGEMENT_CONTEXT,
  AgentPermissions.READ_CLIENT_PROFILE,
  AgentPermissions.READ_DATA_ROOM_METADATA,
  AgentPermissions.REQUEST_DATA_ROOM_FILE_ACCESS_LATER,
  AgentPermissions.CREATE_RESEARCH_SUMMARY,
  AgentPermissions.CREATE_FINANCIAL_ANALYSIS,
  AgentPermissions.CREATE_MARKET_ANALYSIS,
  AgentPermissions.CREATE_STRATEGY_RECOMMENDATION,
  AgentPermissions.CREATE_BRAND_RECOMMENDATION,
  AgentPermissions.CREATE_OPERATIONS_RECOMMENDATION,
  AgentPermissions.CREATE_INVESTOR_MATERIALS,
  AgentPermissions.CREATE_WEBSITE_RECOMMENDATION,
  AgentPermissions.CREATE_SALES_RECOMMENDATION,
  AgentPermissions.CREATE_LEGAL_RISK_REVIEW,
  AgentPermissions.CREATE_QUALITY_CONTROL_REVIEW,
  AgentPermissions.CREATE_EXECUTIVE_SUMMARY,
  AgentPermissions.RECOMMEND_EXPORT,
  AgentPermissions.REQUEST_HUMAN_APPROVAL,
]);
