/**
 * Append-only event stream for agent memory.
 */
import type BetterSqlite3 from "better-sqlite3";
type Database = BetterSqlite3.Database;
export type EventType = "user_input" | "plan_created" | "plan_updated" | "task_assigned" | "task_completed" | "task_failed" | "action" | "observation" | "inference" | "financial" | "agent_spawned" | "agent_died" | "knowledge" | "market_signal" | "revenue" | "error" | "reflection";
export interface StreamEvent {
    id: string;
    type: EventType;
    agentAddress: string;
    goalId: string | null;
    taskId: string | null;
    content: string;
    tokenCount: number;
    compactedTo: string | null;
    createdAt: string;
}
export interface CompactionResult {
    compactedCount: number;
    tokensSaved: number;
    strategy: string;
}
export declare function estimateTokens(text: string): number;
export declare class EventStream {
    private readonly db;
    constructor(db: Database);
    append(event: Omit<StreamEvent, "id" | "createdAt">): string;
    getRecent(agentAddress: string, limit?: number): StreamEvent[];
    getByGoal(goalId: string): StreamEvent[];
    getByType(type: EventType, since?: string): StreamEvent[];
    compact(olderThan: string, strategy: "reference" | "summarize"): CompactionResult;
    getTokenCount(agentAddress: string, since?: string): number;
    prune(olderThan: string): number;
}
export {};
//# sourceMappingURL=event-stream.d.ts.map