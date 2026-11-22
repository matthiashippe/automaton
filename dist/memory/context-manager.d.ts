/**
 * Context Window Manager
 *
 * Model-aware context assembly with token-budget enforcement.
 */
import type { ChatMessage } from "../types.js";
export interface ContextBudget {
    totalTokens: number;
    reserveTokens: number;
    systemPromptTokens: number;
    todoTokens: number;
    memoryTokens: number;
    eventTokens: number;
    turnTokens: number;
    compressionHeadroom: number;
}
export interface TokenCounter {
    countTokens(text: string, model?: string): number;
    cache: Map<string, number>;
    countBatch(texts: string[]): number[];
}
export interface ContextUtilization {
    totalTokens: number;
    usedTokens: number;
    utilizationPercent: number;
    turnsInContext: number;
    compressedTurns: number;
    compressionRatio: number;
    headroomTokens: number;
    recommendation: "ok" | "compress" | "emergency";
}
export interface AssembledContext {
    messages: ChatMessage[];
    utilization: ContextUtilization;
    budget: ContextBudget;
}
export interface ContextAssemblyParams {
    systemPrompt: string;
    todoMd?: string;
    recentTurns: any[];
    taskSpec?: string;
    memories?: string;
    events?: any[];
    modelContextWindow: number;
    reserveTokens?: number;
}
export type EventType = "user_input" | "plan_created" | "plan_updated" | "task_assigned" | "task_completed" | "task_failed" | "action" | "observation" | "inference" | "financial" | "agent_spawned" | "agent_died" | "knowledge" | "market_signal" | "revenue" | "error" | "reflection";
export interface StreamEvent {
    id: string;
    type: EventType | string;
    agentAddress: string;
    goalId: string | null;
    taskId: string | null;
    content: string;
    tokenCount: number;
    compactedTo: string | null;
    createdAt: string;
}
export interface CompactedEventReference {
    id: string;
    type: string;
    createdAt: string;
    goalId: string | null;
    taskId: string | null;
    reference: string;
    originalTokens: number;
    compactedTokens: number;
}
export interface CompactedContext {
    events: CompactedEventReference[];
    originalTokens: number;
    compactedTokens: number;
    compressionRatio: number;
}
export declare function createTokenCounter(): TokenCounter;
export declare class ContextManager {
    private readonly tokenCounter;
    private lastUtilization;
    constructor(tokenCounter: TokenCounter);
    assembleContext(params: ContextAssemblyParams): AssembledContext;
    getUtilization(): ContextUtilization;
    compact(events: StreamEvent[]): CompactedContext;
    private renderTurn;
    private renderEvent;
    private normalizeStreamEvent;
    private buildEventReference;
    private sanitizeText;
    private looksLikeChatMessage;
    private countMessagesTokens;
    private serializeMessage;
}
//# sourceMappingURL=context-manager.d.ts.map