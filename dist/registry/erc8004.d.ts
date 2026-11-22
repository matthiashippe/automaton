/**
 * ERC-8004 On-Chain Agent Registration
 *
 * Registers the automaton on-chain as a Trustless Agent via ERC-8004.
 * Uses the Identity Registry on Base mainnet.
 *
 * Contract: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (Base)
 * Reputation: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 (Base)
 *
 * Phase 3.2: Added preflight gas check, score validation, config-based network,
 * Transfer event topic fix, and transaction logging.
 */
import { type Address, type PrivateKeyAccount } from "viem";
import type { RegistryEntry, DiscoveredAgent, AutomatonDatabase } from "../types.js";
import type { ChainType } from "../identity/chain.js";
/**
 * Guard: throws if the automaton is using a Solana wallet.
 * ERC-8004 is an EVM standard and requires an EVM wallet.
 */
export declare function requireEvmChain(chainType?: ChainType): void;
type Network = "mainnet" | "testnet";
/**
 * Register the automaton on-chain with ERC-8004.
 * Returns the agent ID (NFT token ID).
 *
 * Phase 3.2: Preflight check + transaction logging.
 */
export declare function registerAgent(account: PrivateKeyAccount, agentURI: string, network: Network | undefined, db: AutomatonDatabase, rpcUrl?: string): Promise<RegistryEntry>;
/**
 * Update the agent's URI on-chain.
 */
export declare function updateAgentURI(account: PrivateKeyAccount, agentId: string, newAgentURI: string, network: Network | undefined, db: AutomatonDatabase, rpcUrl?: string): Promise<string>;
/**
 * Leave reputation feedback for another agent.
 *
 * Phase 3.2: Validates score 1-5, comment max 500 chars,
 * uses config-based network (not hardcoded "mainnet").
 */
export declare function leaveFeedback(account: PrivateKeyAccount, agentId: string, score: number, comment: string, network: Network | undefined, db: AutomatonDatabase, rpcUrl?: string): Promise<string>;
/**
 * Query the registry for an agent by ID.
 */
export declare function queryAgent(agentId: string, network?: Network, rpcUrl?: string): Promise<DiscoveredAgent | null>;
/**
 * Get the total number of registered agents.
 * Tries totalSupply() first; if that reverts (proxy contracts without
 * ERC-721 Enumerable), falls back to a binary search on ownerOf().
 */
export declare function getTotalAgents(network?: Network, rpcUrl?: string): Promise<number>;
/**
 * Discover registered agents by scanning Transfer mint events.
 * Fallback for contracts that don't implement totalSupply (ERC-721 Enumerable).
 *
 * Scans for Transfer(address(0), to, tokenId) events to find minted tokens.
 * Returns token IDs and owners extracted directly from event data.
 */
export declare function getRegisteredAgentsByEvents(network?: Network, limit?: number, rpcUrl?: string): Promise<{
    tokenId: string;
    owner: string;
}[]>;
/**
 * Check if an address has a registered agent.
 */
export declare function hasRegisteredAgent(address: Address, network?: Network, rpcUrl?: string): Promise<boolean>;
export {};
//# sourceMappingURL=erc8004.d.ts.map