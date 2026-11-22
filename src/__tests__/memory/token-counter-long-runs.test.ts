import { describe, it, expect } from "vitest";
import { getEncoding } from "js-tiktoken";
import { createTokenCounter } from "../../memory/context-manager.js";
import { estimateTokens } from "../../agent/context.js";

// js-tiktoken merges one pre-tokenized piece in quadratic time. A long run of letters with no
// space in it (minified code, a hash dump, a model that stopped putting spaces in) is one piece:
// 32,000 letters took a minute, and the 500,000 in context-hardening.test.ts never finished, so
// that whole file hung at load and the agent loop would hang the same way on such a tool result.
describe("token counter on long runs without whitespace", () => {
  it("counts 200,000 letters without a space in seconds, not hours", () => {
    const counter = createTokenCounter();
    const started = Date.now();
    const count = counter.countTokens("x".repeat(200_000));
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(count).toBeGreaterThan(0);
  });

  it("keeps the agent's context estimate from hanging on such a turn", () => {
    const started = Date.now();
    expect(estimateTokens("y".repeat(200_000))).toBeGreaterThanOrEqual(50_000);
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  it("counts ordinary text exactly as the encoder does", () => {
    const text = "The automaton signs in with its wallet, tops up credits and thinks. ".repeat(500);
    expect(createTokenCounter().countTokens(text)).toBe(getEncoding("cl100k_base").encode(text).length);
  });

  it("never counts a long run lower than the encoder would", () => {
    const run = "ab".repeat(600);
    const exact = getEncoding("cl100k_base").encode(run).length;
    expect(createTokenCounter().countTokens(run)).toBeGreaterThanOrEqual(exact);
  });
});
