/**
 * Automaton Wallet Management
 *
 * Creates and manages wallets for the automaton's identity and payments.
 * Supports both EVM (secp256k1/viem) and Solana (Ed25519/tweetnacl) wallets.
 * The private key is the automaton's sovereign identity.
 * Chain type is chosen at genesis and never changes.
 */
import type { PrivateKeyAccount } from "viem";
import type { ChainType } from "./chain.js";
import type { ChainIdentity } from "./chain.js";
export declare function getAutomatonDir(): string;
export declare function getWalletPath(): string;
/**
 * Generate a Solana Ed25519 keypair.
 * Returns the 64-byte secret key (first 32 = private, last 32 = public).
 */
export declare function generateSolanaKeypair(): {
    secretKey: Uint8Array;
    publicKey: Uint8Array;
    address: string;
};
/**
 * Get or create the automaton's wallet.
 * The private key IS the automaton's identity -- protect it.
 *
 * @param chainType - If creating a new wallet, which chain to use. Defaults to "evm".
 */
export declare function getWallet(chainType?: ChainType): Promise<{
    account: PrivateKeyAccount;
    chainIdentity: ChainIdentity;
    chainType: ChainType;
    isNew: boolean;
}>;
/**
 * Get the wallet address without loading the full account.
 */
export declare function getWalletAddress(): string | null;
/**
 * Load the full wallet account (needed for signing).
 * For Solana wallets, returns a proxy account.
 */
export declare function loadWalletAccount(): PrivateKeyAccount | null;
/**
 * Get the chain type from the wallet file.
 */
export declare function getWalletChainType(): ChainType;
export declare function walletExists(): boolean;
//# sourceMappingURL=wallet.d.ts.map