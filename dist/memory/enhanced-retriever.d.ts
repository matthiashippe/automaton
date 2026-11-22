/**
 * Enhanced memory retrieval with metadata-based relevance scoring.
 *
 * This module intentionally does NOT use embeddings/vector search.
 */
import type BetterSqlite3 from "better-sqlite3";
import type { MemoryBudget } from "../types.js";
import type { ContextUtilization } from "./context-manager.js";
import { type KnowledgeCategory } from "./knowledge-store.js";
import { MemoryRetriever } from "./retrieval.js";
type Database = BetterSqlite3.Database;
export interface ScoredMemoryEntry {
    entry: any;
    relevanceScore: number;
    scoringFactors: {
        recency: number;
        frequency: number;
        confidence: number;
        taskAffinity: number;
        categoryMatch: number;
    };
}
export interface ScoredMemoryRetrievalResult {
    entries: ScoredMemoryEntry[];
    totalTokens: number;
    truncated: boolean;
    retrievalPrecision?: number;
}
export interface RetrievalFeedback {
    turnId: string;
    retrieved: string[];
    matched: string[];
    retrievalPrecision: number;
    rollingPrecision: number;
}
export interface EnhancedQuery {
    terms: string[];
    categories: KnowledgeCategory[];
    timeRange?: {
        since: string;
    };
}
export declare function calculateMemoryBudget(utilization: ContextUtilization, tokensAfterSystemPrompt: number): number;
export declare function enhanceQuery(params: {
    currentInput: string;
    taskSpec?: string;
    agentRole?: string;
    recentGoals?: string[];
}): EnhancedQuery;
export declare function recordRetrievalFeedback(feedback: RetrievalFeedback): void;
export declare class EnhancedRetriever extends MemoryRetriever {
    private readonly db;
    private readonly knowledgeStore;
    private readonly taskStore?;
    constructor(db: Database, budget?: MemoryBudget, taskStore?: any);
    retrieveScored(params: {
        sessionId: string;
        currentInput?: string;
        currentTaskId?: string;
        currentGoalId?: string;
        agentRole?: string;
        budgetTokens: number;
    }): ScoredMemoryRetrievalResult;
    recordRetrievalFeedback(feedback: RetrievalFeedback): void;
    private buildResult;
    private collectKnowledgeCandidates;
    private searchTermAcrossCategories;
    private computeScoringFactors;
    private resolveEntryTokenCount;
    private resolveTaskSpec;
    private resolveRecentGoals;
}
export {};
//# sourceMappingURL=enhanced-retriever.d.ts.map