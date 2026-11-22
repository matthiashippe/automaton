/**
 * Agent Context Aggregator
 *
 * Prevents parent-context explosion by triaging and aggregating child updates.
 */
export interface AgentStatusUpdate {
    agentAddress: string;
    department?: string;
    role?: string;
    status?: string;
    kind?: string;
    message?: string;
    taskId?: string;
    error?: string;
    blocked?: boolean;
    financialAmount?: number;
    dailyBudget?: number;
    budgetImpactPercent?: number;
    createdAt?: string;
    metadata?: Record<string, unknown>;
}
export interface AggregatedSummaryEntry {
    group: string;
    count: number;
    completed: number;
    progress: number;
    other: number;
    highlight: string | null;
}
export interface AggregatedUpdate {
    summary: string;
    fullUpdates: AgentStatusUpdate[];
    summaryEntries: AggregatedSummaryEntry[];
    heartbeatCount: number;
    triageCounts: {
        full: number;
        summary: number;
        count: number;
    };
    estimatedTokens: number;
}
export declare class AgentContextAggregator {
    aggregateChildUpdates(updates: AgentStatusUpdate[], budgetTokens: number): AggregatedUpdate;
    triageUpdate(update: AgentStatusUpdate): "full" | "summary" | "count";
    private renderSummary;
    private isError;
    private isLargeFinancialEvent;
    private isBlocked;
    private isCompleted;
    private isProgress;
    private isHeartbeat;
}
//# sourceMappingURL=agent-context-aggregator.d.ts.map