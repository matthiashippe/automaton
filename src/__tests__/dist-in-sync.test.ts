import { describe, it, expect, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

// npm installs a release tag from GitHub without building it (packages/build/build.mjs says why),
// so the committed dist/ is what every such install runs. It has to be exactly what tsc makes of
// src/ right now. The fresh build goes into a folder at the same depth as dist/, so the relative
// paths in source maps come out the same.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fresh = path.join(root, ".dist-check");

function listFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

describe("committed dist", () => {
  afterAll(() => fs.rmSync(fresh, { recursive: true, force: true }));

  it("is exactly what tsc builds from src", () => {
    fs.rmSync(fresh, { recursive: true, force: true });
    execFileSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "-p", root, "--outDir", fresh], {
      cwd: root,
      stdio: "pipe",
    });
    const built = listFiles(fresh).sort();
    const committed = listFiles(path.join(root, "dist")).sort();
    expect(built.length).toBeGreaterThan(100);
    expect(committed).toEqual(built);
    const differing = built.filter(
      (file) => !fs.readFileSync(path.join(fresh, file)).equals(fs.readFileSync(path.join(root, "dist", file))),
    );
    expect(differing).toEqual([]);
  }, 180_000);
});
