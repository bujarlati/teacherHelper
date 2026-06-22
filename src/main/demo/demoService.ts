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

const maxAnalyzeAttempts = 5;
const analyzeMaxTokens = 4200;
const analyzeThinkingBudget = 256;

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
    {
      role: "system" as const,
      content: "你是中国中小学数学老师。请把题目重新分析为一个可交互课堂演示 JSON，只返回 JSON，不要 Markdown。"
    },
    {
      role: "user" as const,
      content: [
        `题目：${problem}`,
        `这是第 ${attempt} 次生成。`,
        failure.kind === "json" ? "上次错误：JSON 无法解析。" : "上次错误：结构字段不完整。",
        failure.fields.length > 0 ? `必须修正字段：${failure.fields.join("、")}` : "",
        "顶层必须有：kind,title,originalProblem,knownValues,target,steps。",
        "kind 只能是 motion/equation/engineering/geometry/simple；不要为省字段把行程题或方程题降级成 simple。",
        "knownValues 必须是数组，每项必须是 {\"label\":\"条件名\",\"value\":数字或文本,\"unit\":\"单位，可省略\"}。",
        "steps 必须是至少 3 个字符串，按课堂讲解顺序写。",
        "motion 题必须补齐 motion.startLabel,endLabel,distance,distanceUnit,speed,speedUnit,answerSeconds,targetQuantity,answerLabel,answerValue,answerUnit；answerValue 必须是题目最终所求，不要把动画用时误当答案。",
        "equation 题必须补齐 equation.variable,relationship,expression,solution,verification。",
        "只返回完整 JSON 对象。"
      ].filter(Boolean).join("\n")
    }
  ];
}

function normalizeProblemDemoPlan(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const knownValues = readField(value, [
    "knownValues",
    "known_values",
    "knownConditions",
    "conditions",
    "givens",
    "knowns",
    "已知条件"
  ]);

  return {
    ...value,
    knownValues: normalizeKnownValueList(knownValues),
    steps: normalizeStepList(value.steps)
  };
}

function normalizeKnownValueList(value: unknown): unknown {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeKnownValueItem(item, index));
  }

  if (isRecord(value)) {
    return Object.entries(value).map(([label, item], index) => {
      if (isRecord(item)) {
        return normalizeKnownValueItem({ label, ...item }, index);
      }

      return normalizeKnownValueItem({ label, value: item }, index);
    });
  }

  return [normalizeKnownValueItem(value, 0)];
}

function normalizeKnownValueItem(value: unknown, index: number): unknown {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { label: `已知条件 ${index + 1}`, value: normalizeKnownScalar(value) };
  }

  if (!isRecord(value)) {
    return value;
  }

  const label = readTextField(value, [
    "label",
    "name",
    "key",
    "title",
    "condition",
    "field",
    "item",
    "条件",
    "名称",
    "项目"
  ]) || `已知条件 ${index + 1}`;
  const rawValue = readField(value, [
    "value",
    "amount",
    "number",
    "count",
    "text",
    "content",
    "data",
    "值",
    "数值",
    "数量"
  ]);
  const unit = readTextField(value, ["unit", "单位", "unitName"]);
  const normalizedValue = rawValue === undefined ? stringifyStepPart(value) || label : normalizeKnownScalar(rawValue);

  return {
    label,
    value: normalizedValue,
    ...(unit ? { unit } : {})
  };
}

function normalizeKnownScalar(value: unknown): number | string {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  const text = stringifyStepPart(value);

  return text || String(value);
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

function readField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  return undefined;
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
