/**
 * Colony Messaging
 *
 * Typed inter-agent messaging with pluggable transport.
 * Uses local SQLite message queues by default (no external relay required).
 * Transport can be swapped to social relay when backend becomes available.
 */
import type { AutomatonDatabase } from "../types.js";
declare const MESSAGE_TYPES: readonly ["task_assignment", "task_result", "status_report", "resource_request", "knowledge_share", "customer_request", "alert", "shutdown_request", "peer_query", "peer_response"];
export type MessageType = (typeof MESSAGE_TYPES)[number];
export interface AgentMessage {
    id: string;
    type: MessageType;
    from: string;
    to: string;
    goalId: string | null;
    taskId: string | null;
    content: string;
    priority: "low" | "normal" | "high" | "critical";
    requiresResponse: boolean;
    expiresAt: string | null;
    createdAt: string;
}
export interface ProcessedMessage {
    message: AgentMessage;
    handledBy: string;
    success: boolean;
    error?: string;
}
/**
 * Pluggable message transport. Implementations handle the actual
 * delivery mechanism. The default LocalDBTransport writes directly
 * to SQLite inbox tables.
 */
export interface MessageTransport {
    /** Deliver a message to the recipient. */
    deliver(to: string, envelope: string): Promise<void>;
    /** List known recipient addresses (for broadcast). */
    getRecipients(): string[];
}
/**
 * Local SQLite-based transport.
 * Writes messages directly to the inbox_messages table in the local DB.
 * Works for parent↔child communication on the same machine.
 * No external relay server required.
 */
export declare class LocalDBTransport implements MessageTransport {
    private readonly db;
    constructor(db: AutomatonDatabase);
    deliver(to: string, envelope: string): Promise<void>;
    getRecipients(): string[];
}
export declare class ColonyMessaging {
    private readonly transport;
    private readonly db;
    constructor(transport: MessageTransport, db: AutomatonDatabase);
    send(message: AgentMessage): Promise<void>;
    processInbox(): Promise<ProcessedMessage[]>;
    broadcast(content: string, priority: "high" | "critical"): Promise<void>;
    /** Create a pre-filled message for sending. */
    createMessage(params: {
        type: MessageType;
        to: string;
        content: string;
        goalId?: string;
        taskId?: string;
        priority?: AgentMessage["priority"];
        requiresResponse?: boolean;
        expiresAt?: string;
    }): AgentMessage;
    private routeMessage;
    private handleTaskAssignment;
    private handleTaskResult;
    private handleStatusReport;
    private handleResourceRequest;
    private handleKnowledgeShare;
    private handleCustomerRequest;
    private handleAlert;
    private handleShutdownRequest;
    private handlePeerQuery;
    private handlePeerResponse;
    private logActionEvent;
}
export {};
//# sourceMappingURL=messaging.d.ts.map