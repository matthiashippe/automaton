/**
 * Sandbox Cleanup
 *
 * Cleans up sandbox resources for stopped/failed children.
 * Transitions children to cleaned_up state after destruction.
 */
import { createLogger } from "../observability/logger.js";
const logger = createLogger("replication.cleanup");
export class SandboxCleanup {
    conway;
    lifecycle;
    db;
    constructor(conway, lifecycle, db) {
        this.conway = conway;
        this.lifecycle = lifecycle;
        this.db = db;
    }
    /**
     * Clean up a single child's sandbox.
     * Only works for children in stopped or failed state.
     */
    async cleanup(childId) {
        const state = this.lifecycle.getCurrentState(childId);
        if (state !== "stopped" && state !== "failed") {
            throw new Error(`Cannot clean up child in state: ${state}`);
        }
        // Look up sandbox ID
        const childRow = this.db
            .prepare("SELECT sandbox_id FROM children WHERE id = ?")
            .get(childId);
        // Sandbox deletion is disabled by the Conway API (prepaid, non-refundable).
        // Transition to cleaned_up so the child slot is freed for reuse.
        const sandboxNote = childRow?.sandbox_id
            ? `sandbox ${childRow.sandbox_id} released (deletion disabled)`
            : "no sandbox to clean up";
        this.lifecycle.transition(childId, "cleaned_up", sandboxNote);
    }
    /**
     * Clean up all stopped and failed children.
     */
    async cleanupAll() {
        const stopped = this.lifecycle.getChildrenInState("stopped");
        const failed = this.lifecycle.getChildrenInState("failed");
        let cleaned = 0;
        for (const child of [...stopped, ...failed]) {
            try {
                await this.cleanup(child.id);
                cleaned++;
            }
            catch (error) {
                logger.error(`Failed to clean up child ${child.id}`, error instanceof Error ? error : undefined);
            }
        }
        return cleaned;
    }
    /**
     * Clean up children that have been in stopped/failed state for too long.
     */
    async cleanupStale(maxAgeHours) {
        const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
        const stale = this.db.prepare("SELECT id FROM children WHERE status IN ('failed', 'stopped') AND last_checked < ?").all(cutoff);
        let cleaned = 0;
        for (const child of stale) {
            try {
                await this.cleanup(child.id);
                cleaned++;
            }
            catch (error) {
                logger.error(`Failed to clean up stale child ${child.id}`, error instanceof Error ? error : undefined);
            }
        }
        return cleaned;
    }
}
//# sourceMappingURL=cleanup.js.map