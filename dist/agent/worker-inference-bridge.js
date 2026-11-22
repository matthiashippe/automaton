export function createWorkerInferenceBridge(inference) {
    return {
        chat: async (params) => {
            const response = await inference.chat({
                tier: normalizeTier(params.tier),
                messages: params.messages,
                tools: params.tools,
                toolChoice: params.toolChoice,
                maxTokens: params.maxTokens,
                temperature: params.temperature,
                responseFormat: normalizeResponseFormat(params.responseFormat),
            });
            return {
                content: response.content,
                toolCalls: response.toolCalls,
            };
        },
    };
}
function normalizeTier(tier) {
    return tier === "reasoning" || tier === "cheap" || tier === "fast"
        ? tier
        : "fast";
}
function normalizeResponseFormat(responseFormat) {
    if (!responseFormat) {
        return undefined;
    }
    return responseFormat.type === "json_object"
        ? { type: "json_object" }
        : { type: "text" };
}
//# sourceMappingURL=worker-inference-bridge.js.map