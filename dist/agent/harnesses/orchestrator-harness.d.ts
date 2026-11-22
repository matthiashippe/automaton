import type { TaskNode } from "../../orchestration/task-graph.js";
import { BaseHarness } from "./base-harness.js";
import type { HarnessTool } from "../harness-types.js";
export declare class OrchestratorHarness extends BaseHarness {
    readonly id = "orchestrator";
    readonly description = "Orchestrator agent for task decomposition, delegation, verification, and fix coordination.";
    private delegatedTaskIds;
    private currentPlan;
    private planVersion;
    private plannerMode;
    private plannerError;
    private planTaskIdByIndex;
    initialize(task: TaskNode, context: Parameters<BaseHarness["initialize"]>[1]): Promise<void>;
    buildSystemPrompt(): string;
    buildTaskPrompt(): string;
    getToolDefs(): HarnessTool[];
    private refreshPlanInternal;
    private shouldRefreshPlanOnInitialize;
    private refreshDelegatedTaskState;
    private getManagedTasks;
    private getFixCycleCount;
    private getPlanWorkspacePath;
    private findManagedTaskBySignature;
    private resolvePlannedDependencies;
    private trackDelegatedTask;
}
//# sourceMappingURL=orchestrator-harness.d.ts.map