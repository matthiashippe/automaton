import fs from "node:fs";
import path from "node:path";
import { normalizeTaskResult } from "../orchestration/task-graph.js";
import { getTasksByGoal } from "../state/database.js";
export function createBudgetFromTask(task) {
    return {
        maxTurns: 25,
        maxCostCents: Math.max(task.metadata.estimatedCostCents * 2, 50),
        timeoutMs: task.metadata.timeoutMs || 300_000,
        turnsUsed: 0,
        costUsedCents: 0,
        startedAt: 0,
    };
}
export function emptyWisdom() {
    return { conventions: [], successes: [], failures: [], gotchas: [] };
}
export function buildWisdomFromGoal(db, goalId, workspace) {
    const wisdom = emptyWisdom();
    const tasks = getTasksByGoal(db, goalId);
    for (const task of tasks) {
        const result = normalizeTaskResult(task.result);
        if (!result?.output) {
            continue;
        }
        const summary = result.output.slice(0, 200);
        if (task.status === "completed") {
            wisdom.successes.push(summary);
        }
        else if (task.status === "failed") {
            wisdom.failures.push(summary);
        }
    }
    try {
        const decisionsPath = path.join(workspace.basePath, "context", "decisions.md");
        if (!fs.existsSync(decisionsPath)) {
            return wisdom;
        }
        const content = fs.readFileSync(decisionsPath, "utf8");
        const entries = content.split(/^### /m).filter(Boolean);
        for (const entry of entries.slice(-10)) {
            const normalized = entry.trim().slice(0, 200);
            const lower = normalized.toLowerCase();
            if (lower.includes("convention") || lower.includes("standard")) {
                wisdom.conventions.push(normalized);
            }
            else if (lower.includes("gotcha") || lower.includes("warning")) {
                wisdom.gotchas.push(normalized);
            }
        }
    }
    catch {
        // decisions.md may not exist yet; ignore.
    }
    return wisdom;
}
//# sourceMappingURL=harness-types.js.map