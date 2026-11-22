import { ulid } from "ulid";
const IDLE_STATUSES = new Set(["running", "healthy"]);
export class SimpleAgentTracker {
    db;
    constructor(db) {
        this.db = db;
    }
    getIdle() {
        const assignedRows = this.db.raw.prepare(`SELECT DISTINCT assigned_to AS address
       FROM task_graph
       WHERE assigned_to IS NOT NULL
         AND status IN ('assigned', 'running')`).all();
        const assignedAddresses = new Set(assignedRows
            .map((row) => row.address)
            .filter((value) => typeof value === "string" && value.length > 0));
        const children = this.db.raw.prepare(`SELECT id, name, address, status, COALESCE(role, 'generalist') AS role
       FROM children
       WHERE status IN ('running', 'healthy')`).all();
        return children
            .filter((child) => IDLE_STATUSES.has(child.status) && !assignedAddresses.has(child.address))
            .map((child) => ({
            address: child.address,
            name: child.name,
            role: child.role,
            status: child.status,
        }));
    }
    getBestForTask(_role) {
        const idle = this.getIdle();
        if (idle.length === 0) {
            return null;
        }
        return {
            address: idle[0].address,
            name: idle[0].name,
        };
    }
    updateStatus(address, status) {
        const child = this.db.getChildren().find((entry) => entry.address === address);
        if (!child) {
            return;
        }
        this.db.updateChildStatus(child.id, status);
    }
    register(agent) {
        this.db.insertChild({
            id: ulid(),
            name: agent.name,
            address: agent.address,
            sandboxId: agent.sandboxId,
            genesisPrompt: `Role: ${agent.role}`,
            creatorMessage: "registered by orchestrator",
            fundedAmountCents: 0,
            status: "running",
            createdAt: new Date().toISOString(),
        });
    }
}
export class SimpleFundingProtocol {
    conway;
    identity;
    db;
    constructor(conway, identity, db) {
        this.conway = conway;
        this.identity = identity;
        this.db = db;
    }
    async fundChild(childAddress, amountCents) {
        const transferAmount = Math.max(0, Math.floor(amountCents));
        if (transferAmount === 0) {
            return { success: true };
        }
        try {
            const result = await this.conway.transferCredits(childAddress, transferAmount, "Task funding from orchestrator");
            const success = isTransferSuccessful(result.status);
            if (success) {
                this.db.raw.prepare("UPDATE children SET funded_amount_cents = funded_amount_cents + ? WHERE address = ?").run(transferAmount, childAddress);
            }
            return { success };
        }
        catch {
            return { success: false };
        }
    }
    async recallCredits(childAddress) {
        const balance = await this.getBalance(childAddress);
        const amountCents = Math.max(0, Math.floor(balance));
        if (amountCents === 0) {
            return { success: true, amountCents: 0 };
        }
        try {
            const result = await this.conway.transferCredits(this.identity.address, amountCents, `Recall credits from ${childAddress}`);
            const success = isTransferSuccessful(result.status);
            const recalled = result.amountCents ?? amountCents;
            if (success) {
                this.db.raw.prepare("UPDATE children SET funded_amount_cents = MAX(0, funded_amount_cents - ?) WHERE address = ?").run(recalled, childAddress);
            }
            return { success, amountCents: recalled };
        }
        catch {
            return { success: false, amountCents: 0 };
        }
    }
    // TODO: The Conway API only exposes getCreditsBalance() for the calling agent's own
    // balance. There is no API to query a child agent's balance remotely. This method
    // returns the locally tracked funded_amount_cents as an upper-bound estimate.
    // This is an approximation — the child may have spent credits on inference since
    // funding. When the Conway API adds per-agent balance queries, replace this with
    // a direct API call. Alternatively, child agents could report their balance via
    // messaging (status_report with credit_balance field).
    async getBalance(childAddress) {
        const row = this.db.raw
            .prepare("SELECT funded_amount_cents FROM children WHERE address = ?")
            .get(childAddress);
        return row?.funded_amount_cents ?? 0;
    }
}
function isTransferSuccessful(status) {
    const normalized = status.trim().toLowerCase();
    return normalized.length > 0
        && !normalized.includes("fail")
        && !normalized.includes("error")
        && !normalized.includes("reject");
}
//# sourceMappingURL=simple-tracker.js.map