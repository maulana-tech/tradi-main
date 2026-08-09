/**
 * @deprecated Use ./executor.ts instead. This file is kept for backwards compatibility.
 * The new executor follows the KeeperHub MCP flow: prepare → simulate → execute → poll → persist.
 */

export { execute as executeViaKeeperHub } from "./executor.js";
export type { ExecuteParams as KeeperHubExecutionParams, AuditRecord as AuditLog, ExecuteResult as ExecutionResult } from "./executor.js";
