import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { VERSION, USER_AGENT } from "../version.js";
import { ResilientHttpClient } from "../conway/http-client.js";
import { defaultGuardDeps } from "../conway/topup.js";
import { ProviderRegistry } from "../inference/provider-registry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

describe("the maintained package names itself", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("takes its version from package.json", () => {
    expect(pkg.name).toBe("automaton-maintained");
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+-maintained\.\d+$/);
    expect(USER_AGENT).toBe(`automaton-maintained/${pkg.version}`);
  });

  it("sends its User-Agent on every request of the Conway client", async () => {
    const seen: Array<string | null> = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      seen.push(headerOf(init, "user-agent"));
      return new Response("{}", { status: 200 });
    });
    const client = new ResilientHttpClient();
    await client.request("https://automatonhost.com/v1/auth/nonce", { method: "POST" });
    await client.request("https://automatonhost.com/v1/credits/balance", {
      headers: { Authorization: "key", "Content-Type": "application/json" },
      idempotencyKey: "k1",
    });
    expect(seen).toEqual([USER_AGENT, USER_AGENT]);
  });

  it("sends it when the topup guard reads the balance", async () => {
    let seen: string | null = null;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      seen = headerOf(init, "user-agent");
      return new Response(JSON.stringify({ balance_cents: 42 }), { status: 200 });
    });
    expect(await defaultGuardDeps("https://automatonhost.com").readBalanceCents()).toBe(42);
    expect(seen).toBe(USER_AGENT);
  });

  it("sends it on inference through the control plane", async () => {
    let seen: string | null = null;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      seen = headerOf(init, "user-agent");
      return new Response(
        JSON.stringify({
          id: "c1",
          object: "chat.completion",
          created: 0,
          model: "gpt-4.1",
          choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const registry = ProviderRegistry.fromConfig(path.join(root, "does-not-exist.json"));
    registry.overrideBaseUrl("openai", "https://automatonhost.com/v1");
    const { client } = registry.getModel("openai", "gpt-4.1");
    await client.chat.completions.create({ model: "gpt-4.1", messages: [{ role: "user", content: "hi" }] });
    expect(seen).toBe(USER_AGENT);
  });

  it("prints the package version for automaton --version", () => {
    const run = spawnSync(process.execPath, ["--import", "tsx", path.join(root, "src/index.ts"), "--version"], {
      cwd: root,
      encoding: "utf-8",
      timeout: 60_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe(`automaton-maintained ${pkg.version}`);
  });
});
