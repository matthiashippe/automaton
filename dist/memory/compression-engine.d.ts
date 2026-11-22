/**
 * Dynamic Context Compression Engine
 *
 * Progressive 5-stage compression cascade for long-running conversations.
 */
import type { ContextManager, ContextUtilization } from "./context-manager.js";
import { EventStream } from "./event-stream.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";
export interface CompressionPlan {
    maxStage: 1 | 2 | 3 | 4 | 5;
    actions: CompressionAction[];
    estimatedTokensSaved: number;
    reason: string;
}
export type CompressionAction = {
    type: "compact_tool_results";
    turnIds: string[];
} | {
    type: "compress_turns";
    turnIds: string[];
} | {
    type: "summarize_batch";
    turnIds: string[];
    maxTokens: number;
} | {
    type: "checkpoint_and_reset";
    checkpointId: string;
} | {
    type: "emergency_truncate";
    keepLastN: number;
};
export interface ConversationCheckpoint {
    id: string;
    agentAddress: string;
    summary: string;
    summaryTokens: number;
    activeGoalIds: string[];
    activeTaskIds: string[];
    keyDecisions: string[];
    financialState: any;
    turnCount: number;
    tokensSaved: number;
    createdAt: string;
    filePath: string;
}
export interface CompressionMetrics {
    turnNumber: number;
    preCompressionTokens: number;
    postCompressionTokens: number;
    compressionRatio: number;
    stage: number;
    tokensSaved: number;
    latencyMs: number;
    totalCheckpoints: number;
    totalEmergencyTruncations: number;
    compressedTurnCount: number;
    averageCompressionRatio: number;
    peakUtilizationPercent: number;
    turnsWithoutCompression: number;
}
export interface CompressionResult {
    plan: CompressionPlan;
    metrics: CompressionMetrics;
    success: boolean;
}
export declare class CompressionEngine {
    private readonly contextManager;
    private readonly eventStream;
    private readonly knowledgeStore;
    private readonly inference;
    private totalCheckpoints;
    private totalEmergencyTruncations;
    private compressedTurnCount;
    private compressionRatioSum;
    private peakUtilizationPercent;
    private turnsWithoutCompression;
    constructor(contextManager: ContextManager, eventStream: EventStream, knowledgeStore: KnowledgeStore, inference: UnifiedInferenceClient);
    evaluate(utilization: ContextUtilization): Promise<CompressionPlan>;
    execute(plan: CompressionPlan): Promise<CompressionResult>;
    private compactPrefixByTurnIds;
    private runStage3BatchSummaries;
    private summarizeBatch;
    private runStage4CheckpointAndReset;
    private summarizeForCheckpoint;
    private rehydrateActiveTasks;
    private runStage5EmergencyTruncation;
    private logCompressionError;
    private logCompressionMetrics;
    private estimateSavings;
    private sumActionTokens;
    private resolveBoundary;
    private collectActiveTasksAndGoals;
    private extractKeyDecisions;
    private extractFinancialState;
    private selectRetainedTurnWindow;
    private buildToolPairRanges;
    private getTurnEvents;
    private getAllCompressionEvents;
    private buildEventIndex;
    private pickAgentAddress;
}
//# sourceMappingURL=compression-engine.d.ts.map