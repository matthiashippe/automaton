import { createLogger } from "../observability/logger.js";
const logger = createLogger("orchestration.health-monitor");
const HEARTBEAT_STALE_MS = 15 * 60 * 1000;
const PROCESS_CRASH_MS = 45 * 60 * 1000;
const MIN_INFERENCE_CREDITS_CENTS = 10;
const FUND_TOPUP_TARGET_CENTS = 250;
const FUND_MIN_TRANSFER_CENTS = 50;
const ERROR_RATE_WINDOW_MS = 6 * 60 * 60 * 1000;
const ERROR_LOOP_THRESHOLD = 0.6;
const ERROR_LOOP_MIN_SAMPLES = 3;
const TASK_STUCK_GRACE_MS = 2 * 60 * 1000;
const DEAD_STATUSES = new Set([
    "dead",
    "failed",
    "stopped",
    "cleaned_up",
]);
const CRASHED_STATUSES = new Set([
    "dead",
    "failed",
    "stopped",
    "unknown",
    "unhealthy",
]);
export class HealthMonitor {
    db;
    agentTracker;
    funding;
    messaging;
    constructor(db, agentTracker, funding, messaging) {
        this.db = db;
        this.agentTracker = agentTracker;
        this.funding = funding;
        this.messaging = messaging;
    }
    async checkAll() {
        const nowIso = new Date().toISOString();
        const children = this.db.getChildren();
        const agents = await Promise.all(children.map(async (child) => this.checkChildHealth(child, nowIso)));
        const unhealthyAgents = agents.filter((agent) => !agent.healthy).length;
        const deadAgents = agents.filter((agent) => isDeadStatus(agent.status)).length;
        return {
            timestamp: nowIso,
            totalAgents: agents.length,
            healthyAgents: agents.length - unhealthyAgents,
            unhealthyAgents,
            deadAgents,
            agents,
        };
    }
    async autoHeal(report) {
        const actions = [];
        for (const agent of report.agents) {
            if (agent.healthy) {
                continue;
            }
            const issueSet = new Set(agent.issues);
            if (issueSet.has("error_loop")) {
                actions.push(await this.stopAgent(agent, "error loop detected"));
                continue;
            }
            if (issueSet.has("out_of_credits")) {
                actions.push(await this.fundAgent(agent));
            }
            if (issueSet.has("process_crashed")) {
                actions.push(await this.restartAgent(agent));
            }
            if (issueSet.has("stuck_on_task") && agent.currentTaskId) {
                actions.push(await this.reassignTask(agent, agent.currentTaskId));
            }
        }
        return actions;
    }
    async checkChildHealth(child, nowIso) {
        const nowMs = Date.parse(nowIso);
        const currentTask = this.getActiveTask(child.address);
        const lastHeartbeat = this.resolveLastHeartbeat(child);
        const creditBalance = await this.getCreditBalance(child.address);
        const errorStats = this.getErrorStats(child.address);
        const issues = new Set();
        if (CRASHED_STATUSES.has(child.status)) {
            issues.add("process_crashed");
        }
        if (!lastHeartbeat) {
            issues.add("heartbeat_missing");
        }
        else {
            const lastHeartbeatMs = Date.parse(lastHeartbeat);
            if (!Number.isNaN(lastHeartbeatMs)) {
                const ageMs = Math.max(0, nowMs - lastHeartbeatMs);
                if (ageMs >= PROCESS_CRASH_MS) {
                    issues.add("process_crashed");
                }
                else if (ageMs >= HEARTBEAT_STALE_MS && currentTask) {
                    issues.add("stuck_on_task");
                }
            }
        }
        if (currentTask && this.isTaskStuck(currentTask, nowMs)) {
            issues.add("stuck_on_task");
        }
        if (creditBalance !== null && creditBalance < MIN_INFERENCE_CREDITS_CENTS) {
            issues.add("out_of_credits");
        }
        if (errorStats.total >= ERROR_LOOP_MIN_SAMPLES
            && errorStats.errorRate >= ERROR_LOOP_THRESHOLD) {
            issues.add("error_loop");
        }
        return {
            address: child.address,
            name: child.name,
            status: child.status,
            healthy: issues.size === 0,
            lastHeartbeat,
            currentTaskId: currentTask?.id ?? null,
            creditBalance,
            errorRate: errorStats.errorRate,
            issues: [...issues],
        };
    }
    resolveLastHeartbeat(child) {
        const eventRow = this.db.raw
            .prepare(`SELECT MAX(created_at) AS ts
         FROM event_stream
         WHERE agent_address = ?`)
            .get(child.address);
        const inboxRow = this.db.raw
            .prepare(`SELECT MAX(received_at) AS ts
         FROM inbox_messages
         WHERE from_address = ?`)
            .get(child.address);
        return latestIso([
            child.lastChecked ?? null,
            eventRow?.ts ?? null,
            inboxRow?.ts ?? null,
        ]);
    }
    getActiveTask(address) {
        const row = this.db.raw
            .prepare(`SELECT
           id,
           status,
           started_at AS startedAt,
           created_at AS createdAt,
           timeout_ms AS timeoutMs,
           retry_count AS retryCount,
           max_retries AS maxRetries
         FROM task_graph
         WHERE assigned_to = ?
           AND status IN ('assigned', 'running')
         ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, created_at ASC
         LIMIT 1`)
            .get(address);
        return row ?? null;
    }
    getErrorStats(address) {
        const windowStart = new Date(Date.now() - ERROR_RATE_WINDOW_MS).toISOString();
        const recentRows = this.db.raw
            .prepare(`SELECT status, COUNT(*) AS count
         FROM task_graph
         WHERE assigned_to = ?
           AND status IN ('completed', 'failed')
           AND COALESCE(completed_at, created_at) >= ?
         GROUP BY status`)
            .all(address, windowStart);
        let completed = 0;
        let failed = 0;
        for (const row of recentRows) {
            if (row.status === "completed")
                completed = row.count;
            if (row.status === "failed")
                failed = row.count;
        }
        let total = completed + failed;
        if (total === 0) {
            const fallbackRows = this.db.raw
                .prepare(`SELECT status
           FROM task_graph
           WHERE assigned_to = ?
             AND status IN ('completed', 'failed')
           ORDER BY COALESCE(completed_at, created_at) DESC
           LIMIT 25`)
                .all(address);
            total = fallbackRows.length;
            failed = fallbackRows.filter((row) => row.status === "failed").length;
        }
        return {
            total,
            failed,
            errorRate: total > 0 ? failed / total : 0,
        };
    }
    isTaskStuck(task, nowMs) {
        if (task.status === "running") {
            const startedMs = Date.parse(task.startedAt ?? task.createdAt);
            if (Number.isNaN(startedMs)) {
                return false;
            }
            const timeoutMs = Math.max(task.timeoutMs || 0, HEARTBEAT_STALE_MS);
            return nowMs - startedMs >= timeoutMs + TASK_STUCK_GRACE_MS;
        }
        const createdMs = Date.parse(task.createdAt);
        if (Number.isNaN(createdMs)) {
            return false;
        }
        return nowMs - createdMs >= HEARTBEAT_STALE_MS;
    }
    async getCreditBalance(address) {
        try {
            const balance = await this.funding.getBalance(address);
            if (!Number.isFinite(balance)) {
                return null;
            }
            return Math.max(0, Math.floor(balance));
        }
        catch (error) {
            logger.warn("Failed to read child balance", {
                address,
                error: normalizeError(error).message,
            });
            return null;
        }
    }
    async fundAgent(agent) {
        const currentBalance = agent.creditBalance ?? 0;
        const amountCents = Math.max(FUND_MIN_TRANSFER_CENTS, FUND_TOPUP_TARGET_CENTS - currentBalance);
        try {
            const result = await this.funding.fundChild(agent.address, amountCents);
            return {
                type: "fund",
                agentAddress: agent.address,
                reason: `credit balance ${currentBalance}c below ${MIN_INFERENCE_CREDITS_CENTS}c`,
                success: result.success,
            };
        }
        catch (error) {
            logger.warn("Auto-funding failed", {
                address: agent.address,
                error: normalizeError(error).message,
            });
            return {
                type: "fund",
                agentAddress: agent.address,
                reason: `credit balance ${currentBalance}c below threshold`,
                success: false,
            };
        }
    }
    async restartAgent(agent) {
        const reason = "process appears crashed or non-responsive";
        const success = await this.sendShutdownRequest(agent.address, reason);
        if (success) {
            this.agentTracker.updateStatus(agent.address, "starting");
        }
        return {
            type: "restart",
            agentAddress: agent.address,
            reason,
            success,
        };
    }
    async reassignTask(agent, taskId) {
        const task = this.db.raw
            .prepare(`SELECT retry_count AS retryCount, max_retries AS maxRetries
         FROM task_graph
         WHERE id = ?`)
            .get(taskId);
        if (!task) {
            return {
                type: "reassign",
                agentAddress: agent.address,
                reason: `task ${taskId} not found`,
                success: false,
            };
        }
        const nextRetry = task.retryCount + 1;
        const replacement = this.selectReplacementAgent(agent.address);
        const status = replacement ? "assigned" : "pending";
        const reason = replacement
            ? `task ${taskId} reassigned to ${replacement.address}`
            : `task ${taskId} reset to pending (no replacement available)`;
        const resultPayload = {
            type: "stuck_task_cancelled",
            cancelledBy: "health_monitor",
            sourceAgent: agent.address,
            replacementAgent: replacement?.address ?? null,
            at: new Date().toISOString(),
            reason: "stuck execution detected",
        };
        const shouldFail = nextRetry > task.maxRetries;
        if (shouldFail) {
            this.db.raw.prepare(`UPDATE task_graph
         SET status = 'failed',
             completed_at = ?,
             result = ?
         WHERE id = ?`).run(new Date().toISOString(), JSON.stringify({ ...resultPayload, reason: "max retries exceeded during reassignment" }), taskId);
            return {
                type: "reassign",
                agentAddress: agent.address,
                reason: `task ${taskId} exceeded max retries`,
                success: false,
            };
        }
        this.db.raw.prepare(`UPDATE task_graph
       SET status = ?,
           assigned_to = ?,
           started_at = NULL,
           completed_at = NULL,
           retry_count = ?,
           result = ?
       WHERE id = ?`).run(status, replacement?.address ?? null, nextRetry, JSON.stringify(resultPayload), taskId);
        return {
            type: "reassign",
            agentAddress: agent.address,
            reason,
            success: true,
        };
    }
    async stopAgent(agent, reason) {
        const success = await this.sendShutdownRequest(agent.address, reason);
        this.agentTracker.updateStatus(agent.address, "stopped");
        return {
            type: "stop",
            agentAddress: agent.address,
            reason,
            success,
        };
    }
    async sendShutdownRequest(address, reason) {
        try {
            const message = this.messaging.createMessage({
                type: "shutdown_request",
                to: address,
                content: `[health-monitor] ${reason}`,
                priority: "high",
            });
            await this.messaging.send(message);
            return true;
        }
        catch (error) {
            logger.warn("Failed to send shutdown request", {
                address,
                error: normalizeError(error).message,
            });
            return false;
        }
    }
    selectReplacementAgent(sourceAddress) {
        const idle = this.agentTracker.getIdle().find((agent) => agent.address !== sourceAddress);
        if (idle) {
            return {
                address: idle.address,
                name: idle.name,
            };
        }
        const best = this.agentTracker.getBestForTask("generalist");
        if (!best || best.address === sourceAddress) {
            return null;
        }
        return best;
    }
}
function latestIso(candidates) {
    let latest = null;
    for (const value of candidates) {
        if (!value) {
            continue;
        }
        const ms = Date.parse(value);
        if (Number.isNaN(ms)) {
            continue;
        }
        if (!latest || ms > latest.ms) {
            latest = {
                ms,
                iso: new Date(ms).toISOString(),
            };
        }
    }
    return latest?.iso ?? null;
}
function isDeadStatus(status) {
    return DEAD_STATUSES.has(status);
}
function normalizeError(error) {
    if (error instanceof Error)
        return error;
    return new Error(String(error));
}
//# sourceMappingURL=health-monitor.js.map