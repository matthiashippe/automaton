/**
 * Chain Abstraction Layer
 *
 * Chain-at-genesis selection: an automaton picks `evm` or `solana` at setup
 * time and keeps that identity forever. The wallet IS the sovereign identity.
 *
 * Ported from aiws control-plane wallet.ts + siws.ts utilities.
 */
import type { PrivateKeyAccount } from "viem";
export type ChainType = "evm" | "solana";
export declare function isValidEvmAddress(address: string): boolean;
export declare function isValidSolanaAddress(address: string): boolean;
export declare function isValidAddress(address: string, chainType?: ChainType): boolean;
export declare function detectChainType(address: string): ChainType | null;
export declare function normalizeAddress(address: string, chain: ChainType): string;
/**
 * Chain-agnostic identity interface.
 * Wraps either a viem PrivateKeyAccount (EVM) or an Ed25519 keypair (Solana).
 */
export interface ChainIdentity {
    readonly chainType: ChainType;
    readonly address: string;
    signMessage(message: string): Promise<string>;
}
/**
 * EVM chain identity wrapping a viem PrivateKeyAccount.
 */
export declare class EvmChainIdentity implements ChainIdentity {
    readonly chainType: ChainType;
    readonly address: string;
    readonly account: PrivateKeyAccount;
    constructor(account: PrivateKeyAccount);
    signMessage(message: string): Promise<string>;
}
/**
 * Solana chain identity wrapping a tweetnacl Ed25519 keypair.
 */
export declare class SolanaChainIdentity implements ChainIdentity {
    readonly chainType: ChainType;
    readonly address: string;
    private readonly keypair;
    constructor(secretKey: Uint8Array);
    signMessage(message: string): Promise<string>;
    /** Get the raw 64-byte secret key for serialization. */
    getSecretKey(): Uint8Array;
    /** Get the raw 32-byte public key. */
    getPublicKey(): Uint8Array;
}
//# sourceMappingURL=chain.d.ts.map