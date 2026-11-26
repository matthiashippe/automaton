/**
 * The card line: the one sentence that tells the human behind an automaton without credits how to
 * pay without crypto. It is only ever written with automatonhost.com as the control plane, on its
 * own log line, and never reaches the model's prompt.
 */

import { describe, it, expect, afterEach } from "vitest";
import { CardLineNotifier, CARD_LINE_INTERVAL_MS, statusCardLine } from "../survival/card-line.js";
import { runAgentLoop } from "../agent/loop.js";
import { StructuredLogger } from "../observability/logger.js";
import {
  MockConwayClient,
  MockInferenceClient,
  createTestConfig,
  createTestDb,
  createTestIdentity,
} from "./mocks.js";
import type { ChatMessage, InferenceOptions, InferenceResponse, LogEntry } from "../types.js";

// A fake wallet in mixed case, so a test can see that the link carries it lowercased.
const WALLET = ("0x" + "aB".repeat(20)) as `0x${string}`;
const WALLET_LOWER = "0x" + "ab".repeat(20);
const OWN_LINK = `https://automatonhost.com/card/5?address=${WALLET_LOWER}`;
const SENTENCE = "No crypto needed: pay by card, PayPal or Apple Pay at ";
const HOST = "https://automatonhost.com";

/** The message the inference client throws for a 402, as src/conway/inference.ts builds it. */
function insufficientCredits(cardUrl?: string): Error {
  const body = {
    error: "INSUFFICIENT_CREDITS",
    message: "Insufficient credits: need 2 cents, have 0 cents.",
    details: {
      required_cents: 2,
      current_balance_cents: 0,
      model: "gpt-5-mini",
      ...(cardUrl ? { card_url: cardUrl } : {}),
      topup_url: `https://automatonhost.com/pay/5/${WALLET_LOWER}`,
      wallet: WALLET_LOWER,
    },
  };
  return new Error(`Inference error (conway): 402: ${JSON.stringify(body)}`);
}

function notifier(conwayApiUrl: string | undefined, clock = { now: 1_000_000 }) {
  const lines: string[] = [];
  const card = new CardLineNotifier({
    conwayApiUrl,
    address: WALLET,
    log: (line) => lines.push(line),
    now: () => clock.now,
  });
  return { card, lines, clock };
}

describe("card line", () => {
  afterEach(() => StructuredLogger.resetSink());

  it("start with an empty balance names the link of the own wallet, lowercased", () => {
    for (const tier of ["critical", "dead"] as const) {
      const { card, lines } = notifier(HOST);
      card.onTier(tier);
      expect(lines).toEqual([SENTENCE + OWN_LINK]);
    }
    const { card, lines } = notifier(HOST);
    card.onTier("normal");
    card.onTier("low_compute");
    expect(lines).toEqual([]);
  });

  it("entering critical or dead writes it once, staying there does not", () => {
    const { card, lines } = notifier(HOST);
    card.onTier("normal");
    card.onTier("critical");
    card.onTier("critical");
    card.onTier("critical");
    expect(lines).toEqual([SENTENCE + OWN_LINK]);
    card.onTier("low_compute");
    card.onTier("dead");
    expect(lines).toEqual([SENTENCE + OWN_LINK, SENTENCE + OWN_LINK]);
  });

  it("a 402 with card_url names exactly that link", () => {
    const { card, lines } = notifier(HOST);
    const link = `https://automatonhost.com/card/5?address=${WALLET_LOWER}&from=402`;
    card.onInferenceError(insufficientCredits(link));
    expect(lines).toEqual([SENTENCE + link]);
  });

  it("a 402 without card_url writes no line", () => {
    const { card, lines } = notifier(HOST);
    card.onInferenceError(insufficientCredits());
    card.onInferenceError(new Error("Inference error (conway): 500: Database error"));
    card.onInferenceError(new Error(`Inference error (conway): 402: {"error":"OTHER","details":{"card_url":"${OWN_LINK}"}}`));
    card.onInferenceError(new Error("Inference error (conway): 402: not json INSUFFICIENT_CREDITS"));
    expect(lines).toEqual([]);
    // None of them used up the hour: the next 402 that does carry a card_url is written.
    card.onInferenceError(insufficientCredits(OWN_LINK));
    expect(lines).toEqual([SENTENCE + OWN_LINK]);
  });

  it("with conwayApiUrl https://api.conway.tech no line anywhere", () => {
    for (const url of ["https://api.conway.tech", undefined, "", "http://127.0.0.1:9", "https://automatonhost.com.evil.example"]) {
      const { card, lines } = notifier(url);
      card.onTier("critical");
      card.onTier("normal");
      card.onTier("dead");
      card.onInferenceError(insufficientCredits(OWN_LINK));
      expect(lines).toEqual([]);
      expect(statusCardLine({ conwayApiUrl: url, walletAddress: WALLET }, "critical")).toBeNull();
      expect(statusCardLine({ conwayApiUrl: url, walletAddress: WALLET }, "dead")).toBeNull();
    }
    // A trailing slash is still automatonhost.com.
    const { card, lines } = notifier(HOST + "/");
    card.onTier("critical");
    expect(lines).toEqual([SENTENCE + OWN_LINK]);
  });

  it("a second 402 within one hour writes no second line, after one hour again one", () => {
    const { card, lines, clock } = notifier(HOST);
    card.onInferenceError(insufficientCredits(OWN_LINK));
    expect(lines).toHaveLength(1);
    clock.now += CARD_LINE_INTERVAL_MS - 1;
    card.onInferenceError(insufficientCredits(OWN_LINK));
    expect(lines).toHaveLength(1);
    clock.now += 1;
    card.onInferenceError(insufficientCredits(OWN_LINK));
    expect(lines).toEqual([SENTENCE + OWN_LINK, SENTENCE + OWN_LINK]);
    expect(CARD_LINE_INTERVAL_MS).toBe(60 * 60 * 1000);
  });

  it("--status in state critical shows it, in state running not", () => {
    const config = { conwayApiUrl: HOST, walletAddress: WALLET };
    expect(statusCardLine(config, "critical")).toBe(SENTENCE + OWN_LINK);
    expect(statusCardLine(config, "dead")).toBe(SENTENCE + OWN_LINK);
    expect(statusCardLine(config, "running")).toBeNull();
    expect(statusCardLine(config, "low_compute")).toBeNull();
    expect(statusCardLine(config, "sleeping")).toBeNull();
  });

  it("the agent loop writes it on its own line, next to the unchanged error line, never to the model", async () => {
    const messages: string[] = [];
    StructuredLogger.setSink((entry: LogEntry) => messages.push(entry.message));

    const db = createTestDb();
    const conway = new MockConwayClient();
    conway.creditsCents = 0;
    const identity = { ...createTestIdentity(), address: WALLET };
    const config = createTestConfig({ conwayApiUrl: HOST, walletAddress: WALLET });
    const link = `https://automatonhost.com/card/5?address=${WALLET_LOWER}&from=402`;
    const error = insufficientCredits(link);
    const prompts: string[] = [];
    const inference = new (class extends MockInferenceClient {
      async chat(msgs: ChatMessage[], _options?: InferenceOptions): Promise<InferenceResponse> {
        prompts.push(JSON.stringify(msgs));
        throw error;
      }
    })();

    try {
      await runAgentLoop({ identity, config, db, conway, inference });
    } finally {
      db.close();
    }

    // Once at start (first balance read is critical), once for the first 402; the other four 402
    // of this loop fall within the hour.
    expect(messages.filter((m) => m.includes("No crypto needed"))).toEqual([SENTENCE + OWN_LINK, SENTENCE + link]);
    expect(messages).toContain(`[ERROR] Turn failed: ${error.message}`);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.some((p) => p.includes("No crypto needed"))).toBe(false);
  });
});
