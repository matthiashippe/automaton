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
import { x402Fetch, getUsdcBalance } from "./x402.js";
import { createLogger } from "../observability/logger.js";
import type { ChainType } from "../identity/chain.js";
import { loadConfig } from "../config.js";
import { loadApiKeyFromConfig } from "../identity/provision.js";
import { checkBeforeTopup, confirmTopup, type GuardDeps } from "./topup-guard.js";

const logger = createLogger("topup");

/** Valid topup tier amounts in USD. */
export const TOPUP_TIERS = [5, 25, 100, 500, 1000, 2500];

export interface TopupResult {
  success: boolean;
  amountUsd: number;
  creditsCentsAdded?: number;
  error?: string;
  /** True when the guard refused before anything was paid. Not worth waking the agent for. */
  blocked?: boolean;
}

/** The guard's view of this control plane: the key the credits go to, and how to read them. */
function defaultGuardDeps(apiUrl: string): GuardDeps {
  const apiKey = process.env.CONWAY_API_KEY || loadConfig()?.conwayApiKey || loadApiKeyFromConfig() || "";
  return {
    apiKey,
    readBalanceCents: async () => {
      const resp = await fetch(`${apiUrl}/v1/credits/balance`, {
        headers: { Authorization: apiKey },
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
  try {
    const body = JSON.parse(error.responseText || "{}");
    requiredCents = body.details?.required_cents;
    currentCents = body.details?.current_balance_cents;
  } catch {
    // If we can't parse the body, check for INSUFFICIENT_CREDITS in message
    if (!error.message?.includes("INSUFFICIENT_CREDITS")) return null;
  }

  // Calculate deficit in cents; default to minimum tier if details missing
  const deficitCents = (requiredCents != null && currentCents != null)
    ? requiredCents - currentCents
    : TOPUP_TIERS[0] * 100;

  // Pick smallest tier that covers the deficit (tier is in USD, deficit in cents)
  const selectedTier = TOPUP_TIERS.find((tier) => tier * 100 >= deficitCents)
    ?? TOPUP_TIERS[TOPUP_TIERS.length - 1];

  // Check USDC balance before attempting payment
  let usdcBalance: number;
  try {
    usdcBalance = await getUsdcBalance(account.address);
  } catch (err: any) {
    logger.warn(`Failed to check USDC balance for sandbox topup: ${err.message}`);
    return null;
  }

  if (usdcBalance < selectedTier) {
    logger.info(
      `Sandbox topup skipped: USDC $${usdcBalance.toFixed(2)} < tier $${selectedTier}`,
    );
    return null;
  }

  logger.info(`Sandbox topup: deficit=${deficitCents}c, buying $${selectedTier} tier`);
  return topupCredits(apiUrl, account, selectedTier);
}

/**
 * Bootstrap topup: buy the minimum tier ($5) on startup so the agent
 * can run inference. The agent decides larger topups itself via the
 * `topup_credits` tool.
 *
 * Only triggers when credits are below threshold AND USDC covers the
 * minimum tier.
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

  const minTier = TOPUP_TIERS[0];
  if (usdcBalance < minTier) {
    logger.info(
      `Bootstrap topup skipped: USDC balance $${usdcBalance.toFixed(2)} below minimum tier ($${minTier})`,
    );
    return null;
  }

  logger.info(
    `Bootstrap topup: credits=$${(creditsCents / 100).toFixed(2)}, USDC=$${usdcBalance.toFixed(2)}, buying $${minTier}`,
  );

  return topupCredits(apiUrl, account, minTier);
}
