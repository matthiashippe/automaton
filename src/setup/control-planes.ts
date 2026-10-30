/**
 * Control planes the setup wizard offers.
 *
 * The runtime needs a Conway-compatible control plane for sign-up, credits and paid inference.
 * Upstream hard-wired api.conway.tech, whose sign-up has failed for new wallets since July 2026
 * while its payment endpoint keeps taking money. This fork lets the operator choose, and offers a
 * way to run with no control plane at all, on a local model.
 */

/**
 * Where an automaton without a control plane points its Conway client: a loopback port nothing
 * listens on. Every call fails at once with "connection refused", nothing is ever signed, and the
 * router still admits free local models at any survival tier, so the agent keeps thinking.
 */
export const NO_CONTROL_PLANE_URL = "https://127.0.0.1:9";

export function isNoControlPlane(apiUrl: string | undefined): boolean {
  return apiUrl === NO_CONTROL_PLANE_URL;
}

export interface ControlPlaneChoice {
  key: string;
  label: string;
  url: string | null;
  note: string;
}

export const CONTROL_PLANE_CHOICES: ControlPlaneChoice[] = [
  {
    key: "1",
    label: "PostYourPrice",
    url: "https://postyourprice.com",
    note: "sign-up works, credits are paid per use in USDC (run by this fork's maintainer)",
  },
  {
    key: "2",
    label: "Conway",
    url: "https://api.conway.tech",
    note: "the original; sign-up has failed for new wallets since July 2026",
  },
  {
    key: "3",
    label: "Other",
    url: null,
    note: "any Conway-compatible control plane, including one you host yourself",
  },
  {
    key: "4",
    label: "None",
    url: NO_CONTROL_PLANE_URL,
    note: "think on a local model through Ollama, no payments at all",
  },
];

/** Model names an Ollama server offers, or an empty list when it cannot be reached. */
export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { models?: Array<{ name?: string; model?: string }> };
    return (data.models ?? []).map((m) => m.name || m.model || "").filter(Boolean);
  } catch {
    return [];
  }
}
