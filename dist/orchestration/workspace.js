import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const CHARS_PER_TOKEN = 3.5;
const SUMMARY_SNIPPET_LENGTH = 100;
export class AgentWorkspace {
    goalId;
    basePath;
    outputsPath;
    contextPath;
    checkpointsPath;
    decisionsPath;
    metadataByFile = new Map();
    constructor(goalId, basePath) {
        const normalizedGoalId = goalId.trim();
        if (normalizedGoalId.length === 0) {
            throw new Error("goalId must be a non-empty string");
        }
        this.goalId = normalizedGoalId;
        this.basePath = path.resolve(basePath ?? path.join(os.homedir(), ".automaton", "workspace", normalizedGoalId));
        this.outputsPath = path.join(this.basePath, "outputs");
        this.contextPath = path.join(this.basePath, "context");
        this.checkpointsPath = path.join(this.basePath, "checkpoints");
        this.decisionsPath = path.join(this.contextPath, "decisions.md");
        fs.mkdirSync(this.outputsPath, { recursive: true });
        fs.mkdirSync(this.contextPath, { recursive: true });
        fs.mkdirSync(this.checkpointsPath, { recursive: true });
    }
    writeOutput(agentRole, filename, content) {
        const normalizedRole = normalizeLabel(agentRole, "unknown");
        const normalizedFile = normalizeFilename(filename);
        const outputPath = this.resolveOutputPath(normalizedFile);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content, "utf8");
        const relativeName = this.toRelativeOutputName(outputPath);
        const metadata = {
            path: outputPath,
            agentRole: normalizedRole,
            size: Buffer.byteLength(content, "utf8"),
            tokenEstimate: estimateTokens(content),
            createdAt: new Date().toISOString(),
            summary: buildSummary(content),
        };
        this.metadataByFile.set(relativeName, metadata);
        return outputPath;
    }
    readOutput(filename) {
        const normalizedFile = normalizeFilename(filename);
        const outputPath = this.resolveOutputPath(normalizedFile);
        if (!fs.existsSync(outputPath)) {
            throw new Error(`Workspace output does not exist: ${normalizedFile}`);
        }
        return fs.readFileSync(outputPath, "utf8");
    }
    listOutputs() {
        const discoveredFiles = collectFiles(this.outputsPath);
        const files = [];
        for (const filePath of discoveredFiles) {
            const relativeName = this.toRelativeOutputName(filePath);
            const stat = fs.statSync(filePath);
            const existing = this.metadataByFile.get(relativeName);
            if (existing) {
                files.push({
                    ...existing,
                    path: filePath,
                    size: stat.size,
                });
                continue;
            }
            const content = fs.readFileSync(filePath, "utf8");
            files.push({
                path: filePath,
                agentRole: "unknown",
                size: stat.size,
                tokenEstimate: estimateTokens(content),
                createdAt: stat.birthtime.toISOString(),
                summary: buildSummary(content),
            });
        }
        files.sort((a, b) => a.path.localeCompare(b.path));
        return files;
    }
    logDecision(decision, rationale, agentRole) {
        const normalizedDecision = normalizeLabel(decision, "(no decision provided)");
        const normalizedRationale = normalizeLabel(rationale, "(no rationale provided)");
        const normalizedRole = normalizeLabel(agentRole, "unknown");
        const timestamp = new Date().toISOString();
        const entry = [
            `### ${timestamp} - ${normalizedRole}`,
            `- Decision: ${normalizedDecision}`,
            `- Rationale: ${normalizedRationale}`,
            "",
        ].join("\n");
        fs.appendFileSync(this.decisionsPath, `${entry}\n`, "utf8");
    }
    getSummary() {
        const outputs = this.listOutputs();
        if (outputs.length === 0) {
            return "";
        }
        return outputs
            .map((file) => {
            const filename = this.toRelativeOutputName(file.path);
            const summary = file.summary && file.summary.length > 0 ? file.summary : "no summary";
            return `${filename} (${file.tokenEstimate} tokens): ${summary}`;
        })
            .join("\n");
    }
    resolveOutputPath(filename) {
        const outputPath = path.resolve(this.outputsPath, filename);
        const outputsRoot = this.outputsPath.endsWith(path.sep)
            ? this.outputsPath
            : `${this.outputsPath}${path.sep}`;
        if (outputPath !== this.outputsPath && !outputPath.startsWith(outputsRoot)) {
            throw new Error(`Invalid output filename outside workspace outputs/: ${filename}`);
        }
        return outputPath;
    }
    toRelativeOutputName(filePath) {
        return path.relative(this.outputsPath, filePath).split(path.sep).join("/");
    }
}
export function createWorkspace(goalId) {
    return new AgentWorkspace(goalId);
}
function estimateTokens(content) {
    return Math.ceil(content.length / CHARS_PER_TOKEN);
}
function normalizeFilename(filename) {
    const normalized = filename.trim();
    if (normalized.length === 0) {
        throw new Error("filename must be a non-empty string");
    }
    return normalized;
}
function normalizeLabel(value, fallback) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : fallback;
}
function buildSummary(content) {
    const snippet = content.slice(0, SUMMARY_SNIPPET_LENGTH);
    const summary = snippet.replace(/\s+/g, " ").trim();
    return summary.length > 0 ? summary : undefined;
}
function collectFiles(directory) {
    if (!fs.existsSync(directory)) {
        return [];
    }
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
            continue;
        }
        if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}
//# sourceMappingURL=workspace.js.map