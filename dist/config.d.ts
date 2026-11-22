/**
 * Automaton Configuration
 *
 * Loads and saves the automaton's configuration from ~/.automaton/automaton.json
 */
import type { AutomatonConfig, TreasuryPolicy, ModelStrategyConfig } from "./types.js";
import type { ChainType } from "./identity/chain.js";
export declare function getConfigPath(): string;
/**
 * Load the automaton config from disk.
 * Merges with defaults for any missing fields.
 */
export declare function loadConfig(): AutomatonConfig | null;
/**
 * Save the automaton config to disk.
 * Includes treasuryPolicy in the persisted config.
 */
export declare function saveConfig(config: AutomatonConfig): void;
/**
 * Resolve ~ paths to absolute paths.
 */
export declare function resolvePath(p: string): string;
/**
 * Create a fresh config from setup wizard inputs.
 */
export declare function createConfig(params: {
    name: string;
    genesisPrompt: string;
    creatorMessage?: string;
    creatorAddress: string;
    registeredWithConway: boolean;
    sandboxId: string;
    walletAddress: string;
    apiKey: string;
    conwayApiUrl?: string;
    modelStrategy?: Partial<ModelStrategyConfig>;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaBaseUrl?: string;
    parentAddress?: string;
    treasuryPolicy?: TreasuryPolicy;
    chainType?: ChainType;
}): AutomatonConfig;
//# sourceMappingURL=config.d.ts.map