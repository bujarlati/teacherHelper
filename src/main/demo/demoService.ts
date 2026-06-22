import { ZodError } from "zod";
import { problemDemoPlanSchema } from "../../shared/schemas.js";
import type { ModelConfig, ProblemDemoPlan } from "../../shared/types.js";
import { buildAnalyzeProblemPrompt } from "./analyzePrompt.js";

type AnalyzeClient = {
  chatCompletion(input: {
    apiKey: string;
    modelName: string;
    messages: AnalyzeMessage[];
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" };
    thinkingBudget?: number;
  }): Promise<string>;
};

type AnalyzeMessage = ReturnType<typeof buildAnalyzeProblemPrompt>[number];

type ParseFailure = {
  kind: "json" | "schema";
  message: string;
  fields: string[];
  raw: string;
};

type ParseResult =
  | { ok: true; plan: ProblemDemoPlan }
  | { ok: false; failure: ParseFailure };

const maxAnalyzeAttempts = 3;
const analyzeMaxTokens = 3200;
const analyzeThinkingBudget = 128;

export { buildAnalyzeProblemPrompt };

export async function analyzeProblemForDemo(input: {
  problem: string;
  config: ModelConfig;
  client: AnalyzeClient;
}): Promise<ProblemDemoPlan> {
  if (!input.config.apiKey.trim() || !input.config.modelName.trim()) {
    throw new Error("文本模型配置不完整，请先在设置页填写 API Key 和模型名。");
  }

  let messages: AnalyzeMessage[] = buildAnalyzeProblemPrompt(input.problem);
  let lastFailure: ParseFailure | undefined;

  for (let attempt = 1; attempt <= maxAnalyzeAttempts; attempt += 1) {
    const raw = await input.client.chatCompletion({
      apiKey: input.config.apiKey,
      modelName: input.config.modelName,
      messages,
      maxTokens: analyzeMaxTokens,
      temperature: 0.15,
      responseFormat: { type: "json_object" },
      thinkingBudget: analyzeThinkingBudget
    });
    const parsed = parseProblemDemoPlan(raw);

    if (parsed.ok) {
      return parsed.plan;
    }

    lastFailure = parsed.failure;
    messages = buildRepairPromptMessages(input.problem, parsed.failure, attempt + 1);
  }

  throw createFinalParseError(lastFailure);
}

export function chooseDemoRenderer(plan: ProblemDemoPlan): "motion" | "equation" | "simple" {
  if (plan.kind === "motion") return "motion";
  if (plan.kind === "equation") return "equation";

  return "simple";
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function parseProblemDemoJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("模型返回的题目演示 JSON 无法解析，请重试。");
  }
}

function parseProblemDemoPlan(raw: string): ParseResult {
  let value: unknown;
  try {
    value = parseProblemDemoJson(stripCodeFence(raw));
  } catch (error) {
    return {
      ok: false,
      failure: {
        kind: "json",
        message: getErrorMessage(error, "模型返回的题目演示 JSON 无法解析，请重试。"),
        fields: ["JSON"],
        raw
      }
    };
  }

  const result = problemDemoPlanSchema.safeParse(normalizeProblemDemoPlan(value));
  if (result.success) {
    return { ok: true, plan: result.data };
  }

  return {
    ok: false,
    failure: {
      kind: "schema",
      message: "模型返回的题目演示结构不完整，请重试。",
      fields: collectProblemFields(result.error),
      raw
    }
  };
}

function buildRepairPromptMessages(problem: string, failure: ParseFailure, attempt: number): AnalyzeMessage[] {
  return [
    ...buildAnalyzeProblemPrompt(problem),
    {
      role: "user" as const,
      content: [
        `上一次返回不符合题目演示 JSON 结构，这是第 ${attempt} 次生成。`,
        failure.kind === "json" ? "错误类型：JSON 无法解析。" : "错误类型：结构字段不完整。",
        failure.fields.length > 0 ? `问题字段：${failure.fields.join("、")}` : "",
        "请重新生成完整 JSON，必须严格满足以下要求：",
        "1. 顶层必须包含 kind, title, originalProblem, knownValues, target, steps。",
        "2. knownValues 必须是数组；没有明确数值时返回空数组。",
        "3. steps 必须是字符串数组，每一项是一句完整步骤；例如 [\"先设未知数 x\", \"再列方程 2x - 4 = 12\", \"最后解得 x = 8\"]；不要返回 {title, description} 对象数组。",
        "4. kind 为 motion 时必须完整填写 motion.startLabel, motion.endLabel, motion.distance, motion.distanceUnit, motion.speed, motion.speedUnit, motion.answerSeconds, motion.targetQuantity, motion.answerValue, motion.answerUnit。",
        "5. motion.targetQuantity 必须按题目所求填写 time、distance 或 speed；求两地距离/路程时 answerValue 是距离数值，answerUnit 是距离单位，不能把实际用时秒数当答案。",
        "6. kind 为 equation 时必须完整填写 equation.variable, equation.relationship, equation.expression, equation.solution, equation.verification。",
        "7. 不能为了省字段把适合 motion 或 equation 的题目改成 simple；用更多 token 补齐字段。",
        "8. 只返回 JSON，不要 Markdown，不要解释。",
        `上一次返回内容：${truncateRawResponse(failure.raw)}`
      ].filter(Boolean).join("\n")
    }
  ];
}

function normalizeProblemDemoPlan(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    steps: normalizeStepList(value.steps)
  };
}

function normalizeStepList(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => normalizeStepItem(item));
}

function normalizeStepItem(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const text = stringifyStepPart(value);
    return text || value;
  }

  if (!isRecord(value)) {
    return value;
  }

  const title = readTextField(value, ["title", "name", "heading", "step"]);
  const body = readTextField(value, [
    "description",
    "detail",
    "details",
    "text",
    "content",
    "explanation",
    "action"
  ]);

  if (title && body && title !== body) {
    return `${title}：${body}`;
  }

  if (title) {
    return title;
  }

  if (body) {
    return body;
  }

  const nestedText = stringifyStepPart(value);

  return nestedText || value;
}

function readTextField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    const text = stringifyStepPart(value);

    if (text) {
      return text;
    }
  }

  return "";
}

function stringifyStepPart(value: unknown): string {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyStepPart(item))
      .filter(Boolean)
      .join("；");
  }

  if (isRecord(value)) {
    return Object.values(value)
      .map((entry) => stringifyStepPart(entry))
      .filter(Boolean)
      .join("；");
  }

  return "";
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectProblemFields(error: ZodError): string[] {
  const fields = error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path || issue.message;
  });

  return [...new Set(fields)];
}

function createFinalParseError(failure: ParseFailure | undefined): Error {
  if (!failure || failure.kind === "schema") {
    const fields = failure?.fields.length ? `（问题字段：${failure.fields.join("、")}）` : "";
    return new Error(`模型连续 ${maxAnalyzeAttempts} 次未返回完整题目演示结构${fields}，请重试。`);
  }

  return new Error(`模型连续 ${maxAnalyzeAttempts} 次未返回可解析的题目演示 JSON，请重试。`);
}

function truncateRawResponse(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 1200 ? `${compact.slice(0, 1200)}...` : compact;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
