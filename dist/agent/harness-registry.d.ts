import type { AgentHarness } from "./harness-types.js";
type HarnessConstructor = new () => AgentHarness;
export declare class HarnessRegistry {
    private readonly roleMap;
    private fallback;
    constructor();
    register(role: string, constructor: HarnessConstructor): void;
    setFallback(constructor: HarnessConstructor): void;
    createForRole(role: string | null | undefined): AgentHarness;
    getHarnessIdForRole(role: string | null | undefined): string;
    listMappings(): Array<{
        role: string;
        harnessId: string;
    }>;
}
export {};
//# sourceMappingURL=harness-registry.d.ts.map