/**
 * Social Signing Module
 *
 * THE SINGLE canonical signing implementation for both runtime + CLI.
 * Supports both EVM (ECDSA secp256k1 via viem) and Solana (Ed25519 via tweetnacl).
 *
 * Phase 3.2: Social & Registry Hardening (S-P0-1)
 */
import { type PrivateKeyAccount } from "viem";
import type { SignedMessagePayload } from "../types.js";
import type { ChainIdentity } from "../identity/chain.js";
export declare const MESSAGE_LIMITS: {
    readonly maxContentLength: 64000;
    readonly maxTotalSize: 128000;
    readonly replayWindowMs: 300000;
    readonly maxOutboundPerHour: 100;
};
/**
 * Sign a send message payload.
 *
 * Canonical format: Conway:send:{to_lowercase}:{keccak256(toBytes(content))}:{signed_at_iso}
 *
 * Accepts either a PrivateKeyAccount (EVM backward compat) or a ChainIdentity (both chains).
 */
export declare function signSendPayload(signer: PrivateKeyAccount | ChainIdentity, to: string, content: string, replyTo?: string): Promise<SignedMessagePayload>;
/**
 * Sign a poll payload.
 *
 * Canonical format: Conway:poll:{address_lowercase}:{timestamp_iso}
 *
 * Accepts either a PrivateKeyAccount (EVM backward compat) or a ChainIdentity (both chains).
 */
export declare function signPollPayload(signer: PrivateKeyAccount | ChainIdentity): Promise<{
    address: string;
    signature: string;
    timestamp: string;
}>;
//# sourceMappingURL=signing.d.ts.map