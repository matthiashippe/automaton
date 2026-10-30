import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  checkBeforeTopup,
  confirmTopup,
  readSuspension,
  resumeTopups,
} from "../conway/topup-guard.js";

const API = "https://cp.example";
const noSleep = async () => {};

describe("topup guard", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "topup-guard-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses to pay without an API key", async () => {
    const result = await checkBeforeTopup(API, {
      apiKey: "",
      readBalanceCents: async () => 0,
      dir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("No API key");
  });

  it("refuses to pay when the balance cannot be read", async () => {
    // This is the api.conway.tech case: a key that the server cannot find, a balance call that
    // fails, and a payment endpoint that still answers 402.
    const result = await checkBeforeTopup(API, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => {
        throw new Error("401 Missing or invalid authentication");
      },
      dir,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("cannot be read");
  });

  it("allows a topup when key and balance are there, and hands back the balance", async () => {
    const result = await checkBeforeTopup(API, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => 120,
      dir,
    });
    expect(result).toEqual({ ok: true, balanceBeforeCents: 120 });
  });

  it("confirms a topup whose credits arrive", async () => {
    const balances = [120, 120, 621];
    const result = await confirmTopup(API, 5, 120, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => balances.shift() ?? 621,
      sleep: noSleep,
      dir,
    });
    expect(result).toEqual({ arrived: true, balanceAfterCents: 621 });
    expect(readSuspension(dir)).toBeNull();
  });

  it("accepts a little spending while the payment settles", async () => {
    const result = await confirmTopup(API, 5, 120, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => 120 + 470,
      sleep: noSleep,
      dir,
    });
    expect(result.arrived).toBe(true);
  });

  it("suspends every further topup when the credits do not arrive", async () => {
    const result = await confirmTopup(API, 5, 0, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => 0,
      sleep: noSleep,
      dir,
    });
    expect(result.arrived).toBe(false);

    const suspension = readSuspension(dir);
    expect(suspension?.amountUsd).toBe(5);
    expect(suspension?.balanceAfterCents).toBe(0);

    const next = await checkBeforeTopup(API, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => 0,
      dir,
    });
    expect(next.ok).toBe(false);
    if (!next.ok) expect(next.reason).toContain("automaton --resume-topups");
  });

  it("suspends when the balance becomes unreadable after paying", async () => {
    const result = await confirmTopup(API, 5, 100, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => {
        throw new Error("500 Database error");
      },
      sleep: noSleep,
      dir,
    });
    expect(result.arrived).toBe(false);
    expect(readSuspension(dir)?.reason).toContain("unreadable");
  });

  it("lifts a suspension on resume", async () => {
    await confirmTopup(API, 5, 0, {
      apiKey: "cnwy_k_test",
      readBalanceCents: async () => 0,
      sleep: noSleep,
      dir,
    });
    expect(resumeTopups(dir)?.amountUsd).toBe(5);
    expect(readSuspension(dir)).toBeNull();
    expect(resumeTopups(dir)).toBeNull();
  });
});
