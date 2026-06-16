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
    responseFormat: { type: "json_object" }
  });

  return parseProblemDemoPlan(parseProblemDemoJson(stripCodeFence(raw)));
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

function parseProblemDemoPlan(value: unknown): ProblemDemoPlan {
  try {
    return problemDemoPlanSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error("模型返回的题目演示结构不完整，请重试。");
    }

    throw error;
  }
}
