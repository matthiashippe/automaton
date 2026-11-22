import type { ChatMessage } from "../types.js";
import { ProviderRegistry, type ModelTier } from "./provider-registry.js";
export interface UnifiedInferenceResult {
    content: string;
    toolCalls?: unknown[];
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    cost: {
        inputCostCredits: number;
        outputCostCredits: number;
        totalCostCredits: number;
    };
    metadata: {
        providerId: string;
        modelId: string;
        tier: ModelTier;
        latencyMs: number;
        retries: number;
        failedProviders: string[];
    };
}
interface SharedChatParams {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    tools?: unknown[];
    toolChoice?: "auto" | "none" | "required" | Record<string, unknown>;
    responseFormat?: {
        type: "json_object" | "text";
    };
    stream?: boolean;
}
interface UnifiedChatParams extends SharedChatParams {
    tier: ModelTier;
}
interface UnifiedChatDirectParams extends SharedChatParams {
    providerId: string;
    modelId: string;
}
export declare class UnifiedInferenceClient {
    private readonly registry;
    private readonly circuitBreaker;
    constructor(registry: ProviderRegistry);
    chat(params: UnifiedChatParams): Promise<UnifiedInferenceResult>;
    chatDirect(params: UnifiedChatDirectParams): Promise<UnifiedInferenceResult>;
    private executeWithRetries;
    private executeSingleRequest;
    private buildChatCompletionRequest;
    private consumeStreamResponse;
    private buildUnifiedResult;
    private isRetryableError;
    private isProviderCircuitOpen;
    private markProviderFailure;
    private markProviderSuccess;
    private unwrapError;
    private isSurvivalMode;
}
export {};
//# sourceMappingURL=inference-client.d.ts.map