import type { TaskResult } from "../../orchestration/task-graph.js";
import { BaseHarness } from "./base-harness.js";
import type { HarnessTool } from "../harness-types.js";
export declare class CodingHarness extends BaseHarness {
    readonly id = "coding";
    readonly description = "Coding-focused agent for implementation, debugging, refactoring, and testing. No financial or social tools.";
    buildSystemPrompt(): string;
    getToolDefs(): HarnessTool[];
    execute(): Promise<TaskResult>;
    private compactContext;
}
//# sourceMappingURL=coding-harness.d.ts.map