/**
 * Handle client — re-exports from the confidential handle SDK.
 *
 * This wrapper hides the underlying package name from source code.
 * All imports should use this module instead of importing directly.
 */

export { createViemHandleClient } from "@iexec-nox/handle";
export type { HandleClient, Handle } from "@iexec-nox/handle";
