/**
 * Pretty log sink
 *
 * Human-readable terminal output for --run mode.
 * Replaces raw JSON stdout with colored, structured log lines.
 * Register via: StructuredLogger.setSink(prettySink)
 */
import type { LogEntry } from "../types.js";
export declare function prettySink(entry: LogEntry): void;
//# sourceMappingURL=pretty-sink.d.ts.map