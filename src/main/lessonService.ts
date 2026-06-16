import { ZodError } from "zod";
import { lessonPlanSchema } from "../shared/schemas.js";
import type { LessonPlan, ModelConfig } from "../shared/types.js";
import { buildLessonPrompt } from "./lessonPrompt.js";

type LessonClient = {
  chatCompletion(input: {
    apiKey: string;
    modelName: string;
    messages: ReturnType<typeof buildLessonPrompt>;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" };
  }): Promise<string>;
};

export { buildLessonPrompt };

export async function generateLessonPlan(input: {
  topic: string;
  config: ModelConfig;
  client: LessonClient;
}): Promise<LessonPlan> {
  if (!input.config.apiKey.trim() || !input.config.modelName.trim()) {
    throw new Error("文本模型配置不完整，请先在设置页填写 API Key 和模型名。");
  }

  const raw = await input.client.chatCompletion({
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    messages: buildLessonPrompt(input.topic),
    maxTokens: 4096,
    temperature: 0.4,
    responseFormat: { type: "json_object" }
  });

  const parsedJson = parseLessonJson(stripCodeFence(raw));
  const parsedPlan = parseLessonPlan(parsedJson);

  return {
    ...parsedPlan,
    markdown: renderLessonMarkdown(parsedPlan)
  };
}

export function renderLessonMarkdown(plan: LessonPlan): string {
  const exampleQuestions = plan.example_questions
    .map((item, index) => `${index + 1}. ${item.question}\n   答：${item.answer}`)
    .join("\n");
  const workedSolutions = plan.worked_solutions
    .map((item) =>
      [`### ${item.question}`, ...item.steps.map((step, index) => `${index + 1}. ${step}`), `答案：${item.answer}`].join(
        "\n"
      )
    )
    .join("\n\n");

  return [
    `# ${plan.title}`,
    `建议年级：${plan.grade_suggestion}`,
    "## 教学目标",
    renderList(plan.teaching_goals),
    "## 教学重点",
    renderList(plan.key_points),
    "## 教学难点",
    renderList(plan.difficult_points),
    "## 易混疑点",
    renderList(plan.common_confusions),
    "## 教学流程",
    renderLessonFlow(plan.lesson_flow),
    "## 板书设计",
    renderList(plan.board_design),
    "## 示例题目",
    exampleQuestions,
    "## 示例解法",
    workedSolutions,
    "## 课堂提问",
    renderList(plan.classroom_questions),
    "## 作业建议",
    renderList(plan.homework_suggestions),
    "## 视频脚本",
    plan.video_script,
    "## 视频提示词",
    plan.video_prompt
  ].join("\n\n");
}

function renderList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderLessonFlow(items: LessonPlan["lesson_flow"]): string {
  return items.map((item) => `- ${item.title}（${item.minutes} 分钟）：${item.activities.join("；")}`).join("\n");
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function parseLessonJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("模型返回的教案 JSON 无法解析，请重试。");
  }
}

function parseLessonPlan(value: unknown): LessonPlan {
  try {
    return lessonPlanSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error("模型返回的教案结构不完整，请重试。");
    }

    throw error;
  }
}
