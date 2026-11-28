/**
 * One dollar tier
 *
 * automatonhost.com sells credits from 1 USD, the runtime only knew tiers from 5 USD. A wallet
 * with 1 to under 5 USDC therefore never topped up and the automaton stood still with empty
 * credits. Against automatonhost.com the runtime now buys the smallest tier that covers the
 * deficit and that the wallet holds; against any other control plane it keeps the upstream tiers.
 *
 * No network: x402Fetch and getUsdcBalance are mocks, and so is the topup guard (its rules have
 * their own tests in topup-guard.test.ts and topup-credits.test.ts).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const x402Fetch = vi.fn();
const getUsdcBalance = vi.fn();
vi.mock("../conway/x402.js", () => ({
  x402Fetch: (...args: unknown[]) => x402Fetch(...args),
  getUsdcBalance: (...args: unknown[]) => getUsdcBalance(...args),
}));

vi.mock("../conway/topup-guard.js", () => ({
  checkBeforeTopup: async () => ({ ok: true, balanceBeforeCents: 0 }),
  confirmTopup: async (_apiUrl: string, amountUsd: number) => ({
    arrived: true,
    balanceAfterCents: amountUsd * 100,
  }),
}));

const topup: Record<string, any> = await import("../conway/topup.js");
const { bootstrapTopup, topupForSandbox } = topup;
const { BUILTIN_TASKS } = await import("../heartbeat/tasks.js");
const { runAgentLoop } = await import("../agent/loop.js");
const { createBuiltinTools } = await import("../agent/tools.js");
const {
  MockConwayClient,
  MockInferenceClient,
  createTestDb,
  createTestIdentity,
  createTestConfig,
  noToolResponse,
} = await import("./mocks.js");

const HOST = "https://automatonhost.com";
const CONWAY = "https://api.conway.tech";
const account = privateKeyToAccount(generatePrivateKey());

/** The amounts in USD that /pay/ was called with, in order. */
function paidAmounts(): number[] {
  return x402Fetch.mock.calls.map((call) => {
    const match = /\/pay\/(\d+)\//.exec(String(call[0]));
    return match ? Number(match[1]) : NaN;
  });
}

function sandbox402(details: Record<string, unknown>): Error & { status: number; responseText: string } {
  const error = new Error("Conway API error: 402 INSUFFICIENT_CREDITS") as Error & {
    status: number;
    responseText: string;
  };
  error.status = 402;
  error.responseText = JSON.stringify({ error: "INSUFFICIENT_CREDITS", details });
  return error;
}

describe("one dollar tier", () => {
  let dbs: { close(): void }[] = [];

  beforeEach(() => {
    x402Fetch.mockReset();
    x402Fetch.mockResolvedValue({ success: true, status: 200, response: { credits_cents: 100 } });
    getUsdcBalance.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const db of dbs) db.close();
    dbs = [];
    vi.restoreAllMocks();
  });

  it("bootstrap buys 1 USD with 1 to under 5 USDC on automatonhost.com", async () => {
    for (const usdc of [1, 2, 4.99]) {
      getUsdcBalance.mockResolvedValue(usdc);
      const result = await bootstrapTopup({ apiUrl: HOST, account, creditsCents: 0 });
      expect(result?.success, `wallet ${usdc} USDC`).toBe(true);
      expect(result?.amountUsd).toBe(1);
    }
    // A trailing slash is still automatonhost.com.
    getUsdcBalance.mockResolvedValue(3);
    await bootstrapTopup({ apiUrl: `${HOST}/`, account, creditsCents: 120 });
    expect(paidAmounts()).toEqual([1, 1, 1, 1]);
    expect(x402Fetch.mock.calls[0][0]).toBe(`${HOST}/pay/1/${account.address}`);
  });

  it("bootstrap still buys 5 USD with 5 USDC or more", async () => {
    // Deficit at start is creditThresholdCents (500) minus the balance: from 5 USDC on, 5 USD
    // covers it, as before.
    expect(topup.pickTopupTier(topup.TOPUP_TIERS, 500, 5)).toBe(5);
    expect(topup.pickTopupTier(topup.UPSTREAM_TOPUP_TIERS, 500, 5)).toBe(5);

    for (const apiUrl of [HOST, CONWAY]) {
      for (const usdc of [5, 7.5, 50, 3000]) {
        x402Fetch.mockClear();
        getUsdcBalance.mockResolvedValue(usdc);
        const result = await bootstrapTopup({ apiUrl, account, creditsCents: 0 });
        expect(result?.amountUsd, `${apiUrl} with ${usdc} USDC`).toBe(5);
        expect(x402Fetch).toHaveBeenCalledTimes(1);
        expect(x402Fetch.mock.calls[0][0]).toBe(`${apiUrl}/pay/5/${account.address}`);
      }
    }

    // Also with credits left below the threshold, where 1 USD would cover the deficit: a wallet of
    // 5 USDC or more buys exactly what it bought before the one dollar tier.
    for (const apiUrl of [HOST, CONWAY]) {
      for (const creditsCents of [400, 450, 499]) {
        x402Fetch.mockClear();
        getUsdcBalance.mockResolvedValue(7.5);
        const result = await bootstrapTopup({ apiUrl, account, creditsCents });
        expect(result?.amountUsd, `${apiUrl} with ${creditsCents} cents left`).toBe(5);
        expect(x402Fetch.mock.calls[0][0]).toBe(`${apiUrl}/pay/5/${account.address}`);
      }
    }
  });

  it("buys nothing with less than 1 USDC", async () => {
    expect(topup.pickTopupTier(topup.TOPUP_TIERS, 500, 0.99)).toBeNull();
    expect(topup.pickTopupTier(topup.TOPUP_TIERS, 50, 0)).toBeNull();

    for (const usdc of [0, 0.5, 0.99]) {
      getUsdcBalance.mockResolvedValue(usdc);
      expect(await bootstrapTopup({ apiUrl: HOST, account, creditsCents: 0 })).toBeNull();
      expect(
        await topupForSandbox({
          apiUrl: HOST,
          account,
          error: sandbox402({ required_cents: 150, current_balance_cents: 100, topup_tiers_usd: [1, 5] }),
        }),
      ).toBeNull();
    }
    expect(x402Fetch).not.toHaveBeenCalled();
  });

  it("keeps the upstream tiers for another control plane", async () => {
    expect(topup.UPSTREAM_TOPUP_TIERS).toEqual([5, 25, 100, 500, 1000, 2500]);
    expect(topup.TOPUP_TIERS).toEqual([1, 5, 25, 100, 500, 1000, 2500]);
    expect(topup.topupTiersFor(HOST)).toEqual(topup.TOPUP_TIERS);
    expect(topup.topupTiersFor("https://AutomatonHost.com/")).toEqual(topup.TOPUP_TIERS);
    for (const other of [CONWAY, "https://cp.example", "https://automatonhost.com.evil.example", "", undefined]) {
      expect(topup.topupTiersFor(other), String(other)).toEqual(topup.UPSTREAM_TOPUP_TIERS);
    }

    // Another control plane with 1 to under 5 USDC: nothing, as before.
    getUsdcBalance.mockResolvedValue(4.99);
    expect(await bootstrapTopup({ apiUrl: CONWAY, account, creditsCents: 0 })).toBeNull();
    expect(
      await topupForSandbox({
        apiUrl: CONWAY,
        account,
        error: sandbox402({ required_cents: 150, current_balance_cents: 100 }),
      }),
    ).toBeNull();
    expect(x402Fetch).not.toHaveBeenCalled();

    // A deficit no tier the wallet holds covers: upstream skips, and still does.
    getUsdcBalance.mockResolvedValue(30);
    expect(
      await topupForSandbox({
        apiUrl: CONWAY,
        account,
        error: sandbox402({ required_cents: 10_000, current_balance_cents: 0 }),
      }),
    ).toBeNull();
    expect(x402Fetch).not.toHaveBeenCalled();
  });

  it("sandbox topup takes the known tiers from details.topup_tiers_usd of the 402", async () => {
    getUsdcBalance.mockResolvedValue(2);

    // 3 is no tier the runtime knows, so it is never bought; 1 covers the deficit of 50 cents.
    const one = await topupForSandbox({
      apiUrl: HOST,
      account,
      error: sandbox402({ required_cents: 150, current_balance_cents: 100, topup_tiers_usd: [3, 1, 5] }),
    });
    expect(one?.amountUsd).toBe(1);

    // A server that does not sell 1 USD is not asked for it.
    const none = await topupForSandbox({
      apiUrl: HOST,
      account,
      error: sandbox402({ required_cents: 150, current_balance_cents: 100, topup_tiers_usd: [5, 25] }),
    });
    expect(none).toBeNull();

    // Only unknown amounts: nothing to buy.
    const unknown = await topupForSandbox({
      apiUrl: HOST,
      account,
      error: sandbox402({ required_cents: 150, current_balance_cents: 100, topup_tiers_usd: [2, 3] }),
    });
    expect(unknown).toBeNull();

    // Without the field, automatonhost.com's own tiers apply.
    const fallback = await topupForSandbox({
      apiUrl: HOST,
      account,
      error: sandbox402({ required_cents: 150, current_balance_cents: 100 }),
    });
    expect(fallback?.amountUsd).toBe(1);

    // The smallest tier the wallet holds that covers the deficit.
    getUsdcBalance.mockResolvedValue(30);
    const covering = await topupForSandbox({
      apiUrl: HOST,
      account,
      error: sandbox402({ required_cents: 900, current_balance_cents: 100, topup_tiers_usd: [1, 5, 25, 100] }),
    });
    expect(covering?.amountUsd).toBe(25);

    expect(paidAmounts()).toEqual([1, 1, 25]);
  });

  it("heartbeat and loop top up from 1 USDC on automatonhost.com", async () => {
    getUsdcBalance.mockResolvedValue(2);
    const identity = { ...createTestIdentity(), address: account.address, account };
    const config = createTestConfig({ conwayApiUrl: HOST });

    // Heartbeat, tier critical.
    const hbDb = createTestDb();
    dbs.push(hbDb);
    const conway = new MockConwayClient();
    const heartbeat = await BUILTIN_TASKS.check_usdc_balance(
      {
        tickId: "tick-1",
        startedAt: new Date(),
        creditBalance: 0,
        usdcBalance: 2,
        survivalTier: "critical",
        lowComputeMultiplier: 4,
        config: { entries: [], defaultIntervalMs: 60_000, lowComputeMultiplier: 4 },
        db: hbDb.raw,
      },
      { identity, config, db: hbDb, conway },
    );
    expect(paidAmounts()).toEqual([1]);
    expect(x402Fetch.mock.calls[0][0]).toBe(`${HOST}/pay/1/${account.address}`);
    expect(heartbeat.shouldWake).toBe(true);
    expect(heartbeat.message).toContain("Auto-topped up $1");

    // Agent loop, credits at zero (tier critical), before the first inference.
    x402Fetch.mockClear();
    const loopDb = createTestDb();
    dbs.push(loopDb);
    const loopConway = new MockConwayClient();
    loopConway.creditsCents = 0;
    await runAgentLoop({
      identity,
      config,
      db: loopDb,
      conway: loopConway,
      inference: new MockInferenceClient([noToolResponse("Done.")]),
    });
    expect(paidAmounts()).toEqual([1]);
    expect(x402Fetch.mock.calls[0][0]).toBe(`${HOST}/pay/1/${account.address}`);
  });

  it("topup_credits accepts 1 only where the control plane sells it", async () => {
    getUsdcBalance.mockResolvedValue(2);
    const tool = createBuiltinTools("test-sandbox-id").find((t) => t.name === "topup_credits")!;
    const identity = { ...createTestIdentity(), address: account.address, account };
    const db = createTestDb();
    dbs.push(db);

    // The model's view of the tool is unchanged.
    expect(tool.description).toBe(
      "Buy Conway compute credits by paying USDC from your wallet via x402. Valid tier amounts: $5, $25, $100, $500, $1000, $2500. Check your USDC balance first with check_usdc_balance.",
    );

    const onHost = await tool.execute({ amount_usd: 1 }, {
      identity,
      config: createTestConfig({ conwayApiUrl: HOST }),
      db,
    } as any);
    expect(onHost).toContain("Credit topup successful: +$1");
    expect(paidAmounts()).toEqual([1]);

    const elsewhere = await tool.execute({ amount_usd: 1 }, {
      identity,
      config: createTestConfig({ conwayApiUrl: CONWAY }),
      db,
    } as any);
    expect(elsewhere).toBe("Invalid tier. Valid amounts (USD): 5, 25, 100, 500, 1000, 2500");
    expect(paidAmounts()).toEqual([1]);
  });
});
