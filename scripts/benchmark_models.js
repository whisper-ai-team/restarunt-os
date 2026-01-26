#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAI } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.replace(/^--/, "");
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[key] = value;
  }
  return args;
}

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function evaluateExpected(expected, output) {
  if (!expected) return { pass: true, reasons: [] };
  const reasons = [];
  const normalized = normalize(output);
  const contains = expected.contains || [];
  const notContains = expected.notContains || [];
  const regex = expected.regex || [];

  for (const token of contains) {
    if (!normalized.includes(normalize(token))) {
      reasons.push(`missing:${token}`);
    }
  }
  for (const token of notContains) {
    if (normalized.includes(normalize(token))) {
      reasons.push(`unexpected:${token}`);
    }
  }
  for (const pattern of regex) {
    const re = new RegExp(pattern, "i");
    if (!re.test(output)) {
      reasons.push(`regex_miss:${pattern}`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}

function estimateCost(costMap, model, usage) {
  if (!costMap || !costMap[model] || !usage) return null;
  const rates = costMap[model];
  const inputRate = rates.inputPer1M ?? rates.input ?? null;
  const outputRate = rates.outputPer1M ?? rates.output ?? null;
  if (inputRate === null || outputRate === null) return null;
  const inputCost = (usage.prompt_tokens || 0) / 1_000_000 * inputRate;
  const outputCost = (usage.completion_tokens || 0) / 1_000_000 * outputRate;
  return Math.round((inputCost + outputCost) * 1e6) / 1e6;
}

async function run() {
  const args = parseArgs(process.argv);
  const casesPath = args.cases
    ? path.resolve(process.cwd(), args.cases)
    : path.join(__dirname, "model_benchmark_cases.json");
  const suiteName = args.suite || path.basename(casesPath, path.extname(casesPath));
  const models = (args.models || process.env.AI_BENCHMARK_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length === 0) {
    console.error("No models provided. Use --models or AI_BENCHMARK_MODELS.");
    process.exit(1);
  }

  const temperature = Number.parseFloat(args.temperature || process.env.AI_BENCHMARK_TEMPERATURE || "0");
  const maxTokens = Number.parseInt(args.maxTokens || process.env.AI_BENCHMARK_MAX_TOKENS || "256", 10);
  const costMap = process.env.AI_MODEL_COSTS ? JSON.parse(process.env.AI_MODEL_COSTS) : null;

  const payload = loadJSON(casesPath);
  const cases = payload.cases || [];
  if (!cases.length) {
    console.error("No cases found in benchmark file.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const report = {
    models: {},
    cases: cases.map((c) => c.id),
    startedAt: new Date().toISOString(),
    suite: suiteName,
    casesPath,
  };

  for (const model of models) {
    const modelStats = {
      model,
      totalLatencyMs: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      passed: 0,
      failed: 0,
      results: []
    };

    for (const testCase of cases) {
      const messages = [];
      if (testCase.system) messages.push({ role: "system", content: testCase.system });
      if (testCase.user) messages.push({ role: "user", content: testCase.user });

      const start = Date.now();
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: Number.isNaN(temperature) ? 0 : temperature,
        max_tokens: Number.isNaN(maxTokens) ? 256 : maxTokens,
      });
      const latencyMs = Date.now() - start;
      const content = response.choices?.[0]?.message?.content || "";
      const usage = response.usage || {};
      const evalResult = evaluateExpected(testCase.expected, content);
      const cost = estimateCost(costMap, model, usage);

      modelStats.totalLatencyMs += latencyMs;
      modelStats.totalPromptTokens += usage.prompt_tokens || 0;
      modelStats.totalCompletionTokens += usage.completion_tokens || 0;
      modelStats.totalTokens += usage.total_tokens || 0;
      if (cost !== null) modelStats.totalCost += cost;
      if (evalResult.pass) modelStats.passed += 1;
      else modelStats.failed += 1;

      modelStats.results.push({
        id: testCase.id,
        latencyMs,
        output: content,
        usage,
        pass: evalResult.pass,
        reasons: evalResult.reasons,
        cost
      });
    }

    modelStats.avgLatencyMs = Math.round(modelStats.totalLatencyMs / cases.length);
    modelStats.passRate = Math.round((modelStats.passed / cases.length) * 100);
    modelStats.avgTokens = Math.round(modelStats.totalTokens / cases.length);
    modelStats.avgCost = modelStats.totalCost ? Math.round((modelStats.totalCost / cases.length) * 1e6) / 1e6 : null;
    report.models[model] = modelStats;
  }

  report.completedAt = new Date().toISOString();

  const defaultReportPath = process.env.AI_BENCHMARK_REPORT_PATH || "";
  const historyDir = process.env.AI_BENCHMARK_REPORT_DIR || "";
  const outputPath = args.out
    ? path.resolve(process.cwd(), args.out)
    : (defaultReportPath ? path.resolve(process.cwd(), defaultReportPath) : null);
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Benchmark report saved to ${outputPath}`);
    if (historyDir) {
      const timestamp = report.completedAt?.replace(/[:.]/g, "-") || new Date().toISOString().replace(/[:.]/g, "-");
      const historyPath = path.resolve(process.cwd(), historyDir, `${suiteName}-${timestamp}.json`);
      const historyParent = path.dirname(historyPath);
      if (!fs.existsSync(historyParent)) {
        fs.mkdirSync(historyParent, { recursive: true });
      }
      fs.writeFileSync(historyPath, JSON.stringify(report, null, 2));
      console.log(`Benchmark history saved to ${historyPath}`);
    }
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

run().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
