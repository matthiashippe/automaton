#!/usr/bin/env node
// `pnpm build` at the repository root runs this command (pnpm falls back to a command of that name
// when package.json has no script of it).
//
// The root package.json deliberately has no build, prepare or install script: with one, npm 10
// and 11 run an inner install inside the temporary git clone while doing
// `npm install -g github:matthiashippe/automaton#<tag>`, that inner install inherits --global and
// replaces the very folder the outer install is extracting into, and the install fails (fixed in
// pacote 22). So dist/ is committed, src/__tests__/dist-in-sync.test.ts fails whenever it is not
// what this build produces from src/, and npm installs a tag straight from GitHub without building.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");

execFileSync(process.execPath, [tsc, "-p", root], { stdio: "inherit", cwd: root });

const pnpm = process.env.npm_execpath;
if (pnpm && /\.c?js$/.test(pnpm)) {
  execFileSync(process.execPath, [pnpm, "-r", "run", "build"], { stdio: "inherit", cwd: root });
} else {
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["-r", "run", "build"], { stdio: "inherit", cwd: root });
}
