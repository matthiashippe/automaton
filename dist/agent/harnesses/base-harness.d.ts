import type { ChatMessage } from "../../types.js";
import type { TaskNode, TaskResult } from "../../orchestration/task-graph.js";
import { LoopDetector } from "../loop-detector.js";
import type { AgentHarness, HarnessContext, HarnessTool } from "../harness-types.js";
export declare abstract class BaseHarness implements AgentHarness {
    abstract readonly id: string;
    abstract readonly description: string;
    protected task: TaskNode;
    protected context: HarnessContext;
    protected loopDetector: LoopDetector;
    protected messages: ChatMessage[];
    protected artifacts: string[];
    initialize(task: TaskNode, context: HarnessContext): Promise<void>;
    abstract getToolDefs(): HarnessTool[];
    abstract buildSystemPrompt(): string;
    protected beforeTurn(): void;
    buildTaskPrompt(): string;
    execute(): Promise<TaskResult>;
    private checkBudget;
}
//# sourceMappingURL=base-harness.d.ts.map