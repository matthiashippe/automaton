import type Database from "better-sqlite3";
import type { ChatMessage } from "../types.js";
export declare function generateTodoMd(db: Database.Database): string;
export declare function injectTodoContext(messages: ChatMessage[], todoMd: string): ChatMessage[];
//# sourceMappingURL=attention.d.ts.map