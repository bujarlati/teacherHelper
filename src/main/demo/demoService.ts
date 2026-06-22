import { ZodError } from "zod";
import { problemDemoPlanSchema } from "../../shared/schemas.js";
import type { ModelConfig, ProblemDemoPlan } from "../../shared/types.js";
import { buildAnalyzeProblemPrompt } from "./analyzePrompt.js";

type AnalyzeClient = {
  chatCompletion(input: {
    apiKey: string;
    modelName: string;
    messages: ReturnType<typeof buildAnalyzeProblemPrompt>;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" };
    thinkingBudget?: number;
  }): Promise<string>;
};

export { buildAnalyzeProblemPrompt };

export async function analyzeProblemForDemo(input: {
  problem: string;
  config: ModelConfig;
  client: AnalyzeClient;
}): Promise<ProblemDemoPlan> {
  if (!input.config.apiKey.trim() || !input.config.modelName.trim()) {
    throw new Error("文本模型配置不完整，请先在设置页填写 API Key 和模型名。");
  }

  const raw = await input.client.chatCompletion({
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    messages: buildAnalyzeProblemPrompt(input.problem),
    maxTokens: 1800,
    temperature: 0.2,
    responseFormat: { type: "json_object" },
    thinkingBudget: 64
  });

  return parseProblemDemoPlan(parseProblemDemoJson(stripCodeFence(raw)), input.problem);
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

function parseProblemDemoPlan(value: unknown, problem: string): ProblemDemoPlan {
  try {
    return problemDemoPlanSchema.parse(normalizeProblemDemoPlan(value, problem));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error("模型返回的题目演示结构不完整，请重试。");
    }

    throw error;
  }
}

function normalizeProblemDemoPlan(value: unknown, problem: string): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const kind = normalizeKind(value.kind);
  const basePlan = {
    kind,
    title: normalizeString(value.title, createFallbackTitle(problem)),
    originalProblem: normalizeString(value.originalProblem, problem.trim() || "用户输入题目"),
    knownValues: normalizeKnownValues(value.knownValues),
    target: normalizeString(value.target, "求解题目中的问题"),
    steps: normalizeSteps(value.steps)
  };

  if (kind === "motion") {
    const motion = normalizeMotion(value.motion);
    return motion ? { ...basePlan, motion } : { ...basePlan, kind: "simple" };
  }

  if (kind === "equation") {
    const equation = normalizeEquation(value.equation);
    return equation ? { ...basePlan, equation } : { ...basePlan, kind: "simple" };
  }

  return basePlan;
}

function normalizeKind(value: unknown): ProblemDemoPlan["kind"] {
  if (
    value === "motion"
    || value === "equation"
    || value === "engineering"
    || value === "geometry"
    || value === "simple"
  ) {
    return value;
  }

  return "simple";
}

function normalizeKnownValues(value: unknown): ProblemDemoPlan["knownValues"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const label = normalizeString(item.label, "");
    const rawValue = normalizeKnownValue(item.value);
    if (!label || rawValue === undefined) {
      return [];
    }

    return [{
      label,
      value: rawValue,
      ...(typeof item.unit === "string" && item.unit.trim() ? { unit: item.unit.trim() } : {})
    }];
  });
}

function normalizeKnownValue(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function normalizeSteps(value: unknown): string[] {
  const steps = Array.isArray(value)
    ? value.map((item) => normalizeString(item, "")).filter(Boolean)
    : typeof value === "string"
      ? [value.trim()].filter(Boolean)
      : [];

  return steps.length > 0
    ? steps
    : [
      "阅读题目，找出已知条件和要求的问题。",
      "用图示或分步提示整理数量关系。",
      "逐步计算，并把结果代回题目检查。"
    ];
}

function normalizeMotion(value: unknown): ProblemDemoPlan["motion"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const distance = normalizePositiveNumber(value.distance);
  const speed = normalizePositiveNumber(value.speed);
  const answerSeconds = normalizePositiveNumber(value.answerSeconds);
  if (distance === undefined || speed === undefined || answerSeconds === undefined) {
    return undefined;
  }

  return {
    startLabel: normalizeString(value.startLabel, "起点"),
    endLabel: normalizeString(value.endLabel, "终点"),
    distance,
    distanceUnit: normalizeString(value.distanceUnit, "米"),
    speed,
    speedUnit: normalizeString(value.speedUnit, "米/秒"),
    answerSeconds
  };
}

function normalizeEquation(value: unknown): ProblemDemoPlan["equation"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const variable = normalizeString(value.variable, "");
  const relationship = normalizeString(value.relationship, "");
  const expression = normalizeString(value.expression, "");
  const solution = normalizeString(value.solution, "");
  const verification = normalizeString(value.verification, "");
  if (!variable || !relationship || !expression || !solution || !verification) {
    return undefined;
  }

  return {
    variable,
    relationship,
    expression,
    solution,
    verification
  };
}

function normalizePositiveNumber(value: unknown): number | undefined {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function createFallbackTitle(problem: string): string {
  const compact = problem.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 40) : "题目演示";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
