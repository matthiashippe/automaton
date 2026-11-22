/**
 * Automaton Configuration
 *
 * Loads and saves the automaton's configuration from ~/.automaton/automaton.json
 */
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG, DEFAULT_TREASURY_POLICY, DEFAULT_MODEL_STRATEGY_CONFIG, DEFAULT_SOUL_CONFIG } from "./types.js";
import { getAutomatonDir } from "./identity/wallet.js";
import { loadApiKeyFromConfig } from "./identity/provision.js";
import { createLogger } from "./observability/logger.js";
const logger = createLogger("config");
const CONFIG_FILENAME = "automaton.json";
export function getConfigPath() {
    return path.join(getAutomatonDir(), CONFIG_FILENAME);
}
/**
 * Load the automaton config from disk.
 * Merges with defaults for any missing fields.
 */
export function loadConfig() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return null;
    }
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const apiKey = raw.conwayApiKey || loadApiKeyFromConfig();
        // Deep-merge treasury policy with defaults
        const treasuryPolicy = {
            ...DEFAULT_TREASURY_POLICY,
            ...(raw.treasuryPolicy ?? {}),
        };
        // Validate all treasury values are positive numbers
        for (const [key, value] of Object.entries(treasuryPolicy)) {
            if (key === "x402AllowedDomains")
                continue; // array, not number
            if (typeof value === "number" && (value < 0 || !Number.isFinite(value))) {
                logger.warn(`Invalid treasury value for ${key}: ${value}, using default`);
                treasuryPolicy[key] = DEFAULT_TREASURY_POLICY[key];
            }
        }
        // Deep-merge model strategy config with defaults
        const modelStrategy = {
            ...DEFAULT_MODEL_STRATEGY_CONFIG,
            ...(raw.modelStrategy ?? {}),
        };
        // Deep-merge soul config with defaults
        const soulConfig = {
            ...DEFAULT_SOUL_CONFIG,
            ...(raw.soulConfig ?? {}),
        };
        return {
            ...DEFAULT_CONFIG,
            ...raw,
            // CONWAY_API_URL is documented in --help and was never read. It now wins over the file, so
            // an automaton can be pointed at another control plane without editing automaton.json.
            // A choice saved in the file is never rewritten; only a file without one gets the default.
            conwayApiUrl: process.env.CONWAY_API_URL || raw.conwayApiUrl || DEFAULT_CONFIG.conwayApiUrl,
            sandboxId: typeof raw.sandboxId === "string"
                ? raw.sandboxId.trim()
                : DEFAULT_CONFIG.sandboxId,
            conwayApiKey: apiKey,
            treasuryPolicy,
            modelStrategy,
            soulConfig,
            chainType: raw.chainType || "evm",
        };
    }
    catch {
        return null;
    }
}
/**
 * Save the automaton config to disk.
 * Includes treasuryPolicy in the persisted config.
 */
export function saveConfig(config) {
    const dir = getAutomatonDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const configPath = getConfigPath();
    const toSave = {
        ...config,
        treasuryPolicy: config.treasuryPolicy ?? DEFAULT_TREASURY_POLICY,
        modelStrategy: config.modelStrategy ?? DEFAULT_MODEL_STRATEGY_CONFIG,
        soulConfig: config.soulConfig ?? DEFAULT_SOUL_CONFIG,
    };
    fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), {
        mode: 0o600,
    });
}
/**
 * Resolve ~ paths to absolute paths.
 */
export function resolvePath(p) {
    if (p.startsWith("~")) {
        return path.join(process.env.HOME || "/root", p.slice(1));
    }
    return p;
}
/**
 * Create a fresh config from setup wizard inputs.
 */
export function createConfig(params) {
    const normalizedSandboxId = (params.sandboxId || "").trim();
    return {
        name: params.name,
        genesisPrompt: params.genesisPrompt,
        creatorMessage: params.creatorMessage,
        creatorAddress: params.creatorAddress,
        registeredWithConway: params.registeredWithConway,
        sandboxId: normalizedSandboxId,
        conwayApiUrl: params.conwayApiUrl || DEFAULT_CONFIG.conwayApiUrl || "https://automatonhost.com",
        conwayApiKey: params.apiKey,
        openaiApiKey: params.openaiApiKey,
        anthropicApiKey: params.anthropicApiKey,
        ollamaBaseUrl: params.ollamaBaseUrl,
        inferenceModel: DEFAULT_CONFIG.inferenceModel || "gpt-5.2",
        maxTokensPerTurn: DEFAULT_CONFIG.maxTokensPerTurn || 4096,
        heartbeatConfigPath: DEFAULT_CONFIG.heartbeatConfigPath || "~/.automaton/heartbeat.yml",
        dbPath: DEFAULT_CONFIG.dbPath || "~/.automaton/state.db",
        logLevel: DEFAULT_CONFIG.logLevel || "info",
        walletAddress: params.walletAddress,
        version: DEFAULT_CONFIG.version || "0.2.1",
        skillsDir: DEFAULT_CONFIG.skillsDir || "~/.automaton/skills",
        maxChildren: DEFAULT_CONFIG.maxChildren || 3,
        parentAddress: params.parentAddress,
        treasuryPolicy: params.treasuryPolicy ?? DEFAULT_TREASURY_POLICY,
        chainType: params.chainType || "evm",
        ...(params.modelStrategy
            ? { modelStrategy: { ...DEFAULT_MODEL_STRATEGY_CONFIG, ...params.modelStrategy } }
            : {}),
    };
}
//# sourceMappingURL=config.js.map