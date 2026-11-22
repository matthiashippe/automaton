/**
 * Local Agent Worker
 *
 * Runs inference-driven task execution in-process as an async background task.
 * Each worker executes through a harness chosen by role via HarnessRegistry.
 */
import path from "node:path";
import { ulid } from "ulid";
import { createLogger } from "../observability/logger.js";
import { buildWisdomFromGoal, createBudgetFromTask } from "../agent/harness-types.js";
import { completeTask, failTask } from "./task-graph.js";
import { AgentWorkspace } from "./workspace.js";
const logger = createLogger("orchestration.local-worker");
const DEFAULT_ALLOWED_EDIT_ROOT = process.cwd();
export class LocalWorkerPool {
    config;
    activeWorkers = new Map();
    constructor(config) {
        this.config = config;
    }
    spawn(task) {
        const workerId = `local-worker-${ulid()}`;
        const workerName = `worker-${task.agentRole ?? "generalist"}-${workerId.slice(-6)}`;
        const address = `local://${workerId}`;
        const abortController = new AbortController();
        const workerPromise = this.runWorker(workerId, task, abortController.signal)
            .catch((error) => {
            logger.error("Local worker crashed", error instanceof Error ? error : new Error(String(error)), {
                workerId,
                taskId: task.id,
            });
            try {
                failTask(this.config.db, task.id, `Worker crashed: ${error instanceof Error ? error.message : String(error)}`, true);
            }
            catch {
                // Task may already be in a terminal state.
            }
        })
            .finally(() => {
            this.activeWorkers.delete(workerId);
        });
        this.activeWorkers.set(workerId, { promise: workerPromise, abortController });
        return { address, name: workerName, sandboxId: workerId };
    }
    getActiveCount() {
        return this.activeWorkers.size;
    }
    hasWorker(addressOrId) {
        const id = addressOrId.replace("local://", "");
        return this.activeWorkers.has(id);
    }
    async shutdown() {
        for (const [, worker] of this.activeWorkers) {
            worker.abortController.abort();
        }
        await Promise.allSettled([...this.activeWorkers.values()].map((worker) => worker.promise));
        this.activeWorkers.clear();
    }
    async runWorker(workerId, task, signal) {
        const harness = this.config.harnessRegistry.createForRole(task.agentRole);
        const workspace = new AgentWorkspace(task.goalId);
        const allowedEditRoot = path.resolve(this.config.allowedEditRoot ?? DEFAULT_ALLOWED_EDIT_ROOT);
        const workerIdentity = createWorkerIdentity(this.config.identity, workerId, task.agentRole);
        const context = {
            workspaceRoot: workspace.basePath,
            allowedEditRoot,
            workspace,
            identity: workerIdentity,
            config: this.config.config,
            db: this.config.db,
            conway: this.config.conway,
            inference: {
                chat: async (params) => this.config.inference.chat(params),
            },
            budget: createBudgetFromTask(task),
            wisdom: buildWisdomFromGoal(this.config.db, task.goalId, workspace),
            abortSignal: signal,
            goalId: task.goalId,
            toolCatalog: this.config.tools,
            toolContext: this.config.toolContext
                ? {
                    ...this.config.toolContext,
                    identity: workerIdentity,
                }
                : undefined,
            policyEngine: this.config.policyEngine,
            spendTracker: this.config.spendTracker,
            inputSource: this.config.inputSource,
        };
        if (this.config.maxTurns) {
            context.budget.maxTurns = this.config.maxTurns;
        }
        if (harness.id === "orchestrator" && !this.config.maxTurns) {
            context.budget.maxTurns = Math.max(context.budget.maxTurns, 50);
        }
        logger.info(`[WORKER ${workerId}] Starting task "${task.title}" (${task.id}), role: ${task.agentRole ?? "generalist"}, harness: ${harness.id}`);
        try {
            await harness.initialize(task, context);
            const result = await harness.execute();
            if (result.success) {
                completeTask(this.config.db, task.id, result);
                logger.info("Local worker completed task", {
                    workerId,
                    taskId: task.id,
                    title: task.title,
                    duration: result.duration,
                    harness: harness.id,
                });
            }
            else {
                failTask(this.config.db, task.id, result.output || "Task reported failure", true);
                logger.warn("Local worker reported task failure", {
                    workerId,
                    taskId: task.id,
                    title: task.title,
                    harness: harness.id,
                    output: result.output.slice(0, 200),
                });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`[WORKER ${workerId}] Harness execution failed: ${message}`);
            failTask(this.config.db, task.id, message, true);
        }
    }
}
function createWorkerIdentity(parentIdentity, workerId, role) {
    return {
        ...parentIdentity,
        name: `worker-${role ?? "generalist"}-${workerId.slice(-6)}`,
        address: `local://${workerId}`,
        sandboxId: workerId,
    };
}
//# sourceMappingURL=local-worker.js.map