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
export declare const NO_CONTROL_PLANE_URL = "https://127.0.0.1:9";
export declare function isNoControlPlane(apiUrl: string | undefined): boolean;
export interface ControlPlaneChoice {
    key: string;
    label: string;
    url: string | null;
    note: string;
}
export declare const CONTROL_PLANE_CHOICES: ControlPlaneChoice[];
/** The choice setup offers first, and takes when the operator just presses Enter. */
export declare const DEFAULT_CONTROL_PLANE_KEY: string;
/** The choice behind what the operator typed at the prompt; empty input means the default. */
export declare function resolveControlPlaneChoice(input: string): ControlPlaneChoice | undefined;
/** Model names an Ollama server offers, or an empty list when it cannot be reached. */
export declare function listOllamaModels(baseUrl: string): Promise<string[]>;
//# sourceMappingURL=control-planes.d.ts.map