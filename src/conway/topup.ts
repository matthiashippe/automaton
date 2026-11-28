/**
 * Credit Topup via x402
 *
 * Converts USDC to Conway credits via the x402 payment protocol.
 *
 * - On startup: bootstraps with the smallest tier that covers the deficit and that the wallet
 *   holds, so the agent can run.
 * - At runtime: the agent uses the `topup_credits` tool to choose how much.
 * - Heartbeat: wakes the agent when USDC is available but credits are low.
 *
 * Endpoint: GET /pay/{amountUsd}/{walletAddress}
 * Payment: x402 (USDC on Base, signed TransferWithAuthorization)
 *
 * Valid tiers: 5, 25, 100, 500, 1000, 2500 (USD), and 1 on automatonhost.com, which sells it
 * (topupTiersFor).
 *
 * Every payment goes through the topup guard (./topup-guard.ts): no key or no readable balance
 * means no payment, and a payment whose credits never show up stops all further ones.
 */

import type { PrivateKeyAccount, Address } from "viem";
import { x402Fetch, getUsdcBalance } from "./x402.js";
import { createLogger } from "../observability/logger.js";
import type { ChainType } from "../identity/chain.js";
import { loadConfig } from "../config.js";
import { loadApiKeyFromConfig } from "../identity/provision.js";
import { checkBeforeTopup, confirmTopup, type GuardDeps } from "./topup-guard.js";
import { USER_AGENT } from "../version.js";
import { isCardHost } from "../survival/card-line.js";

const logger = createLogger("topup");

/** Valid topup tier amounts in USD, as automatonhost.com sells them. */
export const TOPUP_TIERS = [1, 5, 25, 100, 500, 1000, 2500];

/** The upstream tiers, for every other control plane (api.conway.tech rejects 1 USD with a 400). */
export const UPSTREAM_TOPUP_TIERS = [5, 25, 100, 500, 1000, 2500];

/**
 * The tiers this control plane sells: TOPUP_TIERS only for automatonhost.com (the same check as
 * the card line), UPSTREAM_TOPUP_TIERS for any other, so an existing configuration never changes.
 */
export function topupTiersFor(conwayApiUrl: string | undefined | null): number[] {
  return isCardHost(conwayApiUrl) ? TOPUP_TIERS : UPSTREAM_TOPUP_TIERS;
}

/**
 * The tier to buy: among the tiers the wallet holds, the smallest that covers the deficit; if none
 * covers it, the largest the wallet holds; if the wallet holds none, null.
 */
export function pickTopupTier(
  tiers: readonly number[],
  deficitCents: number,
  usdcBalance: number,
): number | null {
  const held = [...tiers].sort((a, b) => a - b).filter((tier) => tier <= usdcBalance);
  if (held.length === 0) return null;
  return held.find((tier) => tier * 100 >= deficitCents) ?? held[held.length - 1];
}

/**
 * `details.topup_tiers_usd` of a 402 from automatonhost.com, reduced to the tiers in TOPUP_TIERS, so a server can never
 * make the runtime buy an amount it does not know. Null when the field is not a list.
 */
function tiersFrom402(details: { topup_tiers_usd?: unknown } | undefined): number[] | null {
  const offered = details?.topup_tiers_usd;
  if (!Array.isArray(offered)) return null;
  return TOPUP_TIERS.filter((tier) => offered.includes(tier));
}

export interface TopupResult {
  success: boolean;
  amountUsd: number;
  creditsCentsAdded?: number;
  error?: string;
  /** True when the guard refused before anything was paid. Not worth waking the agent for. */
  blocked?: boolean;
}

/** The guard's view of this control plane: the key the credits go to, and how to read them. */
export function defaultGuardDeps(apiUrl: string): GuardDeps {
  const apiKey = process.env.CONWAY_API_KEY || loadConfig()?.conwayApiKey || loadApiKeyFromConfig() || "";
  return {
    apiKey,
    readBalanceCents: async () => {
      const resp = await fetch(`${apiUrl}/v1/credits/balance`, {
        headers: { Authorization: apiKey, "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`${resp.status} ${(await resp.text()).slice(0, 200)}`);
      const body = (await resp.json()) as { balance_cents?: number; credits_cents?: number };
      const cents = body.balance_cents ?? body.credits_cents;
      if (typeof cents !== "number") throw new Error("balance response carries no balance");
      return cents;
    },
  };
}

/**
 * Execute a credit topup via x402 payment.
 *
 * Calls GET /pay/{amountUsd}/{address} which returns HTTP 402.
 * x402Fetch handles the payment signing and retry automatically.
 */
export async function topupCredits(
  apiUrl: string,
  account: PrivateKeyAccount,
  amountUsd: number,
  recipientAddress?: Address,
  guardDeps?: GuardDeps,
): Promise<TopupResult> {
  const address = recipientAddress || account.address;
  const url = `${apiUrl}/pay/${amountUsd}/${address}`;
  const deps = guardDeps ?? defaultGuardDeps(apiUrl);

  const check = await checkBeforeTopup(apiUrl, deps);
  if (!check.ok) {
    logger.warn(`Credit topup not attempted: ${check.reason}`);
    return { success: false, amountUsd, error: check.reason, blocked: true };
  }

  logger.info(`Attempting credit topup: $${amountUsd} USD for ${address}`);

  const result = await x402Fetch(url, account, "GET");

  if (!result.success) {
    logger.error(`Credit topup failed: ${result.error}`);
    return {
      success: false,
      amountUsd,
      error: result.error || `HTTP ${result.status}`,
    };
  }

  const creditsCentsAdded = typeof result.response === "object"
    ? result.response?.credits_cents ?? result.response?.amount_cents ?? amountUsd * 100
    : amountUsd * 100;

  // Credits bought for another address do not show up in our own balance, so only our own can be
  // confirmed.
  if (address.toLowerCase() === account.address.toLowerCase()) {
    const confirmed = await confirmTopup(apiUrl, amountUsd, check.balanceBeforeCents, deps);
    if (!confirmed.arrived) {
      return {
        success: false,
        amountUsd,
        error: `Paid, but the credits did not arrive (${confirmed.reason}). Topups are suspended.`,
      };
    }
  }

  logger.info(`Credit topup successful: $${amountUsd} USD → ${creditsCentsAdded} credits cents`);

  return {
    success: true,
    amountUsd,
    creditsCentsAdded,
  };
}

/**
 * Attempt a credit topup in response to a 402 sandbox creation error.
 *
 * Parses the error response to determine the deficit, picks the smallest
 * tier that covers it, checks USDC balance, and calls topupCredits().
 * The tiers are details.topup_tiers_usd of the 402 (only those in TOPUP_TIERS)
 * or, without that field, topupTiersFor(apiUrl).
 * Returns null if the error isn't a 402 or topup can't proceed.
 */
export async function topupForSandbox(params: {
  apiUrl: string;
  account: PrivateKeyAccount;
  error: Error & { status?: number; responseText?: string };
  chainType?: ChainType;
}): Promise<TopupResult | null> {
  const { apiUrl, account, error, chainType } = params;

  // Solana wallets cannot use x402 for topup (EVM-only payment protocol)
  if (chainType === "solana") {
    logger.info(
      "Sandbox topup skipped: Solana wallets cannot use x402. Fund via Conway credits API or dashboard.",
    );
    return null;
  }

  if (error.status !== 402 && !error.message?.includes("INSUFFICIENT_CREDITS")) return null;

  // Parse the 402 response body for credit details
  let requiredCents: number | undefined;
  let currentCents: number | undefined;
  let offeredTiers: number[] | null = null;
  try {
    const body = JSON.parse(error.responseText || "{}");
    requiredCents = body.details?.required_cents;
    currentCents = body.details?.current_balance_cents;
    // Only automatonhost.com reads the tiers of the 402; any other control plane chooses as upstream.
    offeredTiers = isCardHost(apiUrl) ? tiersFrom402(body.details) : null;
  } catch {
    // If we can't parse the body, check for INSUFFICIENT_CREDITS in message
    if (!error.message?.includes("INSUFFICIENT_CREDITS")) return null;
  }

  // On automatonhost.com the tiers the 402 offers, if it names any; otherwise the tiers of this
  // control plane (the upstream tiers for any other).
  const tiers = offeredTiers ?? topupTiersFor(apiUrl);
  if (tiers.length === 0) {
    logger.info("Sandbox topup skipped: the 402 offers no tier this runtime knows");
    return null;
  }

  // Calculate deficit in cents; default to minimum tier if details missing
  const deficitCents = (requiredCents != null && currentCents != null)
    ? requiredCents - currentCents
    : tiers[0] * 100;

  // Check USDC balance before attempting payment
  let usdcBalance: number;
  try {
    usdcBalance = await getUsdcBalance(account.address);
  } catch (err: any) {
    logger.warn(`Failed to check USDC balance for sandbox topup: ${err.message}`);
    return null;
  }

  let selectedTier: number | null;
  if (isCardHost(apiUrl)) {
    // The smallest tier the wallet holds that covers the deficit, else the largest it holds.
    selectedTier = pickTopupTier(tiers, deficitCents, usdcBalance);
    if (selectedTier === null) {
      logger.info(
        `Sandbox topup skipped: USDC $${usdcBalance.toFixed(2)} < tier $${tiers[0]}`,
      );
      return null;
    }
  } else {
    // Any other control plane, as upstream: pick smallest tier that covers the deficit (tier is
    // in USD, deficit in cents), and nothing if the wallet does not hold it.
    selectedTier = tiers.find((tier) => tier * 100 >= deficitCents)
      ?? tiers[tiers.length - 1];
    if (usdcBalance < selectedTier) {
      logger.info(
        `Sandbox topup skipped: USDC $${usdcBalance.toFixed(2)} < tier $${selectedTier}`,
      );
      return null;
    }
  }

  logger.info(`Sandbox topup: deficit=${deficitCents}c, buying $${selectedTier} tier`);
  return topupCredits(apiUrl, account, selectedTier);
}

/**
 * Bootstrap topup: buy a small tier on startup so the agent can run
 * inference. The agent decides larger topups itself via the
 * `topup_credits` tool. The agent loop and the heartbeat call it too.
 *
 * Only triggers when credits are below threshold AND USDC covers the
 * minimum tier. With automatonhost.com it buys from 1 USD the smallest
 * tier the wallet holds that covers creditThresholdCents minus credits
 * (pickTopupTier), so a wallet from 5 USDC still buys 5 USD at a start
 * with no credits; with any other control plane the minimum tier ($5).
 */
export async function bootstrapTopup(params: {
  apiUrl: string;
  account: PrivateKeyAccount;
  creditsCents: number;
  creditThresholdCents?: number;
  chainType?: ChainType;
}): Promise<TopupResult | null> {
  const { apiUrl, account, creditsCents, creditThresholdCents = 500, chainType } = params;

  // Solana wallets cannot use x402 for topup (EVM-only payment protocol)
  if (chainType === "solana") {
    if (creditsCents < creditThresholdCents) {
      logger.info(
        "Bootstrap topup skipped: Solana wallets cannot use x402. Fund via Conway credits API or dashboard.",
      );
    }
    return null;
  }

  if (creditsCents >= creditThresholdCents) {
    return null;
  }

  let usdcBalance: number;
  try {
    usdcBalance = await getUsdcBalance(account.address);
  } catch (err: any) {
    logger.warn(`Failed to check USDC balance for bootstrap topup: ${err.message}`);
    return null;
  }

  const tiers = topupTiersFor(apiUrl);
  const minTier = tiers[0];
  const upstreamMin = UPSTREAM_TOPUP_TIERS[0];
  // A wallet of 5 USDC or more buys exactly what it bought before, on every control plane: the
  // upstream minimum tier. Below that, automatonhost.com sells the tier pickTopupTier() chooses
  // for the deficit below the threshold; any other control plane buys nothing, as upstream.
  const tier = usdcBalance >= upstreamMin
    ? upstreamMin
    : isCardHost(apiUrl)
      ? pickTopupTier(tiers, creditThresholdCents - creditsCents, usdcBalance)
      : null;
  if (tier === null) {
    logger.info(
      `Bootstrap topup skipped: USDC balance $${usdcBalance.toFixed(2)} below minimum tier ($${minTier})`,
    );
    return null;
  }

  logger.info(
    `Bootstrap topup: credits=$${(creditsCents / 100).toFixed(2)}, USDC=$${usdcBalance.toFixed(2)}, buying $${tier}`,
  );

  return topupCredits(apiUrl, account, tier);
}
