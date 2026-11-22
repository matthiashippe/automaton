/**
 * Ollama Model Discovery
 *
 * Fetches available models from a local Ollama instance and registers
 * them in the model registry so they can be used for inference.
 */
import type BetterSqlite3 from "better-sqlite3";
/**
 * Fetch all available models from Ollama's /api/tags endpoint
 * and upsert them into the model registry.
 *
 * Returns the list of discovered model IDs, or an empty array if
 * Ollama is unreachable (treated as a soft failure).
 */
export declare function discoverOllamaModels(baseUrl: string, db: BetterSqlite3.Database): Promise<string[]>;
//# sourceMappingURL=discover.d.ts.map