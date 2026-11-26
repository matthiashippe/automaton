/**
 * Card Line
 *
 * When the credits run out, the server's 402 reaches the human running the automaton only as
 * JSON inside "[ERROR] Turn failed: ...", and the way to pay without crypto that it names is lost
 * among those lines. This module writes one sentence of its own on its own log line:
 *
 *   No crypto needed: pay by card, PayPal or Apple Pay at <link>
 *
 * Only with automatonhost.com as the control plane, which is the one that sells credits by card.
 * The line goes to the human's log only: it is never part of the model's prompt, no tool exposes
 * it, and nothing is requested from the server just to write it.
 */
import type { AgentState, SurvivalTier } from "../types.js";
/** The only control plane the line is written for. */
export declare const CARD_HOST = "https://automatonhost.com";
/** A 402 writes the line at most once per this interval, so it does not become one of a thousand error lines. */
export declare const CARD_LINE_INTERVAL_MS: number;
export declare function cardLine(link: string): string;
/** True only for automatonhost.com itself, with or without a trailing slash. */
export declare function isCardHost(conwayApiUrl: string | undefined | null): boolean;
/** The link of the smallest card package for this wallet, the same form the server builds. */
export declare function ownCardUrl(address: string): string;
/**
 * `details.card_url` of an INSUFFICIENT_CREDITS 402, read from the message the inference client
 * throws ("Inference error (<backend>): 402: <body>"). Null for any other error, and for a 402
 * without card_url (the server's card switch is off).
 */
export declare function cardUrlFromError(err: unknown): string | null;
export interface CardLineOptions {
    conwayApiUrl: string | undefined;
    /** The automaton's own wallet. */
    address: string;
    /** Writes one line to the log the human sees. */
    log: (line: string) => void;
    now?: () => number;
}
/** Keeps what one process has already said: the last tier it saw and when a 402 last wrote the line. */
export declare class CardLineNotifier {
    private readonly options;
    private readonly enabled;
    private lastTier;
    private last402At;
    constructor(options: CardLineOptions);
    /**
     * Call with the tier of every balance read that succeeded. Writes the line for the first read of
     * the process when it is critical or dead (start), and whenever the tier enters critical or dead.
     */
    onTier(tier: SurvivalTier): void;
    /** Call with the error of a failed turn. Writes the card_url of an INSUFFICIENT_CREDITS 402, at most once an hour. */
    onInferenceError(err: unknown): void;
}
/** One notifier per process, so the start line and the hourly limit survive the loop's sleeps. */
export declare function processCardLine(options: CardLineOptions): CardLineNotifier;
/** The line for `automaton --status`, from the stored state; null when there is nothing to say. */
export declare function statusCardLine(config: {
    conwayApiUrl?: string;
    walletAddress?: string;
}, state: AgentState | string): string | null;
//# sourceMappingURL=card-line.d.ts.map