/**
 * Colony Messaging
 *
 * Typed inter-agent messaging with pluggable transport.
 * Uses local SQLite message queues by default (no external relay required).
 * Transport can be swapped to social relay when backend becomes available.
 */
import { insertEvent } from "../state/database.js";
import { createLogger } from "../observability/logger.js";
import { ulid } from "ulid";
const logger = createLogger("orchestration.messaging");
const MAX_INBOX_BATCH = 200;
const SEND_RETRIES = 3;
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
const MESSAGE_TYPES = [
    "task_assignment",
    "task_result",
    "status_report",
    "resource_request",
    "knowledge_share",
    "customer_request",
    "alert",
    "shutdown_request",
    "peer_query",
    "peer_response",
];
const PRIORITY_ORDER = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
};
/**
 * Local SQLite-based transport.
 * Writes messages directly to the inbox_messages table in the local DB.
 * Works for parent↔child communication on the same machine.
 * No external relay server required.
 */
export class LocalDBTransport {
    db;
    constructor(db) {
        this.db = db;
    }
    async deliver(to, envelope) {
        // Write directly to inbox_messages table
        const id = ulid();
        const fromAddress = this.db.getIdentity("address") ?? "unknown";
        this.db.raw.prepare(`INSERT INTO inbox_messages (id, from_address, to_address, content, received_at, status)
       VALUES (?, ?, ?, ?, datetime('now'), 'received')`).run(id, fromAddress, to, envelope);
    }
    getRecipients() {
        const children = this.db.getChildren();
        return children.map((c) => c.address);
    }
}
// ─── Colony Messaging ───────────────────────────────────────────
export class ColonyMessaging {
    transport;
    db;
    constructor(transport, db) {
        this.transport = transport;
        this.db = db;
    }
    async send(message) {
        validateMessage(message);
        const envelope = {
            protocol: "colony_message_v1",
            sentAt: new Date().toISOString(),
            message,
        };
        let lastError;
        for (let attempt = 0; attempt <= SEND_RETRIES; attempt += 1) {
            try {
                await this.transport.deliver(message.to, JSON.stringify(envelope));
                this.logActionEvent("message_sent", message);
                return;
            }
            catch (error) {
                lastError = normalizeError(error);
                const isFinalAttempt = attempt === SEND_RETRIES;
                logger.warn("Message send attempt failed", {
                    messageId: message.id,
                    to: message.to,
                    attempt: attempt + 1,
                    isFinalAttempt,
                    error: lastError.message,
                });
                if (isFinalAttempt)
                    break;
                await sleep(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
            }
        }
        throw new Error(`Failed to send message ${message.id} after ${SEND_RETRIES + 1} attempts: ${lastError?.message ?? "unknown error"}`);
    }
    async processInbox() {
        const inbox = this.db.getUnprocessedInboxMessages(MAX_INBOX_BATCH);
        const pending = [];
        const processed = [];
        for (const row of inbox) {
            try {
                const message = parseInboundMessage(row);
                pending.push({ inboxId: row.id, message });
            }
            catch (error) {
                const err = normalizeError(error);
                const rejected = createRejectedMessage(row);
                this.db.markInboxMessageProcessed(row.id);
                processed.push({
                    message: rejected,
                    handledBy: "rejectMalformedMessage",
                    success: false,
                    error: err.message,
                });
                logger.warn("Rejected malformed inbound message", {
                    inboxId: row.id,
                    from: row.from,
                    error: err.message,
                });
            }
        }
        // Process critical priority first
        pending.sort((a, b) => {
            const priorityDelta = PRIORITY_ORDER[a.message.priority] - PRIORITY_ORDER[b.message.priority];
            if (priorityDelta !== 0)
                return priorityDelta;
            return a.message.createdAt.localeCompare(b.message.createdAt);
        });
        for (const item of pending) {
            let handledBy = "unknown";
            try {
                handledBy = await this.routeMessage(item.message);
                processed.push({
                    message: item.message,
                    handledBy,
                    success: true,
                });
            }
            catch (error) {
                const err = normalizeError(error);
                processed.push({
                    message: item.message,
                    handledBy,
                    success: false,
                    error: err.message,
                });
                logger.error("Failed to handle inbox message", err, {
                    messageId: item.message.id,
                    type: item.message.type,
                    from: item.message.from,
                    to: item.message.to,
                });
            }
            finally {
                this.db.markInboxMessageProcessed(item.inboxId);
            }
        }
        return processed;
    }
    async broadcast(content, priority) {
        const recipients = this.transport.getRecipients();
        if (recipients.length === 0)
            return;
        const fromAddress = this.db.getIdentity("address") ?? "unknown";
        const createdAt = new Date().toISOString();
        await Promise.all(recipients.map((to) => this.send({
            id: ulid(),
            type: "alert",
            from: fromAddress,
            to,
            goalId: null,
            taskId: null,
            content,
            priority,
            requiresResponse: false,
            expiresAt: null,
            createdAt,
        })));
    }
    /** Create a pre-filled message for sending. */
    createMessage(params) {
        const fromAddress = this.db.getIdentity("address") ?? "unknown";
        return {
            id: ulid(),
            type: params.type,
            from: fromAddress,
            to: params.to,
            goalId: params.goalId ?? null,
            taskId: params.taskId ?? null,
            content: params.content,
            priority: params.priority ?? "normal",
            requiresResponse: params.requiresResponse ?? false,
            expiresAt: params.expiresAt ?? null,
            createdAt: new Date().toISOString(),
        };
    }
    async routeMessage(message) {
        switch (message.type) {
            case "task_assignment":
                await this.handleTaskAssignment(message);
                return "handleTaskAssignment";
            case "task_result":
                await this.handleTaskResult(message);
                return "handleTaskResult";
            case "status_report":
                await this.handleStatusReport(message);
                return "handleStatusReport";
            case "resource_request":
                await this.handleResourceRequest(message);
                return "handleResourceRequest";
            case "knowledge_share":
                await this.handleKnowledgeShare(message);
                return "handleKnowledgeShare";
            case "customer_request":
                await this.handleCustomerRequest(message);
                return "handleCustomerRequest";
            case "alert":
                await this.handleAlert(message);
                return "handleAlert";
            case "shutdown_request":
                await this.handleShutdownRequest(message);
                return "handleShutdownRequest";
            case "peer_query":
                await this.handlePeerQuery(message);
                return "handlePeerQuery";
            case "peer_response":
                await this.handlePeerResponse(message);
                return "handlePeerResponse";
            default:
                throw new Error(`unsupported message type: ${message.type}`);
        }
    }
    // ─── Message Handlers (stubs — orchestrator wires real logic) ──
    async handleTaskAssignment(message) {
        this.logActionEvent("task_assignment_received", message);
    }
    async handleTaskResult(message) {
        this.logActionEvent("task_result_received", message);
    }
    async handleStatusReport(message) {
        this.logActionEvent("status_report_received", message);
    }
    async handleResourceRequest(message) {
        this.logActionEvent("resource_request_received", message);
    }
    async handleKnowledgeShare(message) {
        this.logActionEvent("knowledge_share_received", message);
    }
    async handleCustomerRequest(message) {
        this.logActionEvent("customer_request_received", message);
    }
    async handleAlert(message) {
        logger.warn("Alert received", {
            messageId: message.id,
            from: message.from,
            priority: message.priority,
        });
        this.logActionEvent("alert_received", message);
    }
    async handleShutdownRequest(message) {
        logger.warn("Shutdown request received", {
            messageId: message.id,
            from: message.from,
        });
        this.logActionEvent("shutdown_request_received", message);
    }
    async handlePeerQuery(message) {
        this.logActionEvent("peer_query_received", message);
    }
    async handlePeerResponse(message) {
        this.logActionEvent("peer_response_received", message);
    }
    logActionEvent(action, message) {
        try {
            insertEvent(this.db.raw, {
                type: "action",
                agentAddress: message.from,
                goalId: message.goalId,
                taskId: message.taskId,
                content: JSON.stringify({
                    action,
                    messageId: message.id,
                    messageType: message.type,
                    to: message.to,
                    priority: message.priority,
                }),
                tokenCount: Math.ceil(message.content.length / 4),
            });
        }
        catch (error) {
            logger.warn("Failed to write action event for message", {
                messageId: message.id,
                error: normalizeError(error).message,
            });
        }
    }
}
// ─── Helpers ────────────────────────────────────────────────────
function extractAgentMessage(parsed) {
    if (!parsed || typeof parsed !== "object") {
        throw new Error("parsed payload must be an object");
    }
    const maybeEnvelope = parsed;
    if (maybeEnvelope.protocol === "colony_message_v1" && maybeEnvelope.message) {
        return maybeEnvelope.message;
    }
    return parsed;
}
function parseInboundMessage(row) {
    let parsed;
    try {
        parsed = JSON.parse(row.content);
    }
    catch {
        throw new Error("inbox content is not valid JSON");
    }
    const candidate = extractAgentMessage(parsed);
    validateMessage(candidate);
    const msg = candidate;
    if (msg.expiresAt && Date.parse(msg.expiresAt) < Date.now()) {
        throw new Error("message is expired");
    }
    return msg;
}
function validateMessage(message) {
    if (!message || typeof message !== "object") {
        throw new Error("message must be an object");
    }
    const value = message;
    if (typeof value.id !== "string" || value.id.length === 0) {
        throw new Error("message.id is required");
    }
    if (!isMessageType(value.type)) {
        throw new Error(`invalid message.type: ${String(value.type)}`);
    }
    if (typeof value.from !== "string" || value.from.length === 0) {
        throw new Error("message.from is required");
    }
    if (typeof value.to !== "string" || value.to.length === 0) {
        throw new Error("message.to is required");
    }
    if (typeof value.content !== "string") {
        throw new Error("message.content must be string");
    }
    if (!isPriority(value.priority)) {
        throw new Error(`invalid message.priority: ${String(value.priority)}`);
    }
    if (typeof value.requiresResponse !== "boolean") {
        throw new Error("message.requiresResponse must be boolean");
    }
    if (typeof value.createdAt !== "string" || !isIsoDate(value.createdAt)) {
        throw new Error("message.createdAt must be an ISO date string");
    }
}
function createRejectedMessage(row) {
    return {
        id: ulid(),
        type: "alert",
        from: row.from,
        to: row.to,
        goalId: null,
        taskId: null,
        content: row.content,
        priority: "high",
        requiresResponse: false,
        expiresAt: null,
        createdAt: row.createdAt,
    };
}
function isMessageType(value) {
    return typeof value === "string" && MESSAGE_TYPES.includes(value);
}
function isPriority(value) {
    return value === "low" || value === "normal" || value === "high" || value === "critical";
}
function isIsoDate(value) {
    if (typeof value !== "string")
        return false;
    return !Number.isNaN(Date.parse(value));
}
function normalizeError(error) {
    if (error instanceof Error)
        return error;
    return new Error(String(error));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=messaging.js.map