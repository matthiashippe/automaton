/**
 * The runtime's own name and version, read from package.json at runtime so that
 * `automaton --version`, the User-Agent and the release tag can never drift apart.
 * src/version.ts and dist/version.js both sit one directory below package.json.
 */
export declare const VERSION: string;
/** Sent on every request to the control plane, so it can tell who runs the maintained package. */
export declare const USER_AGENT: string;
//# sourceMappingURL=version.d.ts.map