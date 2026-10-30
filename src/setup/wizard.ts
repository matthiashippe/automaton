import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { AutomatonConfig, TreasuryPolicy } from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";
import { getWallet, getAutomatonDir } from "../identity/wallet.js";
import { provision } from "../identity/provision.js";
import { createConfig, saveConfig } from "../config.js";
import { writeDefaultHeartbeatConfig } from "../heartbeat/config.js";
import { showBanner } from "./banner.js";
import {
  promptRequired,
  promptMultiline,
  promptAddress,
  promptOptional,
  promptWithDefault,
  closePrompts,
} from "./prompts.js";
import { detectEnvironment } from "./environment.js";
import { generateSoulMd, installDefaultSkills } from "./defaults.js";
import type { ChainType } from "../identity/chain.js";
import {
  CONTROL_PLANE_CHOICES,
  NO_CONTROL_PLANE_URL,
  listOllamaModels,
} from "./control-planes.js";

export async function runSetupWizard(): Promise<AutomatonConfig> {
  showBanner();

  console.log(chalk.white("  First-run setup. Let's bring your automaton to life.\n"));

  // ─── 1. Chain selection + wallet ──────────────────────────────
  console.log(chalk.cyan("  [1/6] Chain selection & identity (wallet)..."));
  let selectedChain: ChainType = "evm";
  const chainInput = await promptOptional("Chain type (evm or solana) [evm]");
  if (chainInput && chainInput.toLowerCase() === "solana") {
    selectedChain = "solana";
    console.log(chalk.green("  Chain: Solana (Ed25519)\n"));
  } else {
    console.log(chalk.green("  Chain: EVM (secp256k1)\n"));
  }

  const { account, chainIdentity, chainType: walletChainType, isNew } = await getWallet(selectedChain);
  const walletAddress = chainIdentity.address;
  if (isNew) {
    console.log(chalk.green(`  Wallet created: ${walletAddress}`));
  } else {
    console.log(chalk.green(`  Wallet loaded: ${walletAddress}`));
  }
  console.log(chalk.dim(`  Private key stored at: ${getAutomatonDir()}/wallet.json\n`));

  // ─── 2. Control plane + API key ───────────────────────────────
  console.log(chalk.cyan("  [2/6] Control plane (sign-up, credits, paid inference)\n"));
  for (const choice of CONTROL_PLANE_CHOICES) {
    console.log(chalk.white(`  ${choice.key}  ${choice.label.padEnd(14)}`) + chalk.dim(choice.note));
  }
  console.log("");
  let conwayApiUrl = "";
  while (!conwayApiUrl) {
    const picked = (await promptOptional("Choose 1-4 [1]")) || "1";
    const choice = CONTROL_PLANE_CHOICES.find((c) => c.key === picked);
    if (!choice) {
      console.log(chalk.yellow("  Please enter 1, 2, 3 or 4."));
      continue;
    }
    if (choice.url) {
      conwayApiUrl = choice.url;
    } else {
      const custom = await promptRequired("Control plane URL (https://...)");
      if (/^https:\/\//i.test(custom) || /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(custom)) {
        conwayApiUrl = custom.replace(/\/$/, "");
      } else {
        console.log(chalk.yellow("  The URL has to use https (plain http only on localhost)."));
      }
    }
  }
  const noControlPlane = conwayApiUrl === NO_CONTROL_PLANE_URL;

  let apiKey = "";
  let localModel = "";
  let ollamaFromControlPlaneStep: string | undefined;

  if (noControlPlane) {
    console.log(chalk.green("  No control plane. The automaton will think on a local model and never pay for credits.\n"));
    ollamaFromControlPlaneStep =
      (await promptOptional("Ollama base URL [http://127.0.0.1:11434]")) || "http://127.0.0.1:11434";
    const models = await listOllamaModels(ollamaFromControlPlaneStep);
    if (models.length > 0) {
      console.log(chalk.dim(`  Models on that server: ${models.join(", ")}`));
    } else {
      console.log(chalk.yellow("  Could not reach Ollama there right now. You can start it later (ollama serve)."));
    }
    while (!localModel) {
      localModel = (await promptOptional(`Local model${models[0] ? ` [${models[0]}]` : ""}`)) || models[0] || "";
      if (!localModel) console.log(chalk.yellow("  Name a model, for example qwen2.5-coder:32b (ollama pull <model>)."));
    }
    console.log(chalk.green(`  Local model: ${localModel}\n`));
  } else {
    const provisionLabel = walletChainType === "solana" ? "SIWS" : "SIWE";
    console.log(chalk.cyan(`  Signing up at ${conwayApiUrl} (${provisionLabel})...`));
    try {
      const result = await provision(conwayApiUrl, walletChainType === "solana" ? chainIdentity : undefined);
      apiKey = result.apiKey;
      console.log(chalk.green(`  API key provisioned: ${result.keyPrefix}...\n`));
    } catch (err: any) {
      console.log(chalk.yellow(`  Auto-provision failed: ${err.message}`));
      console.log(chalk.yellow("  You can enter a key manually, or press Enter to skip.\n"));
      const manual = await promptOptional("API key (optional)");
      if (manual) {
        apiKey = manual;
        // Save to config.json for loadApiKeyFromConfig()
        const configDir = getAutomatonDir();
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
        }
        fs.writeFileSync(
          path.join(configDir, "config.json"),
          JSON.stringify({ apiKey, walletAddress: walletAddress, provisionedAt: new Date().toISOString() }, null, 2),
          { mode: 0o600 },
        );
        console.log(chalk.green("  API key saved.\n"));
      }
    }

    if (!apiKey) {
      console.log(chalk.yellow("  No API key set. The automaton will not buy credits until sign-up works (automaton --setup).\n"));
    }
  }

  // ─── 3. Interactive questions ─────────────────────────────────
  console.log(chalk.cyan("  [3/6] Setup questions\n"));

  const name = await promptRequired("What do you want to name your automaton?");
  console.log(chalk.green(`  Name: ${name}\n`));

  const genesisPrompt = await promptMultiline("Enter the genesis prompt (system prompt) for your automaton.");
  console.log(chalk.green(`  Genesis prompt set (${genesisPrompt.length} chars)\n`));

  console.log(chalk.dim(`  Your automaton's address is ${walletAddress}`));
  console.log(chalk.dim("  Now enter YOUR wallet address (the human creator/owner).\n"));
  const creatorAddressLabel = walletChainType === "solana"
    ? "Creator wallet address (base58)"
    : "Creator wallet address (0x...)";
  const creatorAddress = await promptAddress(creatorAddressLabel, walletChainType);
  console.log(chalk.green(`  Creator: ${creatorAddress}\n`));

  console.log(chalk.white("  Optional: bring your own inference provider keys (press Enter to skip)."));
  const openaiApiKey = await promptOptional("OpenAI API key (sk-..., optional)");
  if (openaiApiKey && !openaiApiKey.startsWith("sk-")) {
    console.log(chalk.yellow("  Warning: OpenAI keys usually start with sk-. Saving anyway."));
  }

  const anthropicApiKey = await promptOptional("Anthropic API key (sk-ant-..., optional)");
  if (anthropicApiKey && !anthropicApiKey.startsWith("sk-ant-")) {
    console.log(chalk.yellow("  Warning: Anthropic keys usually start with sk-ant-. Saving anyway."));
  }

  const ollamaInput = ollamaFromControlPlaneStep
    ?? await promptOptional("Ollama base URL (http://localhost:11434, optional)");
  const ollamaBaseUrl = ollamaInput || undefined;
  if (ollamaBaseUrl) {
    console.log(chalk.green(`  Ollama URL saved: ${ollamaBaseUrl}`));
  }

  if (openaiApiKey || anthropicApiKey || ollamaBaseUrl) {
    const providers = [
      openaiApiKey ? "OpenAI" : null,
      anthropicApiKey ? "Anthropic" : null,
      ollamaBaseUrl ? "Ollama" : null,
    ].filter(Boolean).join(", ");
    console.log(chalk.green(`  Provider keys/URLs saved: ${providers}\n`));
  } else {
    console.log(chalk.dim("  No provider keys set. Inference goes through the control plane.\n"));
  }

  // ─── Financial Safety Policy ─────────────────────────────────
  console.log(chalk.cyan("  Financial Safety Policy"));
  console.log(chalk.dim("  These limits protect against unauthorized spending. Press Enter for defaults.\n"));

  const treasuryPolicy: TreasuryPolicy = {
    maxSingleTransferCents: await promptWithDefault(
      "Max single transfer (cents)", DEFAULT_TREASURY_POLICY.maxSingleTransferCents),
    maxHourlyTransferCents: await promptWithDefault(
      "Max hourly transfers (cents)", DEFAULT_TREASURY_POLICY.maxHourlyTransferCents),
    maxDailyTransferCents: await promptWithDefault(
      "Max daily transfers (cents)", DEFAULT_TREASURY_POLICY.maxDailyTransferCents),
    minimumReserveCents: await promptWithDefault(
      "Minimum reserve (cents)", DEFAULT_TREASURY_POLICY.minimumReserveCents),
    maxX402PaymentCents: await promptWithDefault(
      "Max x402 payment (cents)", DEFAULT_TREASURY_POLICY.maxX402PaymentCents),
    x402AllowedDomains: DEFAULT_TREASURY_POLICY.x402AllowedDomains,
    transferCooldownMs: DEFAULT_TREASURY_POLICY.transferCooldownMs,
    maxTransfersPerTurn: DEFAULT_TREASURY_POLICY.maxTransfersPerTurn,
    maxInferenceDailyCents: await promptWithDefault(
      "Max daily inference spend (cents)", DEFAULT_TREASURY_POLICY.maxInferenceDailyCents),
    requireConfirmationAboveCents: await promptWithDefault(
      "Require confirmation above (cents)", DEFAULT_TREASURY_POLICY.requireConfirmationAboveCents),
  };

  console.log(chalk.green("  Treasury policy configured.\n"));

  // ─── 4. Detect environment ────────────────────────────────────
  console.log(chalk.cyan("  [4/6] Detecting environment..."));
  const env = detectEnvironment();
  if (env.sandboxId) {
    console.log(chalk.green(`  Conway sandbox detected: ${env.sandboxId}\n`));
  } else {
    console.log(chalk.dim(`  Environment: ${env.type} (no sandbox detected)\n`));
  }

  // ─── 5. Write config + heartbeat + SOUL.md + skills ───────────
  console.log(chalk.cyan("  [5/6] Writing configuration..."));

  const config = createConfig({
    name,
    genesisPrompt,
    creatorAddress,
    registeredWithConway: !!apiKey,
    sandboxId: env.sandboxId,
    walletAddress,
    apiKey,
    conwayApiUrl,
    // The router reads modelStrategy, not the top-level inferenceModel, so a local model has to
    // be named there or the automaton keeps asking for gpt-5.2 and never thinks.
    modelStrategy: localModel
      ? { inferenceModel: localModel, lowComputeModel: localModel, criticalModel: localModel }
      : undefined,
    openaiApiKey: openaiApiKey || undefined,
    anthropicApiKey: anthropicApiKey || undefined,
    ollamaBaseUrl,
    treasuryPolicy,
    chainType: walletChainType,
  });

  if (localModel) config.inferenceModel = localModel;

  saveConfig(config);
  console.log(chalk.green("  automaton.json written"));

  writeDefaultHeartbeatConfig();
  console.log(chalk.green("  heartbeat.yml written"));

  // constitution.md (immutable — copied from repo, protected from self-modification)
  const automatonDir = getAutomatonDir();
  const constitutionSrc = path.join(process.cwd(), "constitution.md");
  const constitutionDst = path.join(automatonDir, "constitution.md");
  if (fs.existsSync(constitutionSrc)) {
    // The copy from an earlier setup is read-only, and copying onto it fails with EACCES, which
    // aborted every second run of --setup.
    fs.rmSync(constitutionDst, { force: true });
    fs.copyFileSync(constitutionSrc, constitutionDst);
    fs.chmodSync(constitutionDst, 0o444); // read-only
    console.log(chalk.green("  constitution.md installed (read-only)"));
  }

  // SOUL.md
  const soulPath = path.join(automatonDir, "SOUL.md");
  fs.writeFileSync(soulPath, generateSoulMd(name, walletAddress, creatorAddress, genesisPrompt), { mode: 0o600 });
  console.log(chalk.green("  SOUL.md written"));

  // Default skills
  const skillsDir = config.skillsDir || "~/.automaton/skills";
  installDefaultSkills(skillsDir);
  console.log(chalk.green("  Default skills installed (conway-compute, conway-payments, survival)\n"));

  // ─── 6. Funding guidance ──────────────────────────────────────
  console.log(chalk.cyan("  [6/6] Funding\n"));
  if (noControlPlane) {
    console.log(chalk.green("  Nothing to fund. Without a control plane the automaton never pays for credits.\n"));
  } else {
    showFundingPanel(walletAddress, walletChainType, conwayApiUrl);
  }

  closePrompts();

  return config;
}

function showFundingPanel(address: string, chainType: ChainType = "evm", apiUrl = ""): void {
  const short = `${address.slice(0, 6)}...${address.slice(-5)}`;
  const usdcNetwork = chainType === "solana" ? "Solana" : "Base";
  const host = apiUrl.replace(/^https?:\/\//, "");
  const w = 58;
  const pad = (s: string, len: number) => s + " ".repeat(Math.max(0, len - s.length));
  const line = (s = "") => console.log(chalk.cyan(`  │${pad(s, w)}│`));

  console.log(chalk.cyan(`  ${"╭" + "─".repeat(w) + "╮"}`));
  line("  Fund your automaton");
  line();
  line(`  Address: ${short}`);
  line(`  Chain: ${chainType === "solana" ? "Solana" : "EVM (Base)"}`);
  line();
  line(`  Send USDC on ${usdcNetwork} to the address above.`);
  line(`  It buys credits at ${host.slice(0, w - 22)} itself,`);
  line("  and stops buying if a payment does not arrive.");
  if (host.includes("api.conway.tech")) {
    line();
    line("  Careful: sign-up at api.conway.tech has failed for");
    line("  new wallets since July 2026. Without an API key the");
    line("  automaton will not buy, but do not fund it before");
    line("  sign-up works.");
  }
  line();
  line("  The automaton will start now. Fund it anytime, the");
  line("  survival system handles zero credit gracefully.");
  console.log(chalk.cyan(`  ${"╰" + "─".repeat(w) + "╯"}`));
  console.log("");
}
