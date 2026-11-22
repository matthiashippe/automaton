/**
 * Automaton Wallet Management
 *
 * Creates and manages wallets for the automaton's identity and payments.
 * Supports both EVM (secp256k1/viem) and Solana (Ed25519/tweetnacl) wallets.
 * The private key is the automaton's sovereign identity.
 * Chain type is chosen at genesis and never changes.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import nacl from "tweetnacl";
import bs58 from "bs58";
import fs from "fs";
import path from "path";
import { EvmChainIdentity, SolanaChainIdentity } from "./chain.js";
/**
 * Create a stub PrivateKeyAccount for Solana wallets.
 * The stub has the Solana address but throws on any EVM signing attempt,
 * preventing accidental use of a random key.
 */
function createSolanaStubAccount(solanaAddress) {
    const throwSigning = () => {
        throw new Error("Cannot use EVM signing methods on a Solana wallet. Use chainIdentity instead.");
    };
    return {
        address: solanaAddress,
        publicKey: "0x",
        source: "custom",
        type: "local",
        signMessage: throwSigning,
        signTypedData: throwSigning,
        signTransaction: throwSigning,
        sign: throwSigning,
    };
}
const AUTOMATON_DIR = path.join(process.env.HOME || "/root", ".automaton");
const WALLET_FILE = path.join(AUTOMATON_DIR, "wallet.json");
export function getAutomatonDir() {
    return AUTOMATON_DIR;
}
export function getWalletPath() {
    return WALLET_FILE;
}
/**
 * Generate a Solana Ed25519 keypair.
 * Returns the 64-byte secret key (first 32 = private, last 32 = public).
 */
export function generateSolanaKeypair() {
    const keypair = nacl.sign.keyPair();
    return {
        secretKey: keypair.secretKey,
        publicKey: keypair.publicKey,
        address: bs58.encode(keypair.publicKey),
    };
}
/**
 * Get or create the automaton's wallet.
 * The private key IS the automaton's identity -- protect it.
 *
 * @param chainType - If creating a new wallet, which chain to use. Defaults to "evm".
 */
export async function getWallet(chainType) {
    if (!fs.existsSync(AUTOMATON_DIR)) {
        fs.mkdirSync(AUTOMATON_DIR, { recursive: true, mode: 0o700 });
    }
    if (fs.existsSync(WALLET_FILE)) {
        const walletData = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
        const resolvedChainType = walletData.chainType || "evm";
        if (resolvedChainType === "solana" && walletData.secretKey) {
            const secretKey = bs58.decode(walletData.secretKey);
            const solanaIdentity = new SolanaChainIdentity(secretKey);
            const account = createSolanaStubAccount(solanaIdentity.address);
            return { account, chainIdentity: solanaIdentity, chainType: "solana", isNew: false };
        }
        // EVM path (default)
        const account = privateKeyToAccount(walletData.privateKey);
        return { account, chainIdentity: new EvmChainIdentity(account), chainType: "evm", isNew: false };
    }
    // Create new wallet
    const resolvedChain = chainType || "evm";
    if (resolvedChain === "solana") {
        const { secretKey, address } = generateSolanaKeypair();
        const solanaIdentity = new SolanaChainIdentity(secretKey);
        const walletData = {
            chainType: "solana",
            secretKey: bs58.encode(secretKey),
            createdAt: new Date().toISOString(),
        };
        fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2), {
            mode: 0o600,
        });
        const account = createSolanaStubAccount(address);
        return { account, chainIdentity: solanaIdentity, chainType: "solana", isNew: true };
    }
    // EVM wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const walletData = {
        chainType: "evm",
        privateKey,
        createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2), {
        mode: 0o600,
    });
    return { account, chainIdentity: new EvmChainIdentity(account), chainType: "evm", isNew: true };
}
/**
 * Get the wallet address without loading the full account.
 */
export function getWalletAddress() {
    if (!fs.existsSync(WALLET_FILE)) {
        return null;
    }
    const walletData = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
    if (walletData.chainType === "solana" && walletData.secretKey) {
        const secretKey = bs58.decode(walletData.secretKey);
        const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
        return bs58.encode(keypair.publicKey);
    }
    const account = privateKeyToAccount(walletData.privateKey);
    return account.address;
}
/**
 * Load the full wallet account (needed for signing).
 * For Solana wallets, returns a proxy account.
 */
export function loadWalletAccount() {
    if (!fs.existsSync(WALLET_FILE)) {
        return null;
    }
    const walletData = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
    if (walletData.chainType === "solana") {
        // Solana wallets don't have a PrivateKeyAccount; callers should use getWallet() instead
        return null;
    }
    return privateKeyToAccount(walletData.privateKey);
}
/**
 * Get the chain type from the wallet file.
 */
export function getWalletChainType() {
    if (!fs.existsSync(WALLET_FILE)) {
        return "evm";
    }
    try {
        const walletData = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
        return walletData.chainType || "evm";
    }
    catch {
        return "evm";
    }
}
export function walletExists() {
    return fs.existsSync(WALLET_FILE);
}
//# sourceMappingURL=wallet.js.map