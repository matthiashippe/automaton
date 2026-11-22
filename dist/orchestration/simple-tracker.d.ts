import type { AutomatonDatabase, AutomatonIdentity, ConwayClient } from "../types.js";
import type { AgentTracker, FundingProtocol } from "./types.js";
export declare class SimpleAgentTracker implements AgentTracker {
    private readonly db;
    constructor(db: AutomatonDatabase);
    getIdle(): {
        address: string;
        name: string;
        role: string;
        status: string;
    }[];
    getBestForTask(_role: string): {
        address: string;
        name: string;
    } | null;
    updateStatus(address: string, status: string): void;
    register(agent: {
        address: string;
        name: string;
        role: string;
        sandboxId: string;
    }): void;
}
export declare class SimpleFundingProtocol implements FundingProtocol {
    private readonly conway;
    private readonly identity;
    private readonly db;
    constructor(conway: ConwayClient, identity: AutomatonIdentity, db: AutomatonDatabase);
    fundChild(childAddress: string, amountCents: number): Promise<{
        success: boolean;
    }>;
    recallCredits(childAddress: string): Promise<{
        success: boolean;
        amountCents: number;
    }>;
    getBalance(childAddress: string): Promise<number>;
}
//# sourceMappingURL=simple-tracker.d.ts.map