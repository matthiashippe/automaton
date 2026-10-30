import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const x402Fetch = vi.fn();
vi.mock("../conway/x402.js", () => ({
  x402Fetch: (...args: unknown[]) => x402Fetch(...args),
  getUsdcBalance: async () => 50,
}));

const { topupCredits } = await import("../conway/topup.js");
const { readSuspension } = await import("../conway/topup-guard.js");

const API = "https://cp.example";
const account = privateKeyToAccount(generatePrivateKey());

describe("topupCredits behind the guard", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "topup-credits-"));
    x402Fetch.mockReset();
    x402Fetch.mockResolvedValue({ success: true, status: 200, response: { credits_cents: 500 } });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("pays nothing when the balance cannot be read, which is the api.conway.tech case", async () => {
    const result = await topupCredits(API, account, 5, undefined, {
      apiKey: "cnwy_k_dead",
      readBalanceCents: async () => {
        throw new Error("401 Missing or invalid authentication");
      },
      dir,
    });
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(x402Fetch).not.toHaveBeenCalled();
  });

  it("pays nothing without an API key", async () => {
    const result = await topupCredits(API, account, 5, undefined, {
      apiKey: "",
      readBalanceCents: async () => 0,
      dir,
    });
    expect(result.blocked).toBe(true);
    expect(x402Fetch).not.toHaveBeenCalled();
  });

  it("pays once, then stops, when the credits never arrive", async () => {
    const deps = { apiKey: "cnwy_k_test", readBalanceCents: async () => 0, sleep: async () => {}, dir };

    const first = await topupCredits(API, account, 5, undefined, deps);
    expect(first.success).toBe(false);
    expect(first.blocked).toBeUndefined();
    expect(x402Fetch).toHaveBeenCalledTimes(1);
    expect(readSuspension(dir)).not.toBeNull();

    const second = await topupCredits(API, account, 5, undefined, deps);
    expect(second.blocked).toBe(true);
    expect(x402Fetch).toHaveBeenCalledTimes(1);
  });

  it("reports success when the credits show up", async () => {
    const balances = [100, 601];
    const result = await topupCredits(API, account, 5, undefined, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => balances.shift() ?? 601,
      sleep: async () => {},
      dir,
    });
    expect(result.success).toBe(true);
    expect(x402Fetch).toHaveBeenCalledWith(`${API}/pay/5/${account.address}`, account, "GET");
  });
});
