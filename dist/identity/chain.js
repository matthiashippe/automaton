/**
 * Chain Abstraction Layer
 *
 * Chain-at-genesis selection: an automaton picks `evm` or `solana` at setup
 * time and keeps that identity forever. The wallet IS the sovereign identity.
 *
 * Ported from aiws control-plane wallet.ts + siws.ts utilities.
 */
import nacl from "tweetnacl";
import bs58 from "bs58";
// ─── Address Validation ──────────────────────────────────────
export function isValidEvmAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}
export function isValidSolanaAddress(address) {
    try {
        return bs58.decode(address).length === 32;
    }
    catch {
        return false;
    }
}
export function isValidAddress(address, chainType) {
    if (chainType === "evm")
        return isValidEvmAddress(address);
    if (chainType === "solana")
        return isValidSolanaAddress(address);
    return isValidEvmAddress(address) || isValidSolanaAddress(address);
}
export function detectChainType(address) {
    if (isValidEvmAddress(address))
        return "evm";
    if (isValidSolanaAddress(address))
        return "solana";
    return null;
}
export function normalizeAddress(address, chain) {
    return chain === "evm" ? address.toLowerCase() : address;
}
/**
 * EVM chain identity wrapping a viem PrivateKeyAccount.
 */
export class EvmChainIdentity {
    chainType = "evm";
    address;
    account;
    constructor(account) {
        this.account = account;
        this.address = account.address;
    }
    async signMessage(message) {
        return this.account.signMessage({ message });
    }
}
/**
 * Solana chain identity wrapping a tweetnacl Ed25519 keypair.
 */
export class SolanaChainIdentity {
    chainType = "solana";
    address;
    keypair;
    constructor(secretKey) {
        this.keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
        this.address = bs58.encode(this.keypair.publicKey);
    }
    async signMessage(message) {
        const messageBytes = new TextEncoder().encode(message);
        const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
        return bs58.encode(signature);
    }
    /** Get the raw 64-byte secret key for serialization. */
    getSecretKey() {
        return this.keypair.secretKey;
    }
    /** Get the raw 32-byte public key. */
    getPublicKey() {
        return this.keypair.publicKey;
    }
}
//# sourceMappingURL=chain.js.map