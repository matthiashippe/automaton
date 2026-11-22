/**
 * Credit Topup via x402
 *
 * Converts USDC to Conway credits via the x402 payment protocol.
 *
 * - On startup: bootstraps with the minimum tier ($5) so the agent can run.
 * - At runtime: the agent uses the `topup_credits` tool to choose how much.
 * - Heartbeat: wakes the agent when USDC is available but credits are low.
 *
 * Endpoint: GET /pay/{amountUsd}/{walletAddress}
 * Payment: x402 (USDC on Base, signed TransferWithAuthorization)
 *
 * Valid tiers: 5, 25, 100, 500, 1000, 2500 (USD)
 *
 * Every payment goes through the topup guard (./topup-guard.ts): no key or no readable balance
 * means no payment, and a payment whose credits never show up stops all further ones.
 */
import type { PrivateKeyAccount, Address } from "viem";
import type { ChainType } from "../identity/chain.js";
import { type GuardDeps } from "./topup-guard.js";
/** Valid topup tier amounts in USD. */
export declare const TOPUP_TIERS: number[];
export interface TopupResult {
    success: boolean;
    amountUsd: number;
    creditsCentsAdded?: number;
    error?: string;
    /** True when the guard refused before anything was paid. Not worth waking the agent for. */
    blocked?: boolean;
}
/** The guard's view of this control plane: the key the credits go to, and how to read them. */
export declare function defaultGuardDeps(apiUrl: string): GuardDeps;
/**
 * Execute a credit topup via x402 payment.
 *
 * Calls GET /pay/{amountUsd}/{address} which returns HTTP 402.
 * x402Fetch handles the payment signing and retry automatically.
 */
export declare function topupCredits(apiUrl: string, account: PrivateKeyAccount, amountUsd: number, recipientAddress?: Address, guardDeps?: GuardDeps): Promise<TopupResult>;
/**
 * Attempt a credit topup in response to a 402 sandbox creation error.
 *
 * Parses the error response to determine the deficit, picks the smallest
 * tier that covers it, checks USDC balance, and calls topupCredits().
 * Returns null if the error isn't a 402 or topup can't proceed.
 */
export declare function topupForSandbox(params: {
    apiUrl: string;
    account: PrivateKeyAccount;
    error: Error & {
        status?: number;
        responseText?: string;
    };
    chainType?: ChainType;
}): Promise<TopupResult | null>;
/**
 * Bootstrap topup: buy the minimum tier ($5) on startup so the agent
 * can run inference. The agent decides larger topups itself via the
 * `topup_credits` tool.
 *
 * Only triggers when credits are below threshold AND USDC covers the
 * minimum tier.
 */
export declare function bootstrapTopup(params: {
    apiUrl: string;
    account: PrivateKeyAccount;
    creditsCents: number;
    creditThresholdCents?: number;
    chainType?: ChainType;
}): Promise<TopupResult | null>;
//# sourceMappingURL=topup.d.ts.map