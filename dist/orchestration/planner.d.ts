import type { Goal, TaskNode } from "./task-graph.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";
export interface PlannerOutput {
    analysis: string;
    strategy: string;
    customRoles: CustomRoleDef[];
    tasks: PlannedTask[];
    risks: string[];
    estimatedTotalCostCents: number;
    estimatedTimeMinutes: number;
}
export interface CustomRoleDef {
    name: string;
    description: string;
    systemPrompt: string;
    allowedTools: string[];
    deniedTools?: string[];
    model: string;
    maxTokensPerTurn?: number;
    maxTurnsPerTask?: number;
    treasuryLimits?: {
        maxSingleTransfer: number;
        maxDailySpend: number;
    };
    rationale: string;
}
export interface PlannedTask {
    title: string;
    description: string;
    agentRole: string;
    dependencies: number[];
    estimatedCostCents: number;
    priority: number;
    timeoutMs: number;
}
export interface PlannerContext {
    creditsCents: number;
    usdcBalance: number;
    survivalTier: string;
    availableRoles: string[];
    customRoles: string[];
    activeGoals: any[];
    recentOutcomes: any[];
    marketIntel: string;
    idleAgents: number;
    busyAgents: number;
    maxAgents: number;
    workspaceFiles: string[];
}
export interface PlannerGoalInput {
    id: string;
    title: string;
    description: string;
    status: Goal["status"] | string;
    strategy: string | null;
    rootTasks: string[];
    expectedRevenueCents: number;
    actualRevenueCents: number;
    createdAt: string;
    deadline: string | null;
}
export interface PlannerFailureInput {
    id: string;
    title: string;
    description: string;
    status: TaskNode["status"] | string;
    agentRole: string | null;
    dependencies: string[];
    assignedTo: string | null;
    result: TaskNode["result"];
    metadata: TaskNode["metadata"];
}
export declare function planGoal(goal: PlannerGoalInput, context: PlannerContext, inference: UnifiedInferenceClient): Promise<PlannerOutput>;
export declare function replanAfterFailure(goal: PlannerGoalInput, failedTask: PlannerFailureInput, context: PlannerContext, inference: UnifiedInferenceClient): Promise<PlannerOutput>;
export declare function goalToPlannerInput(goal: Goal): PlannerGoalInput;
export declare function taskToPlannerFailureInput(task: TaskNode): PlannerFailureInput;
export declare function createPlannerGoalFromTask(task: Pick<TaskNode, "id" | "goalId" | "title" | "description" | "status" | "dependencies" | "metadata">): PlannerGoalInput;
export declare function createPlannerFailureFromVerification(params: {
    task: TaskNode;
    output: string;
    note?: string;
}): PlannerFailureInput;
export declare function buildPlannerPrompt(context: PlannerContext): string;
export declare function validatePlannerOutput(output: unknown): PlannerOutput;
//# sourceMappingURL=planner.d.ts.map