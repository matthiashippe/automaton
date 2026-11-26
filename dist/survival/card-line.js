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
/** The only control plane the line is written for. */
export const CARD_HOST = "https://automatonhost.com";
/** A 402 writes the line at most once per this interval, so it does not become one of a thousand error lines. */
export const CARD_LINE_INTERVAL_MS = 60 * 60 * 1000;
const SENTENCE = "No crypto needed: pay by card, PayPal or Apple Pay at ";
export function cardLine(link) {
    return SENTENCE + link;
}
/** True only for automatonhost.com itself, with or without a trailing slash. */
export function isCardHost(conwayApiUrl) {
    if (!conwayApiUrl)
        return false;
    return conwayApiUrl.trim().replace(/\/+$/, "").toLowerCase() === CARD_HOST;
}
/** The link of the smallest card package for this wallet, the same form the server builds. */
export function ownCardUrl(address) {
    return `${CARD_HOST}/card/5?address=${address.toLowerCase()}`;
}
function isCardTier(tier) {
    return tier === "critical" || tier === "dead";
}
/** A link fit for a terminal line: https, no whitespace, no control characters. */
function isPlainLink(value) {
    return typeof value === "string" && /^https:\/\/[^\s\x00-\x1f\x7f]+$/.test(value);
}
/**
 * `details.card_url` of an INSUFFICIENT_CREDITS 402, read from the message the inference client
 * throws ("Inference error (<backend>): 402: <body>"). Null for any other error, and for a 402
 * without card_url (the server's card switch is off).
 */
export function cardUrlFromError(err) {
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
    const match = /:\s*402:\s*(\{[\s\S]*\})\s*$/.exec(message);
    if (!match)
        return null;
    try {
        const body = JSON.parse(match[1]);
        if (body?.error !== "INSUFFICIENT_CREDITS")
            return null;
        const url = body.details?.card_url;
        return isPlainLink(url) ? url : null;
    }
    catch {
        return null;
    }
}
/** Keeps what one process has already said: the last tier it saw and when a 402 last wrote the line. */
export class CardLineNotifier {
    options;
    enabled;
    lastTier;
    last402At;
    constructor(options) {
        this.options = options;
        this.enabled = isCardHost(options.conwayApiUrl);
    }
    /**
     * Call with the tier of every balance read that succeeded. Writes the line for the first read of
     * the process when it is critical or dead (start), and whenever the tier enters critical or dead.
     */
    onTier(tier) {
        const previous = this.lastTier;
        this.lastTier = tier;
        if (!this.enabled || !isCardTier(tier) || previous === tier)
            return;
        this.options.log(cardLine(ownCardUrl(this.options.address)));
    }
    /** Call with the error of a failed turn. Writes the card_url of an INSUFFICIENT_CREDITS 402, at most once an hour. */
    onInferenceError(err) {
        if (!this.enabled)
            return;
        const url = cardUrlFromError(err);
        if (!url)
            return;
        const now = (this.options.now ?? Date.now)();
        if (this.last402At !== undefined && now - this.last402At < CARD_LINE_INTERVAL_MS)
            return;
        this.last402At = now;
        this.options.log(cardLine(url));
    }
}
let shared;
/** One notifier per process, so the start line and the hourly limit survive the loop's sleeps. */
export function processCardLine(options) {
    shared ??= new CardLineNotifier(options);
    return shared;
}
/** The line for `automaton --status`, from the stored state; null when there is nothing to say. */
export function statusCardLine(config, state) {
    if (!isCardHost(config.conwayApiUrl) || !isCardTier(state) || !config.walletAddress)
        return null;
    return cardLine(ownCardUrl(config.walletAddress));
}
//# sourceMappingURL=card-line.js.map