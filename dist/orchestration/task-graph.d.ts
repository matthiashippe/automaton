import type { Database } from "better-sqlite3";
export type TaskStatus = "pending" | "assigned" | "running" | "completed" | "failed" | "blocked" | "cancelled";
export type GoalStatus = "active" | "completed" | "failed" | "paused";
export interface TaskResult {
    success: boolean;
    output: string;
    artifacts: string[];
    costCents: number;
    duration: number;
}
export interface TaskNode {
    id: string;
    parentId: string | null;
    goalId: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignedTo: string | null;
    agentRole: string | null;
    priority: number;
    dependencies: string[];
    result: TaskResult | null;
    metadata: {
        estimatedCostCents: number;
        actualCostCents: number;
        maxRetries: number;
        retryCount: number;
        timeoutMs: number;
        createdAt: string;
        startedAt: string | null;
        completedAt: string | null;
    };
}
export interface Goal {
    id: string;
    title: string;
    description: string;
    status: GoalStatus;
    strategy: string | null;
    rootTasks: string[];
    expectedRevenueCents: number;
    actualRevenueCents: number;
    createdAt: string;
    deadline: string | null;
}
type CycleTask = {
    id?: string;
    title?: string;
    parentId?: string | null;
    dependencies: string[];
};
export declare function createGoal(db: Database, title: string, description: string, strategy?: string): Goal;
export declare function decomposeGoal(db: Database, goalId: string, tasks: Omit<TaskNode, "id" | "metadata">[]): void;
export declare function getReadyTasks(db: Database): TaskNode[];
export declare function assignTask(db: Database, taskId: string, agentAddress: string): void;
export declare function completeTask(db: Database, taskId: string, result: TaskResult): void;
export declare function failTask(db: Database, taskId: string, error: string, shouldRetry: boolean): void;
export declare function getGoalProgress(db: Database, goalId: string): {
    total: number;
    completed: number;
    failed: number;
    blocked: number;
    running: number;
};
export declare function pruneCompletedGoals(db: Database, olderThan: string): void;
export declare function detectCycles(tasks: CycleTask[]): boolean;
export declare function normalizeTaskResult(value: unknown): TaskResult | null;
export {};
//# sourceMappingURL=task-graph.d.ts.map