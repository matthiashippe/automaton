/**
 * File Path Protection Policy Rules
 *
 * Prevents writes to protected files, reads of sensitive files,
 * and path traversal attacks. Fixes the parallel file mutation
 * paths (edit_own_file vs write_file) by unifying protection.
 */
import type { PolicyRule } from "../../types.js";
/**
 * Check if a file path matches a sensitive read pattern.
 */
export declare function isSensitiveFile(filePath: string): boolean;
export declare function createPathProtectionRules(): PolicyRule[];
//# sourceMappingURL=path-protection.d.ts.map