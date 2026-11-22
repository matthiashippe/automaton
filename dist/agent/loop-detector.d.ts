export interface LoopDetectorConfig {
    maxIdenticalCalls: number;
    maxIdleOnlyTurns: number;
    windowSize: number;
}
export interface LoopCheckResult {
    blocked: boolean;
    reason: string;
}
export declare class LoopDetector {
    private readonly config;
    private callHistory;
    private turnPatterns;
    private currentTurnTools;
    private patternWarningIssued;
    private consecutiveIdleOnlyTurns;
    private currentTurnIsIdleOnly;
    constructor(config?: Partial<LoopDetectorConfig>);
    recordToolCall(name: string, args: string): LoopCheckResult;
    endTurn(): LoopCheckResult;
    reset(): void;
}
//# sourceMappingURL=loop-detector.d.ts.map