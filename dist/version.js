/**
 * The runtime's own name and version, read from package.json at runtime so that
 * `automaton --version`, the User-Agent and the release tag can never drift apart.
 * src/version.ts and dist/version.js both sit one directory below package.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
function readVersion() {
    try {
        const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        return pkg.version || "0.0.0";
    }
    catch {
        return "0.0.0";
    }
}
export const VERSION = readVersion();
/** Sent on every request to the control plane, so it can tell who runs the maintained package. */
export const USER_AGENT = `automaton-maintained/${VERSION}`;
//# sourceMappingURL=version.js.map