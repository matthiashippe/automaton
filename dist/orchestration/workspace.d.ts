export interface WorkspaceFile {
    path: string;
    agentRole: string;
    size: number;
    tokenEstimate: number;
    createdAt: string;
    summary?: string;
}
export interface AgentWorkspace {
    goalId: string;
    basePath: string;
    writeOutput(agentRole: string, filename: string, content: string): string;
    readOutput(filename: string): string;
    listOutputs(): WorkspaceFile[];
    logDecision(decision: string, rationale: string, agentRole: string): void;
    getSummary(): string;
}
export declare class AgentWorkspace implements AgentWorkspace {
    goalId: string;
    basePath: string;
    private readonly outputsPath;
    private readonly contextPath;
    private readonly checkpointsPath;
    private readonly decisionsPath;
    private readonly metadataByFile;
    constructor(goalId: string, basePath?: string);
    private resolveOutputPath;
    private toRelativeOutputName;
}
export declare function createWorkspace(goalId: string): AgentWorkspace;
//# sourceMappingURL=workspace.d.ts.map