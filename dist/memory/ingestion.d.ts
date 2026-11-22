/**
 * Memory Ingestion Pipeline
 *
 * Post-turn pipeline that automatically extracts and stores memories.
 * Classifies turns, generates summaries, extracts facts,
 * updates relationships, and manages working memory.
 *
 * All operations are wrapped in try/catch: ingestion failures
 * must never block the agent loop.
 */
import type BetterSqlite3 from "better-sqlite3";
import type { AgentTurn, ToolCallResult } from "../types.js";
import { KnowledgeStore, type KnowledgeCategory, type KnowledgeEntry } from "./knowledge-store.js";
type Database = BetterSqlite3.Database;
/**
 * Normalize a tool error string into a short, consistent type label.
 * Matches known patterns first, then falls back to a sanitized prefix.
 */
export declare function normalizeErrorType(error: string): string;
export interface MarketSignal {
    type: string;
    signal: string;
    source: string;
    confidence: number;
    extractedAt: string;
}
export interface ExtractedFact {
    category: KnowledgeCategory;
    key: string;
    value: string;
    source: string;
    confidence: number;
}
export interface Contradiction {
    existingEntry: KnowledgeEntry;
    newFact: ExtractedFact;
    description: string;
}
export declare class MemoryIngestionPipeline {
    private db;
    private working;
    private episodic;
    private semantic;
    private relationships;
    private knowledgeStore;
    private eventStream;
    private enhancementsChecked;
    private hasKnowledgeStoreTable;
    private hasEventStreamTable;
    constructor(db: Database);
    /**
     * Ingest a completed turn into the memory system.
     * Never throws -- all errors are caught and logged.
     */
    ingest(sessionId: string, turn: AgentTurn, toolCallResults: ToolCallResult[]): void;
    extractMarketSignals(toolCalls: ToolCallResult[]): MarketSignal[];
    updateKnowledgeStore(knowledgeStore: KnowledgeStore, facts: ExtractedFact[]): void;
    detectContradictions(newFact: ExtractedFact, existing: KnowledgeEntry[]): Contradiction[];
    scoreConfidence(source: string, recency: string): number;
    private ingestKnowledgeEnhancements;
    private toExtractedFact;
    private buildFactKey;
    private emitMarketSignals;
    private emitContradictions;
    private safePruneKnowledgeStore;
    private isMarketSource;
    private resolveSource;
    private resolveRecency;
    private splitSignalCandidates;
    private classifySignalTypes;
    private scoreRecency;
    private daysToRecencyScore;
    private normalizeKey;
    private normalizeValue;
    private ensureEnhancementTableState;
    private recordEpisodic;
    private generateTurnSummary;
    private extractSemanticFacts;
    private updateRelationships;
    private updateWorkingMemory;
}
export {};
//# sourceMappingURL=ingestion.d.ts.map