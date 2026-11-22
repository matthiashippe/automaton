import type { Database } from "better-sqlite3";
import { UnifiedInferenceClient } from "../inference/inference-client.js";
import type { PlannerOutput } from "./planner.js";
export type ExecutionPhase = "idle" | "classifying" | "planning" | "plan_review" | "executing" | "replanning" | "complete" | "failed";
export interface ExecutionState {
    phase: ExecutionPhase;
    goalId: string;
    planId: string | null;
    planVersion: number;
    planFilePath: string | null;
    spawnedAgentIds: string[];
    replansRemaining: number;
    phaseEnteredAt: string;
}
export type PlanApprovalMode = "auto" | "supervised" | "consensus";
export interface PlanApprovalConfig {
    mode: PlanApprovalMode;
    autoBudgetThreshold: number;
    consensusCriticRole: string;
    reviewTimeoutMs: number;
}
export type ReplanTrigger = {
    type: "task_failure";
    taskId: string;
    error: string;
} | {
    type: "budget_breach";
    actualCents: number;
    estimatedCents: number;
} | {
    type: "requirement_change";
    newInput: string;
    conflictScore: number;
} | {
    type: "environment_change";
    resource: string;
    error: string;
} | {
    type: "opportunity";
    suggestion: string;
    agentAddress: string;
};
export declare class PlanModeController {
    private readonly db;
    constructor(db: Database);
    transition(from: ExecutionPhase, to: ExecutionPhase, reason: string): void;
    canSpawnAgents(): boolean;
    getState(): ExecutionState;
    setState(state: Partial<ExecutionState>): void;
}
export declare function classifyComplexity(params: {
    taskDescription: string;
    agentRole: string;
    availableTools: string[];
}, inference: UnifiedInferenceClient): Promise<{
    requiresPlanMode: boolean;
    estimatedSteps: number;
    reason: string;
    stepOutline: string[];
}>;
export declare function persistPlan(params: {
    goalId: string;
    version: number;
    plan: PlannerOutput;
    workspacePath: string;
}): Promise<{
    jsonPath: string;
    mdPath: string;
}>;
export declare function loadPlan(planFilePath: string): Promise<PlannerOutput>;
export declare function reviewPlan(plan: PlannerOutput, config: PlanApprovalConfig): Promise<{
    approved: boolean;
    feedback?: string;
}>;
export declare function shouldReplan(state: ExecutionState, trigger: ReplanTrigger): boolean;
//# sourceMappingURL=plan-mode.d.ts.map