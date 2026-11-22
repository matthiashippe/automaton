import type { Database } from "better-sqlite3";
import type { AutomatonIdentity } from "../types.js";
import { type TaskNode, type TaskResult } from "./task-graph.js";
import { ColonyMessaging } from "./messaging.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";
import type { AgentAssignment, AgentTracker, FundingProtocol, OrchestratorTickResult } from "./types.js";
export declare class Orchestrator {
    private readonly params;
    private pendingTaskResults;
    constructor(params: {
        db: Database;
        agentTracker: AgentTracker;
        funding: FundingProtocol;
        messaging: ColonyMessaging;
        inference: UnifiedInferenceClient;
        identity: AutomatonIdentity;
        config: any;
        /** Check if a worker agent is still alive. Used to recover stale tasks. */
        isWorkerAlive?: (address: string) => boolean;
    });
    tick(): Promise<OrchestratorTickResult>;
    matchTaskToAgent(task: TaskNode): Promise<AgentAssignment>;
    fundAgentForTask(addr: string, task: TaskNode): Promise<void>;
    collectResults(): Promise<TaskResult[]>;
    handleFailure(task: TaskNode, error: string): Promise<void>;
    private handleIdlePhase;
    private handleClassifyingPhase;
    private handlePlanningPhase;
    private handlePlanReviewPhase;
    private handleExecutingPhase;
    private handleReplanningPhase;
    private handleCompletePhase;
    private handleFailedPhase;
    private classifyComplexity;
    private findBusyAgentForReassign;
    private trySpawnAgent;
    private recallAgentCredits;
    private persistTodo;
    private persistPlannerOutput;
    private loadState;
    private saveState;
    private findFirstFailedTaskId;
    private getActiveAgentCount;
    private getMaxReplans;
}
//# sourceMappingURL=orchestrator.d.ts.map