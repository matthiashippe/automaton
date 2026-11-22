import { CodingHarness } from "./harnesses/coding-harness.js";
import { GeneralHarness } from "./harnesses/general-harness.js";
import { OrchestratorHarness } from "./harnesses/orchestrator-harness.js";
const DEFAULT_ROLE_MAP = {
    executor: CodingHarness,
    debugger: CodingHarness,
    architect: CodingHarness,
    "code-reviewer": CodingHarness,
    tester: CodingHarness,
    devops: CodingHarness,
    developer: CodingHarness,
    engineer: CodingHarness,
    orchestrator: OrchestratorHarness,
    planner: OrchestratorHarness,
    critic: OrchestratorHarness,
    coordinator: OrchestratorHarness,
    generalist: GeneralHarness,
    researcher: GeneralHarness,
    marketer: GeneralHarness,
    "social-manager": GeneralHarness,
    "domain-manager": GeneralHarness,
    "financial-analyst": GeneralHarness,
    writer: GeneralHarness,
    analyst: GeneralHarness,
};
export class HarnessRegistry {
    roleMap;
    fallback;
    constructor() {
        this.roleMap = new Map(Object.entries(DEFAULT_ROLE_MAP));
        this.fallback = GeneralHarness;
    }
    register(role, constructor) {
        this.roleMap.set(role.toLowerCase().trim(), constructor);
    }
    setFallback(constructor) {
        this.fallback = constructor;
    }
    createForRole(role) {
        const normalized = (role ?? "generalist").toLowerCase().trim();
        const Constructor = this.roleMap.get(normalized) ?? this.fallback;
        return new Constructor();
    }
    getHarnessIdForRole(role) {
        return this.createForRole(role).id;
    }
    listMappings() {
        const mappings = [];
        for (const [role, Constructor] of this.roleMap) {
            mappings.push({ role, harnessId: new Constructor().id });
        }
        return mappings;
    }
}
//# sourceMappingURL=harness-registry.js.map