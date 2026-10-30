import { describe, it, expect } from "vitest";
import { buildContextMessages } from "../agent/context.js";
import type { AgentTurn } from "../types.js";

// Kept apart from context-hardening.test.ts, which hangs while loading at upstream d8f8168 as well
// (measured: both copies time out after 400 s without running a test), so a test placed there
// never runs.
describe("buildContextMessages with tool-only turns", () => {
  it("renders tool-only turns (empty thinking) with their tool calls and results", () => {
    const turn: AgentTurn = {
      id: "t-tool-only",
      timestamp: new Date().toISOString(),
      state: "running",
      thinking: "",
      toolCalls: [
        { id: "call_1", name: "exec", arguments: { command: "ls" }, result: "alpha.txt\nbeta.json" },
      ],
    } as unknown as AgentTurn;
    const messages = buildContextMessages("SYSTEM", [turn]);
    const assistant = messages.find((m) => m.role === "assistant");
    expect(assistant).toBeDefined();
    expect(assistant!.tool_calls?.[0]?.function.name).toBe("exec");
    const toolMsg = messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg!.content).toContain("alpha.txt");
    expect((toolMsg as any).tool_call_id).toBe("call_1");
  });
});
