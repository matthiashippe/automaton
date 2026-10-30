import { describe, it, expect, afterEach, vi } from "vitest";
import {
  CONTROL_PLANE_CHOICES,
  NO_CONTROL_PLANE_URL,
  isNoControlPlane,
  listOllamaModels,
} from "../setup/control-planes.js";
import { createConfig } from "../config.js";

describe("control plane choices", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers a working control plane first and says plainly that Conway's sign-up fails", () => {
    expect(CONTROL_PLANE_CHOICES[0].url).toBe("https://postyourprice.com");
    const conway = CONTROL_PLANE_CHOICES.find((c) => c.url === "https://api.conway.tech");
    expect(conway?.note).toMatch(/failed/);
  });

  it("points an automaton without a control plane at a port that refuses at once", () => {
    expect(isNoControlPlane(NO_CONTROL_PLANE_URL)).toBe(true);
    expect(isNoControlPlane("https://postyourprice.com")).toBe(false);
    expect(NO_CONTROL_PLANE_URL.startsWith("https://127.0.0.1:")).toBe(true);
  });

  it("lists the models an Ollama server offers", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ models: [{ name: "qwen2.5-coder:32b" }, { model: "llama3.3" }] })),
    );
    expect(await listOllamaModels("http://127.0.0.1:11434/")).toEqual(["qwen2.5-coder:32b", "llama3.3"]);
  });

  it("returns no models when Ollama is not there", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("connect ECONNREFUSED");
    });
    expect(await listOllamaModels("http://127.0.0.1:11434")).toEqual([]);
  });

  it("writes the chosen control plane and a local model into the config the router reads", () => {
    const config = createConfig({
      name: "t",
      genesisPrompt: "g",
      creatorAddress: "0x0000000000000000000000000000000000000001",
      registeredWithConway: false,
      sandboxId: "",
      walletAddress: "0x0000000000000000000000000000000000000002",
      apiKey: "",
      conwayApiUrl: NO_CONTROL_PLANE_URL,
      modelStrategy: { inferenceModel: "qwen2.5-coder:32b", lowComputeModel: "qwen2.5-coder:32b", criticalModel: "qwen2.5-coder:32b" },
    });
    expect(config.conwayApiUrl).toBe(NO_CONTROL_PLANE_URL);
    expect(config.modelStrategy?.inferenceModel).toBe("qwen2.5-coder:32b");
    expect(config.modelStrategy?.criticalModel).toBe("qwen2.5-coder:32b");
    expect(config.modelStrategy?.maxTokensPerTurn).toBe(4096);
  });
});
