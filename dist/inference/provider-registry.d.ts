import OpenAI from "openai";
export type ModelTier = "reasoning" | "fast" | "cheap";
export interface ProviderConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKeyEnvVar: string;
    models: ModelConfig[];
    maxRequestsPerMinute: number;
    maxTokensPerMinute: number;
    priority: number;
    enabled: boolean;
}
export interface ModelConfig {
    id: string;
    tier: ModelTier;
    contextWindow: number;
    maxOutputTokens: number;
    costPerInputToken: number;
    costPerOutputToken: number;
    supportsTools: boolean;
    supportsVision: boolean;
    supportsStreaming: boolean;
}
export interface ResolvedModel {
    provider: ProviderConfig;
    model: ModelConfig;
    client: OpenAI;
}
interface TierDefault {
    preferredProvider: string;
    fallbackOrder: string[];
}
export declare class ProviderRegistry {
    private readonly providers;
    private readonly tierDefaults;
    private readonly disablements;
    private readonly emergencyStopCredits;
    constructor(providers: ProviderConfig[], tierDefaults?: Record<ModelTier, TierDefault>, emergencyStopCredits?: number);
    overrideBaseUrl(providerId: string, baseUrl: string): void;
    static fromConfig(configPath: string): ProviderRegistry;
    resolveModel(tier: ModelTier, survivalMode?: boolean): ResolvedModel;
    resolveCandidates(tier: ModelTier, survivalMode?: boolean): ResolvedModel[];
    getModel(providerId: string, modelId: string): ResolvedModel;
    getProviders(): ProviderConfig[];
    disableProvider(id: string, reason: string, durationMs: number): void;
    enableProvider(id: string): void;
    private getProviderOrderForTier;
    private buildResolvedModel;
    private resolveApiKey;
    private isProviderActive;
    private applySurvivalTier;
    private assertEmergencyPolicy;
}
export {};
//# sourceMappingURL=provider-registry.d.ts.map