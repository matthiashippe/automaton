import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "provision-verify-"));
const account = privateKeyToAccount(generatePrivateKey());

vi.mock("../identity/wallet.js", () => ({
  getAutomatonDir: () => dir,
  getWallet: async () => ({
    account,
    chainIdentity: { chainType: "evm", address: account.address },
    chainType: "evm",
    isNew: false,
  }),
}));

const { provision } = await import("../identity/provision.js");

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("provision against a failing verify", () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    delete process.env.CONWAY_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(path.join(dir, "automaton.json"), { force: true });
  });

  it("sends verify once and reports the real 500, not a nonce error", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      if (String(url).endsWith("/v1/auth/nonce")) return respond(200, { nonce: "abcdef0123456789" });
      if (String(url).endsWith("/v1/auth/verify")) return respond(500, { error: "Database error" });
      return respond(404, {});
    });

    await expect(provision("https://api.conway.tech")).rejects.toThrow(
      /SIWE verification failed: 500 \{"error":"Database error"\}/,
    );
    expect(calls.filter((u) => u.endsWith("/v1/auth/verify"))).toHaveLength(1);
  });

  it("tells the operator what to do when Conway's sign-up fails", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      String(url).endsWith("/v1/auth/nonce")
        ? respond(200, { nonce: "abcdef0123456789" })
        : respond(500, { error: "Database error" }),
    );
    await expect(provision("https://api.conway.tech")).rejects.toThrow(/automaton --setup/);
  });

  it("signs up with the control plane the wizard wrote into automaton.json", async () => {
    fs.writeFileSync(
      path.join(dir, "automaton.json"),
      JSON.stringify({ conwayApiUrl: "https://cp.example" }),
    );
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      return respond(400, { error: "bad request" });
    });
    await expect(provision()).rejects.toThrow();
    expect(calls[0]).toBe("https://cp.example/v1/auth/nonce");
  });
});
