import type { AutomatonDatabase } from "../types.js";
import type { ColonyMessaging } from "./messaging.js";
import type { AgentTracker, FundingProtocol } from "./types.js";
export interface AgentHealthStatus {
    address: string;
    name: string;
    status: string;
    healthy: boolean;
    lastHeartbeat: string | null;
    currentTaskId: string | null;
    creditBalance: number | null;
    errorRate: number;
    issues: string[];
}
export interface HealthReport {
    timestamp: string;
    totalAgents: number;
    healthyAgents: number;
    unhealthyAgents: number;
    deadAgents: number;
    agents: AgentHealthStatus[];
}
export interface HealAction {
    type: "fund" | "restart" | "reassign" | "stop";
    agentAddress: string;
    reason: string;
    success: boolean;
}
export declare class HealthMonitor {
    private readonly db;
    private readonly agentTracker;
    private readonly funding;
    private readonly messaging;
    constructor(db: AutomatonDatabase, agentTracker: AgentTracker, funding: FundingProtocol, messaging: ColonyMessaging);
    checkAll(): Promise<HealthReport>;
    autoHeal(report: HealthReport): Promise<HealAction[]>;
    private checkChildHealth;
    private resolveLastHeartbeat;
    private getActiveTask;
    private getErrorStats;
    private isTaskStuck;
    private getCreditBalance;
    private fundAgent;
    private restartAgent;
    private reassignTask;
    private stopAgent;
    private sendShutdownRequest;
    private selectReplacementAgent;
}
//# sourceMappingURL=health-monitor.d.ts.map