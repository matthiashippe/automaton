import { BaseHarness } from "./base-harness.js";
import type { HarnessTool } from "../harness-types.js";
export declare class GeneralHarness extends BaseHarness {
    readonly id = "general";
    readonly description = "General-purpose agent for research, web interaction, and non-coding execution tasks.";
    private transferToolCallCount;
    buildSystemPrompt(): string;
    protected beforeTurn(): void;
    getToolDefs(): HarnessTool[];
    private createWrappedTool;
    private createSpecAliasTools;
}
//# sourceMappingURL=general-harness.d.ts.map