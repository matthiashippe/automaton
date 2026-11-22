import type { Database } from "better-sqlite3";
import type { PlannerContext, PlannerOutput } from "./planner.js";
import type { FundingProtocol } from "./types.js";
import type { AgentWorkspace } from "./workspace.js";
export interface PlannerContextOptions {
    db: Database;
    workspace?: Pick<AgentWorkspace, "basePath" | "listOutputs">;
    funding?: Pick<FundingProtocol, "getBalance">;
    identityAddress?: string;
    creditsCents?: number;
    usdcBalance?: number;
    availableRoles?: string[];
    customRoles?: string[];
    marketIntel?: string;
    idleAgents?: number;
    busyAgents?: number;
    maxAgents?: number;
}
export declare const DEFAULT_PLANNER_AVAILABLE_ROLES: readonly ["generalist", "executor", "researcher", "tester", "debugger", "architect", "analyst", "writer", "orchestrator", "planner", "critic"];
export declare function buildPlannerContext(options: PlannerContextOptions): Promise<PlannerContext>;
export declare function persistPlannerArtifacts(params: {
    goalId: string;
    workspacePath: string;
    plan: PlannerOutput;
    version?: number;
}): Promise<{
    jsonPath: string;
    mdPath: string;
    version: number;
}>;
export declare function getCurrentPlannerVersion(workspacePath: string): number;
export declare function getNextPlannerVersion(workspacePath: string): number;
//# sourceMappingURL=planner-context.d.ts.map