import type { UnifiedInferenceClient } from "../inference/inference-client.js";
import type { WorkerInferenceClient } from "./harness-types.js";
export declare function createWorkerInferenceBridge(inference: Pick<UnifiedInferenceClient, "chat">): WorkerInferenceClient;
//# sourceMappingURL=worker-inference-bridge.d.ts.map