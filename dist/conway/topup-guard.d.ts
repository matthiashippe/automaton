/**
 * Topup Guard
 *
 * A topup is only worth paying for if the credits arrive. Upstream pays from three places
 * (startup, the heartbeat every five minutes, the agent loop every minute) whenever the wallet
 * holds 5 USDC and /pay answers with a payable 402, and none of them checks the result. Since
 * sign-up at api.conway.tech started failing in July 2026 that is a steady drain: the payment
 * endpoint keeps working, the credits land on an account the automaton has no key for, and the
 * next tick pays again. Between 8 and 29 October 2026, 18 wallets sent 280 USDC to Conway's
 * payment address while its sign-up was failing.
 *
 * Three rules, enforced inside topupCredits() so that every path is covered, including the
 * agent's own topup_credits tool:
 *
 *   1. No API key, no topup. Credits bought without a key cannot be spent.
 *   2. No readable balance, no topup. If /v1/credits/balance does not answer, nothing can confirm
 *      that the credits arrived, so nothing is paid.
 *   3. A paid topup whose credits do not show up suspends all further topups, until the operator
 *      runs `automaton --resume-topups`. One lost payment is a bug; the second one is a policy.
 */
export interface TopupSuspension {
    since: string;
    apiUrl: string;
    amountUsd: number;
    balanceBeforeCents: number;
    balanceAfterCents: number | null;
    reason: string;
}
export interface GuardDeps {
    /** The API key the credits will be bound to. Empty means there is none. */
    apiKey: string;
    /** Reads the credit balance in cents. Throws when the balance cannot be read. */
    readBalanceCents: () => Promise<number>;
    sleep?: (ms: number) => Promise<void>;
    dir?: string;
}
export declare function readSuspension(dir?: string): TopupSuspension | null;
/** Lifts a suspension. Returns the suspension that was lifted, or null if there was none. */
export declare function resumeTopups(dir?: string): TopupSuspension | null;
/**
 * Decides whether a topup may be paid. Returns the balance before the payment, which the caller
 * hands back to confirmTopup(), or a reason not to pay.
 */
export declare function checkBeforeTopup(apiUrl: string, deps: GuardDeps): Promise<{
    ok: true;
    balanceBeforeCents: number;
} | {
    ok: false;
    reason: string;
}>;
/**
 * Called after a payment went through. Waits for the credits to show up, and suspends every
 * further topup when they do not.
 */
export declare function confirmTopup(apiUrl: string, amountUsd: number, balanceBeforeCents: number, deps: GuardDeps): Promise<{
    arrived: true;
    balanceAfterCents: number;
} | {
    arrived: false;
    reason: string;
}>;
//# sourceMappingURL=topup-guard.d.ts.map