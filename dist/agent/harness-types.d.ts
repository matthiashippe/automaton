import type { TaskNode, TaskResult } from "../orchestration/task-graph.js";
import type { AutomatonTool, AutomatonConfig, AutomatonIdentity, ChatMessage, ConwayClient, InferenceToolCall, InputSource, SpendTrackerInterface, ToolContext } from "../types.js";
import type { AgentWorkspace } from "../orchestration/workspace.js";
import type { PolicyEngine } from "./policy-engine.js";
export interface AgentHarness {
    readonly id: string;
    readonly description: string;
    initialize(task: TaskNode, context: HarnessContext): Promise<void>;
    execute(): Promise<TaskResult>;
    getToolDefs(): HarnessTool[];
    buildSystemPrompt(): string;
    buildTaskPrompt(): string;
}
export interface HarnessTool {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
}
export interface HarnessContext {
    workspaceRoot: string;
    allowedEditRoot: string;
    workspace: AgentWorkspace;
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: import("better-sqlite3").Database;
    conway: ConwayClient;
    inference: WorkerInferenceClient;
    budget: IterationBudget;
    wisdom: AccumulatedWisdom;
    abortSignal: AbortSignal;
    goalId: string;
    toolCatalog?: AutomatonTool[];
    toolContext?: ToolContext;
    policyEngine?: PolicyEngine;
    spendTracker?: SpendTrackerInterface;
    inputSource?: InputSource;
}
export interface WorkerInferenceClient {
    chat(params: {
        tier?: string;
        messages: ChatMessage[];
        tools?: Array<{
            type: "function";
            function: {
                name: string;
                description: string;
                parameters: Record<string, unknown>;
            };
        }>;
        toolChoice?: string;
        maxTokens?: number;
        temperature?: number;
        responseFormat?: {
            type: string;
        };
    }): Promise<{
        content: string;
        toolCalls?: InferenceToolCall[];
    }>;
}
export interface IterationBudget {
    maxTurns: number;
    maxCostCents: number;
    timeoutMs: number;
    turnsUsed: number;
    costUsedCents: number;
    startedAt: number;
}
export interface AccumulatedWisdom {
    conventions: string[];
    successes: string[];
    failures: string[];
    gotchas: string[];
}
export declare function createBudgetFromTask(task: TaskNode): IterationBudget;
export declare function emptyWisdom(): AccumulatedWisdom;
export declare function buildWisdomFromGoal(db: import("better-sqlite3").Database, goalId: string, workspace: AgentWorkspace): AccumulatedWisdom;
//# sourceMappingURL=harness-types.d.ts.map