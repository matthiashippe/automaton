/**
 * Enhanced memory retrieval with metadata-based relevance scoring.
 *
 * This module intentionally does NOT use embeddings/vector search.
 */
import { estimateTokens } from "../agent/context.js";
import { KnowledgeStore, } from "./knowledge-store.js";
import { MemoryRetriever } from "./retrieval.js";
const RECENCY_WEIGHT = 0.3;
const FREQUENCY_WEIGHT = 0.2;
const CONFIDENCE_WEIGHT = 0.2;
const TASK_AFFINITY_WEIGHT = 0.2;
const CATEGORY_MATCH_WEIGHT = 0.1;
const MAX_ROLLING_FEEDBACK_WINDOW = 20;
const MIN_MEMORY_BUDGET = 2_000;
const MAX_MEMORY_BUDGET = 20_000;
const KNOWLEDGE_SEARCH_LIMIT = 50;
const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "we",
    "what",
    "when",
    "where",
    "who",
    "why",
    "with",
]);
const ABBREVIATION_EXPANSIONS = {
    aa: ["account abstraction"],
    api: ["application programming interface"],
    ci: ["continuous integration"],
    cd: ["continuous deployment"],
    db: ["database"],
    llm: ["large language model"],
    mcp: ["model context protocol"],
    pnl: ["profit and loss"],
    qa: ["quality assurance"],
    rag: ["retrieval augmented generation"],
    sre: ["site reliability engineering"],
    ts: ["typescript"],
    ui: ["user interface"],
    ux: ["user experience"],
};
const CATEGORY_KEYWORDS = {
    market: ["market", "competitor", "pricing", "trend", "demand"],
    technical: ["code", "bug", "api", "database", "architecture", "deploy", "infra"],
    social: ["community", "user", "customer", "support", "feedback", "partner"],
    financial: ["revenue", "cost", "budget", "finance", "profit", "loss", "invoice"],
    operational: ["process", "runbook", "incident", "handoff", "workflow", "sla"],
};
const feedbackPrecisionWindow = [];
const feedbackByTurn = new Map();
let lastRollingPrecision;
let feedbackDb = null;
export function calculateMemoryBudget(utilization, tokensAfterSystemPrompt) {
    let ratio = 0.1;
    if (utilization.utilizationPercent > 70) {
        ratio = 0.05;
    }
    else if (utilization.utilizationPercent < 50) {
        ratio = 0.15;
    }
    const rawBudget = Math.floor(Math.max(0, tokensAfterSystemPrompt) * ratio);
    return clampNumber(rawBudget, MIN_MEMORY_BUDGET, MAX_MEMORY_BUDGET);
}
export function enhanceQuery(params) {
    const currentInput = params.currentInput ?? "";
    const taskSpec = params.taskSpec ?? "";
    const recentGoals = params.recentGoals ?? [];
    const allText = [currentInput, taskSpec, ...recentGoals]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join(" ");
    const terms = dedupeStrings([
        ...extractTerms(currentInput),
        ...extractTerms(taskSpec),
        ...recentGoals.map((goal) => goal.trim().toLowerCase()).filter(Boolean),
    ]);
    const expandedTerms = dedupeStrings(expandAbbreviations(terms)).slice(0, 25);
    const categories = dedupeCategories([
        ...categoriesFromRole(params.agentRole),
        ...categoriesFromText(allText),
    ]);
    const timeRange = inferTimeRange(allText);
    return {
        terms: expandedTerms,
        categories,
        ...(timeRange ? { timeRange } : {}),
    };
}
export function recordRetrievalFeedback(feedback) {
    const retrieved = dedupeStrings(feedback.retrieved).filter((id) => id.length > 0);
    const retrievedSet = new Set(retrieved);
    let matched = dedupeStrings(feedback.matched).filter((id) => retrievedSet.has(id));
    // If DB context is available, perform substring matching against the turn response.
    if (feedbackDb && retrieved.length > 0) {
        const response = getTurnResponse(feedbackDb, feedback.turnId);
        if (response.length > 0) {
            const autoMatched = matchRetrievedKnowledgeInResponse(feedbackDb, retrieved, response);
            if (autoMatched.length > 0) {
                matched = dedupeStrings([...matched, ...autoMatched]).filter((id) => retrievedSet.has(id));
                incrementKnowledgeAccessCount(feedbackDb, autoMatched);
            }
        }
    }
    const retrievalPrecision = retrieved.length === 0
        ? 0
        : matched.length / retrieved.length;
    const rollingPrecision = pushRollingPrecision(retrievalPrecision);
    feedbackByTurn.set(feedback.turnId, {
        turnId: feedback.turnId,
        retrieved,
        matched,
        retrievalPrecision,
        rollingPrecision,
    });
}
export class EnhancedRetriever extends MemoryRetriever {
    db;
    knowledgeStore;
    taskStore;
    constructor(db, budget, taskStore) {
        super(db, budget);
        this.db = db;
        this.taskStore = taskStore;
        this.knowledgeStore = new KnowledgeStore(db);
        feedbackDb = db;
    }
    retrieveScored(params) {
        const taskSpec = this.resolveTaskSpec(params.currentTaskId);
        const recentGoals = this.resolveRecentGoals(params.currentGoalId);
        const query = enhanceQuery({
            currentInput: params.currentInput ?? "",
            taskSpec,
            agentRole: params.agentRole,
            recentGoals,
        });
        const candidates = this.collectKnowledgeCandidates(query);
        const scored = candidates
            .map((entry) => {
            const scoringFactors = this.computeScoringFactors(entry, query, params);
            const relevanceScore = clamp01((scoringFactors.recency * RECENCY_WEIGHT)
                + (scoringFactors.frequency * FREQUENCY_WEIGHT)
                + (scoringFactors.confidence * CONFIDENCE_WEIGHT)
                + (scoringFactors.taskAffinity * TASK_AFFINITY_WEIGHT)
                + (scoringFactors.categoryMatch * CATEGORY_MATCH_WEIGHT));
            return {
                entry,
                relevanceScore,
                scoringFactors,
            };
        })
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        if (scored.length === 0 || scored[0].relevanceScore < 0.3) {
            return this.buildResult([], 0, false);
        }
        const budgetTokens = Math.max(0, Math.floor(params.budgetTokens));
        if (budgetTokens === 0) {
            return this.buildResult([], 0, scored.length > 0);
        }
        const selected = [];
        let totalTokens = 0;
        let truncated = false;
        for (const candidate of scored) {
            const entryTokens = this.resolveEntryTokenCount(candidate.entry);
            if (entryTokens <= 0)
                continue;
            if (totalTokens + entryTokens > budgetTokens) {
                truncated = true;
                continue;
            }
            selected.push(candidate);
            totalTokens += entryTokens;
        }
        return this.buildResult(selected, totalTokens, truncated);
    }
    recordRetrievalFeedback(feedback) {
        recordRetrievalFeedback(feedback);
    }
    buildResult(entries, totalTokens, truncated) {
        const result = {
            entries,
            totalTokens,
            truncated,
        };
        if (lastRollingPrecision !== undefined) {
            result.retrievalPrecision = lastRollingPrecision;
        }
        return result;
    }
    collectKnowledgeCandidates(query) {
        const byId = new Map();
        if (query.terms.length === 0) {
            for (const category of query.categories) {
                for (const entry of this.knowledgeStore.getByCategory(category)) {
                    byId.set(entry.id, entry);
                }
            }
        }
        else {
            for (const term of query.terms) {
                const results = this.searchTermAcrossCategories(term, query.categories);
                for (const entry of results) {
                    byId.set(entry.id, entry);
                }
            }
        }
        let entries = [...byId.values()];
        if (query.timeRange?.since) {
            const sinceMs = Date.parse(query.timeRange.since);
            if (!Number.isNaN(sinceMs)) {
                entries = entries.filter((entry) => {
                    const referenceTime = Date.parse(entry.lastVerified || entry.createdAt);
                    return !Number.isNaN(referenceTime) && referenceTime >= sinceMs;
                });
            }
        }
        return entries;
    }
    searchTermAcrossCategories(term, categories) {
        if (term.trim().length === 0)
            return [];
        if (categories.length === 0) {
            return this.knowledgeStore.search(term, undefined, KNOWLEDGE_SEARCH_LIMIT);
        }
        const results = [];
        for (const category of categories) {
            results.push(...this.knowledgeStore.search(term, category, KNOWLEDGE_SEARCH_LIMIT));
        }
        return results;
    }
    computeScoringFactors(entry, query, params) {
        const recency = recencyScore(entry.lastVerified || entry.createdAt);
        const frequency = frequencyScore(entry.accessCount);
        const confidence = clamp01(entry.confidence);
        const taskAffinity = taskAffinityScore(entry, params);
        const categoryMatch = categoryMatchScore(entry.category, query.categories);
        return {
            recency,
            frequency,
            confidence,
            taskAffinity,
            categoryMatch,
        };
    }
    resolveEntryTokenCount(entry) {
        if (entry.tokenCount > 0)
            return entry.tokenCount;
        return estimateTokens(`${entry.key}\n${entry.content}`);
    }
    resolveTaskSpec(currentTaskId) {
        if (!this.taskStore || !currentTaskId)
            return undefined;
        try {
            if (typeof this.taskStore.getTaskSpec === "function") {
                const spec = this.taskStore.getTaskSpec(currentTaskId);
                if (typeof spec === "string" && spec.trim().length > 0)
                    return spec.trim();
            }
            if (typeof this.taskStore.getTask === "function") {
                const task = this.taskStore.getTask(currentTaskId);
                if (isRecord(task)) {
                    const title = toOptionalString(task.title);
                    const description = toOptionalString(task.description);
                    const spec = toOptionalString(task.spec);
                    return [title, description, spec]
                        .filter((part) => Boolean(part && part.trim().length > 0))
                        .join("\n")
                        .trim() || undefined;
                }
            }
        }
        catch {
            return undefined;
        }
        return undefined;
    }
    resolveRecentGoals(currentGoalId) {
        const goals = new Set();
        if (currentGoalId && currentGoalId.trim().length > 0) {
            goals.add(currentGoalId.trim());
        }
        if (!this.taskStore) {
            return goals.size > 0 ? [...goals] : undefined;
        }
        try {
            if (typeof this.taskStore.getRecentGoals === "function") {
                const recentGoals = this.taskStore.getRecentGoals(5);
                for (const goal of toStringArray(recentGoals)) {
                    goals.add(goal);
                }
            }
        }
        catch {
            // Ignore optional task store failures.
        }
        return goals.size > 0 ? [...goals].slice(0, 5) : undefined;
    }
}
function recencyScore(isoTime) {
    const ts = Date.parse(isoTime);
    if (Number.isNaN(ts))
        return 0.5;
    const ageMs = Math.max(0, Date.now() - ts);
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    return clamp01(Math.exp(-ageDays / 30));
}
function frequencyScore(accessCount) {
    if (accessCount <= 0)
        return 0;
    return clamp01(1 - Math.exp(-accessCount / 5));
}
function taskAffinityScore(entry, params) {
    const haystack = normalizeForMatch(`${entry.key} ${entry.content} ${entry.source}`);
    const affinityTerms = dedupeStrings([
        ...extractTerms(params.currentInput ?? ""),
        params.currentTaskId?.trim().toLowerCase() ?? "",
        params.currentGoalId?.trim().toLowerCase() ?? "",
    ]).filter(Boolean);
    if (affinityTerms.length === 0)
        return 0.5;
    let matches = 0;
    for (const term of affinityTerms) {
        if (term.length >= 2 && haystack.includes(term)) {
            matches += 1;
        }
    }
    return clamp01(matches / affinityTerms.length);
}
function categoryMatchScore(category, categories) {
    if (categories.length === 0)
        return 0.5;
    return categories.includes(category) ? 1 : 0;
}
function categoriesFromRole(agentRole) {
    if (!agentRole)
        return [];
    const normalized = agentRole.toLowerCase();
    if (includesAny(normalized, ["finance", "treasury", "accounting", "billing"])) {
        return ["financial", "market"];
    }
    if (includesAny(normalized, ["research", "analyst", "strategist"])) {
        return ["market", "technical", "social"];
    }
    if (includesAny(normalized, ["engineer", "developer", "architect", "sre", "devops"])) {
        return ["technical", "operational"];
    }
    if (includesAny(normalized, ["support", "community", "success", "sales"])) {
        return ["social", "operational"];
    }
    return [];
}
function categoriesFromText(text) {
    const normalized = normalizeForMatch(text);
    const categories = [];
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((keyword) => normalized.includes(keyword))) {
            categories.push(category);
        }
    }
    return categories;
}
function inferTimeRange(text) {
    const normalized = normalizeForMatch(text);
    const now = Date.now();
    if (includesAny(normalized, ["today", "latest", "recent", "currently"])) {
        return { since: new Date(now - (7 * 24 * 60 * 60 * 1000)).toISOString() };
    }
    if (includesAny(normalized, ["yesterday", "last day"])) {
        return { since: new Date(now - (24 * 60 * 60 * 1000)).toISOString() };
    }
    if (includesAny(normalized, ["last week", "this week"])) {
        return { since: new Date(now - (7 * 24 * 60 * 60 * 1000)).toISOString() };
    }
    if (includesAny(normalized, ["last month", "this month"])) {
        return { since: new Date(now - (30 * 24 * 60 * 60 * 1000)).toISOString() };
    }
    return undefined;
}
function extractTerms(text) {
    const normalized = text.trim().toLowerCase();
    if (normalized.length === 0)
        return [];
    const terms = [];
    // Preserve explicit quoted phrases as high-signal terms.
    const quoteMatches = normalized.match(/"([^"]+)"/g) ?? [];
    for (const raw of quoteMatches) {
        const phrase = raw.replaceAll("\"", "").trim();
        if (phrase.length > 1) {
            terms.push(phrase);
        }
    }
    const tokenMatches = normalized.match(/[a-z0-9][a-z0-9_./-]{1,63}/g) ?? [];
    for (const token of tokenMatches) {
        if (token.length < 2 || STOP_WORDS.has(token))
            continue;
        terms.push(token);
    }
    return dedupeStrings(terms);
}
function expandAbbreviations(terms) {
    const expanded = [];
    for (const term of terms) {
        expanded.push(term);
        const expansions = ABBREVIATION_EXPANSIONS[term];
        if (expansions) {
            expanded.push(...expansions);
        }
    }
    return expanded;
}
function matchRetrievedKnowledgeInResponse(db, retrievedIds, response) {
    if (retrievedIds.length === 0)
        return [];
    const placeholders = retrievedIds.map(() => "?").join(", ");
    const rows = db
        .prepare(`SELECT id, key, content FROM knowledge_store WHERE id IN (${placeholders})`)
        .all(...retrievedIds);
    const normalizedResponse = normalizeForMatch(response);
    const matched = [];
    for (const row of rows) {
        const key = normalizeForMatch(row.key);
        const contentSnippet = normalizeForMatch(row.content.slice(0, 200));
        const keyMatched = key.length >= 3 && normalizedResponse.includes(key);
        const contentMatched = contentSnippet.length >= 12
            && normalizedResponse.includes(contentSnippet);
        if (keyMatched || contentMatched) {
            matched.push(row.id);
        }
    }
    return dedupeStrings(matched);
}
function incrementKnowledgeAccessCount(db, ids) {
    const uniqueIds = dedupeStrings(ids);
    if (uniqueIds.length === 0)
        return;
    const updateStatement = db.prepare("UPDATE knowledge_store SET access_count = access_count + 1 WHERE id = ?");
    const tx = db.transaction((txIds) => {
        for (const id of txIds) {
            updateStatement.run(id);
        }
    });
    tx(uniqueIds);
}
function getTurnResponse(db, turnId) {
    const row = db
        .prepare("SELECT thinking FROM turns WHERE id = ?")
        .get(turnId);
    return typeof row?.thinking === "string" ? row.thinking : "";
}
function pushRollingPrecision(precision) {
    feedbackPrecisionWindow.push(clamp01(precision));
    while (feedbackPrecisionWindow.length > MAX_ROLLING_FEEDBACK_WINDOW) {
        feedbackPrecisionWindow.shift();
    }
    if (feedbackPrecisionWindow.length === 0) {
        lastRollingPrecision = undefined;
        return 0;
    }
    const total = feedbackPrecisionWindow.reduce((sum, value) => sum + value, 0);
    lastRollingPrecision = total / feedbackPrecisionWindow.length;
    return lastRollingPrecision;
}
function dedupeStrings(values) {
    const seen = new Set();
    const deduped = [];
    for (const value of values) {
        const normalized = value.trim();
        if (normalized.length === 0 || seen.has(normalized))
            continue;
        seen.add(normalized);
        deduped.push(normalized);
    }
    return deduped;
}
function dedupeCategories(values) {
    const seen = new Set();
    const deduped = [];
    for (const value of values) {
        if (seen.has(value))
            continue;
        seen.add(value);
        deduped.push(value);
    }
    return deduped;
}
function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
}
function toOptionalString(value) {
    if (typeof value !== "string")
        return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function includesAny(text, candidates) {
    return candidates.some((candidate) => text.includes(candidate));
}
function normalizeForMatch(text) {
    return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
//# sourceMappingURL=enhanced-retriever.js.map