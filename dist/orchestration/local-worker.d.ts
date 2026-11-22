/**
 * Local Agent Worker
 *
 * Runs inference-driven task execution in-process as an async background task.
 * Each worker executes through a harness chosen by role via HarnessRegistry.
 */
import type { WorkerInferenceClient } from "../agent/harness-types.js";
import { HarnessRegistry } from "../agent/harness-registry.js";
import type { TaskNode } from "./task-graph.js";
import type { AutomatonConfig, AutomatonIdentity, AutomatonTool, ConwayClient, InputSource, SpendTrackerInterface, ToolContext } from "../types.js";
import type { Database } from "better-sqlite3";
import type { PolicyEngine } from "../agent/policy-engine.js";
interface LocalWorkerConfig {
    db: Database;
    inference: WorkerInferenceClient;
    conway: ConwayClient;
    maxTurns?: number;
    harnessRegistry: HarnessRegistry;
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    allowedEditRoot?: string;
    tools?: AutomatonTool[];
    toolContext?: ToolContext;
    policyEngine?: PolicyEngine;
    spendTracker?: SpendTrackerInterface;
    inputSource?: InputSource;
}
export declare class LocalWorkerPool {
    private readonly config;
    private activeWorkers;
    constructor(config: LocalWorkerConfig);
    spawn(task: TaskNode): {
        address: string;
        name: string;
        sandboxId: string;
    };
    getActiveCount(): number;
    hasWorker(addressOrId: string): boolean;
    shutdown(): Promise<void>;
    private runWorker;
}
export {};
//# sourceMappingURL=local-worker.d.ts.map