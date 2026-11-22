/**
 * Sign-In With Solana (SIWS)
 *
 * Builds and signs SIWS messages for Solana automaton provisioning.
 * Ported from aiws control-plane siws.ts.
 */
import type { ChainIdentity } from "./chain.js";
export interface SiwsMessage {
    domain: string;
    address: string;
    statement: string;
    uri: string;
    nonce: string;
    issuedAt: string;
    chainId: string;
}
export declare function buildSiwsMessage(params: SiwsMessage): string;
/**
 * Sign a SIWS message using a ChainIdentity (must be Solana).
 * Returns the base58-encoded detached signature.
 */
export declare function signSiwsMessage(message: string, identity: ChainIdentity): Promise<string>;
/**
 * Verify a SIWS signature.
 */
export declare function verifySiwsSignature(message: string, signatureBase58: string, addressBase58: string): boolean;
//# sourceMappingURL=siws.d.ts.map