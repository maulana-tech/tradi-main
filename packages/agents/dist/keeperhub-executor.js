/**
 * @deprecated Use ./executor.ts instead. This file is kept for backwards compatibility.
 * The new executor follows the KeeperHub MCP flow: prepare → simulate → execute → poll → persist.
 */
export { execute as executeViaKeeperHub } from "./executor.js";
//# sourceMappingURL=keeperhub-executor.js.map