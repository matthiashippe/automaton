import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "default-control-plane-"));
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

const { loadConfig, createConfig } = await import("../config.js");
const { provision } = await import("../identity/provision.js");
const { DEFAULT_CONFIG } = await import("../types.js");
const { CONTROL_PLANE_CHOICES, resolveControlPlaneChoice } = await import("../setup/control-planes.js");

const OURS = "https://automatonhost.com";
const CONWAY = "https://api.conway.tech";

function writeConfig(fields: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, "automaton.json"), JSON.stringify({ name: "t", ...fields }));
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("default control plane", () => {
  beforeEach(() => {
    delete process.env.CONWAY_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CONWAY_API_URL;
    fs.rmSync(path.join(dir, "automaton.json"), { force: true });
  });

  it("defaults to automatonhost.com", () => {
    expect(DEFAULT_CONFIG.conwayApiUrl).toBe(OURS);
  });

  it("writes automatonhost.com into a fresh config when setup names no control plane", () => {
    const config = createConfig({
      name: "t",
      genesisPrompt: "g",
      creatorAddress: "0x0000000000000000000000000000000000000001",
      registeredWithConway: false,
      sandboxId: "",
      walletAddress: "0x0000000000000000000000000000000000000002",
      apiKey: "",
    });
    expect(config.conwayApiUrl).toBe(OURS);
  });

  it("uses automatonhost.com for a saved config that names no control plane", () => {
    writeConfig({});
    expect(loadConfig()?.conwayApiUrl).toBe(OURS);
  });

  it("keeps a saved choice, even Conway, and never rewrites it", () => {
    writeConfig({ conwayApiUrl: CONWAY });
    expect(loadConfig()?.conwayApiUrl).toBe(CONWAY);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "automaton.json"), "utf-8")).conwayApiUrl).toBe(CONWAY);
  });

  it("lets CONWAY_API_URL win over the saved choice and the default", () => {
    writeConfig({ conwayApiUrl: CONWAY });
    process.env.CONWAY_API_URL = "https://cp.example";
    expect(loadConfig()?.conwayApiUrl).toBe("https://cp.example");
  });

  it("picks automatonhost.com when the operator just presses Enter in setup", () => {
    expect(CONTROL_PLANE_CHOICES[0].url).toBe(OURS);
    expect(CONTROL_PLANE_CHOICES[0].label).toBe("automatonhost.com");
    expect(resolveControlPlaneChoice("")?.url).toBe(OURS);
    expect(resolveControlPlaneChoice("  ")?.url).toBe(OURS);
    expect(resolveControlPlaneChoice("2")?.url).toBe(CONWAY);
    expect(resolveControlPlaneChoice("9")).toBeUndefined();
  });

  it("signs up at automatonhost.com when nothing else is set", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      return respond(400, { error: "bad request" });
    });
    await expect(provision()).rejects.toThrow();
    expect(calls[0]).toBe(`${OURS}/v1/auth/nonce`);
  });

  it("names the setup command and automatonhost.com when sign-up at Conway fails", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      String(url).endsWith("/v1/auth/nonce")
        ? respond(200, { nonce: "abcdef0123456789" })
        : respond(500, { error: "Database error" }),
    );
    const failure = provision(CONWAY);
    await expect(failure).rejects.toThrow(/node dist\/index\.js --setup/);
    await expect(provision(CONWAY)).rejects.toThrow(/https:\/\/automatonhost\.com/);
  });
});
