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
export function isNoControlPlane(apiUrl) {
    return apiUrl === NO_CONTROL_PLANE_URL;
}
export const CONTROL_PLANE_CHOICES = [
    {
        key: "1",
        label: "automatonhost.com",
        url: "https://automatonhost.com",
        note: "sign-up works, credits in USDC, paid per use (run by this fork's maintainer)",
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
/** The choice setup offers first, and takes when the operator just presses Enter. */
export const DEFAULT_CONTROL_PLANE_KEY = CONTROL_PLANE_CHOICES[0].key;
/** The choice behind what the operator typed at the prompt; empty input means the default. */
export function resolveControlPlaneChoice(input) {
    const key = input.trim() || DEFAULT_CONTROL_PLANE_KEY;
    return CONTROL_PLANE_CHOICES.find((c) => c.key === key);
}
/** Model names an Ollama server offers, or an empty list when it cannot be reached. */
export async function listOllamaModels(baseUrl) {
    try {
        const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
            signal: AbortSignal.timeout(5_000),
        });
        if (!resp.ok)
            return [];
        const data = (await resp.json());
        return (data.models ?? []).map((m) => m.name || m.model || "").filter(Boolean);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=control-planes.js.map