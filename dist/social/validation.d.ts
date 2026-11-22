/**
 * Message Validation
 *
 * Validates social messages for size limits, replay protection,
 * and address format.
 *
 * Phase 3.2: Social & Registry Hardening
 */
import type { MessageValidationResult } from "../types.js";
export { isValidAddress } from "../identity/chain.js";
/**
 * Validate a social message for size, timestamp, and address constraints.
 */
export declare function validateMessage(message: {
    from: string;
    to: string;
    content: string;
    signed_at?: string;
    timestamp?: string;
}): MessageValidationResult;
/**
 * Validate that a relay URL uses HTTPS.
 * Throws if the URL is not HTTPS.
 */
export declare function validateRelayUrl(url: string): void;
//# sourceMappingURL=validation.d.ts.map