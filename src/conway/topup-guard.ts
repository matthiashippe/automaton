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

import fs from "fs";
import path from "path";
import { getAutomatonDir } from "../identity/wallet.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("topup-guard");

const SUSPENSION_FILE = "topup-suspended.json";

/** How long a paid topup gets to show up in the balance before it counts as lost. */
const CONFIRM_ATTEMPTS = 4;
const CONFIRM_INTERVAL_MS = 1_500;

/**
 * Share of the paid amount that has to appear. Not all of it, because inference keeps spending
 * while the payment settles, and a busy agent can burn a few cents in those seconds.
 */
const CONFIRM_SHARE = 0.9;

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

function suspensionPath(dir?: string): string {
  return path.join(dir ?? getAutomatonDir(), SUSPENSION_FILE);
}

export function readSuspension(dir?: string): TopupSuspension | null {
  try {
    return JSON.parse(fs.readFileSync(suspensionPath(dir), "utf-8")) as TopupSuspension;
  } catch {
    return null;
  }
}

function writeSuspension(suspension: TopupSuspension, dir?: string): void {
  const file = suspensionPath(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(suspension, null, 2), { mode: 0o600 });
}

/** Lifts a suspension. Returns the suspension that was lifted, or null if there was none. */
export function resumeTopups(dir?: string): TopupSuspension | null {
  const existing = readSuspension(dir);
  if (existing) fs.rmSync(suspensionPath(dir), { force: true });
  return existing;
}

/**
 * Decides whether a topup may be paid. Returns the balance before the payment, which the caller
 * hands back to confirmTopup(), or a reason not to pay.
 */
export async function checkBeforeTopup(
  apiUrl: string,
  deps: GuardDeps,
): Promise<{ ok: true; balanceBeforeCents: number } | { ok: false; reason: string }> {
  const suspension = readSuspension(deps.dir);
  if (suspension) {
    return {
      ok: false,
      reason:
        `Topups are suspended since ${suspension.since}: a ${suspension.amountUsd} USD topup at ` +
        `${suspension.apiUrl} was paid and the credits never arrived (${suspension.reason}). ` +
        `Check the balance with your control plane, then run: automaton --resume-topups`,
    };
  }

  if (!deps.apiKey) {
    return {
      ok: false,
      reason:
        `No API key, so credits bought now could not be used. Sign-up at ${apiUrl} has to ` +
        `succeed first (automaton --provision).`,
    };
  }

  try {
    return { ok: true, balanceBeforeCents: await deps.readBalanceCents() };
  } catch (err: any) {
    return {
      ok: false,
      reason:
        `The credit balance at ${apiUrl} cannot be read (${err?.message ?? err}), so nothing ` +
        `could confirm that a topup arrived. Not paying.`,
    };
  }
}

/**
 * Called after a payment went through. Waits for the credits to show up, and suspends every
 * further topup when they do not.
 */
export async function confirmTopup(
  apiUrl: string,
  amountUsd: number,
  balanceBeforeCents: number,
  deps: GuardDeps,
): Promise<{ arrived: true; balanceAfterCents: number } | { arrived: false; reason: string }> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const expected = balanceBeforeCents + amountUsd * 100 * CONFIRM_SHARE;
  let last: number | null = null;
  let lastError = "";

  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
    await sleep(CONFIRM_INTERVAL_MS);
    try {
      last = await deps.readBalanceCents();
      if (last >= expected) return { arrived: true, balanceAfterCents: last };
    } catch (err: any) {
      lastError = err?.message ?? String(err);
    }
  }

  const reason = last === null
    ? `balance unreadable after payment: ${lastError}`
    : `balance went from ${balanceBeforeCents} to ${last} cents`;
  writeSuspension(
    {
      since: new Date().toISOString(),
      apiUrl,
      amountUsd,
      balanceBeforeCents,
      balanceAfterCents: last,
      reason,
    },
    deps.dir,
  );
  logger.error(
    `Topup of ${amountUsd} USD at ${apiUrl} was paid but the credits did not arrive (${reason}). ` +
      `All further topups are suspended until: automaton --resume-topups`,
  );
  return { arrived: false, reason };
}
