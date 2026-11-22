/**
 * Append-only event stream for agent memory.
 */
import { ulid } from "ulid";
import { getEventsByGoal, getEventsByType, getRecentEvents, } from "../state/database.js";
export function estimateTokens(text) {
    return Math.ceil((text ?? "").length / 3.5);
}
export class EventStream {
    db;
    constructor(db) {
        this.db = db;
    }
    append(event) {
        const id = ulid();
        const createdAt = new Date().toISOString();
        const tokenCount = event.tokenCount === 0
            ? estimateTokens(event.content)
            : event.tokenCount;
        this.db.prepare(`INSERT INTO event_stream (id, type, agent_address, goal_id, task_id, content, token_count, compacted_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, event.type, event.agentAddress, event.goalId, event.taskId, event.content, tokenCount, event.compactedTo, createdAt);
        return id;
    }
    getRecent(agentAddress, limit = 50) {
        return getRecentEvents(this.db, agentAddress, limit).map(toStreamEvent);
    }
    getByGoal(goalId) {
        return getEventsByGoal(this.db, goalId).map(toStreamEvent);
    }
    getByType(type, since) {
        return getEventsByType(this.db, type, since).map(toStreamEvent);
    }
    compact(olderThan, strategy) {
        const rows = this.db.prepare(`SELECT id, type, content, token_count as tokenCount, created_at as createdAt
       FROM event_stream
       WHERE created_at < ? AND compacted_to IS NULL
       ORDER BY created_at ASC`).all(olderThan);
        if (rows.length === 0) {
            return {
                compactedCount: 0,
                tokensSaved: 0,
                strategy,
            };
        }
        const updateStatement = this.db.prepare("UPDATE event_stream SET compacted_to = ? WHERE id = ?");
        let compactedCount = 0;
        let tokensSaved = 0;
        for (const row of rows) {
            const compactedTo = strategy === "reference"
                ? buildReference(row)
                : buildSummary(row);
            updateStatement.run(compactedTo, row.id);
            compactedCount += 1;
            tokensSaved += Math.max(0, row.tokenCount - estimateTokens(compactedTo));
        }
        return {
            compactedCount,
            tokensSaved,
            strategy,
        };
    }
    getTokenCount(agentAddress, since) {
        if (since) {
            const row = this.db.prepare(`SELECT COALESCE(SUM(token_count), 0) as total
         FROM event_stream
         WHERE agent_address = ? AND created_at >= ?`).get(agentAddress, since);
            return row.total ?? 0;
        }
        const row = this.db.prepare(`SELECT COALESCE(SUM(token_count), 0) as total
       FROM event_stream
       WHERE agent_address = ?`).get(agentAddress);
        return row.total ?? 0;
    }
    prune(olderThan) {
        const result = this.db.prepare("DELETE FROM event_stream WHERE created_at < ?").run(olderThan);
        return result.changes;
    }
}
function toStreamEvent(row) {
    return {
        id: row.id,
        type: row.type,
        agentAddress: row.agentAddress,
        goalId: row.goalId,
        taskId: row.taskId,
        content: row.content,
        tokenCount: row.tokenCount,
        compactedTo: row.compactedTo,
        createdAt: row.createdAt,
    };
}
function buildReference(row) {
    return `ref:${row.id.slice(0, 10)}:${row.type}:${row.createdAt}`;
}
function buildSummary(row) {
    const normalized = row.content.replace(/\s+/g, " ").trim();
    const snippet = normalized.length > 96
        ? `${normalized.slice(0, 96)}...`
        : normalized;
    return `summary:${row.type}:${snippet}`;
}
//# sourceMappingURL=event-stream.js.map