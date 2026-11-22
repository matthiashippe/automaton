/**
 * Knowledge Store
 *
 * Shared cross-agent knowledge base backed by the knowledge_store table.
 */
import type BetterSqlite3 from "better-sqlite3";
type Database = BetterSqlite3.Database;
export type KnowledgeCategory = "market" | "technical" | "social" | "financial" | "operational";
export interface KnowledgeEntry {
    id: string;
    category: KnowledgeCategory;
    key: string;
    content: string;
    source: string;
    confidence: number;
    lastVerified: string;
    accessCount: number;
    tokenCount: number;
    createdAt: string;
    expiresAt: string | null;
}
export interface KnowledgeStats {
    total: number;
    byCategory: Record<KnowledgeCategory, number>;
    totalTokens: number;
}
export declare class KnowledgeStore {
    private readonly db;
    constructor(db: Database);
    add(entry: Omit<KnowledgeEntry, "id" | "accessCount" | "createdAt">): string;
    get(id: string): KnowledgeEntry | null;
    search(query: string, category?: KnowledgeCategory, limit?: number): KnowledgeEntry[];
    update(id: string, updates: Partial<KnowledgeEntry>): void;
    remove(id: string): void;
    prune(): number;
    getByCategory(category: KnowledgeCategory): KnowledgeEntry[];
    getStats(): KnowledgeStats;
}
export {};
//# sourceMappingURL=knowledge-store.d.ts.map