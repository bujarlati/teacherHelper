import { z, ZodError } from "zod";
import { lessonPlanSchema } from "../shared/schemas.js";
import type { LessonPlan, ModelConfig } from "../shared/types.js";
import { buildLessonPrompt } from "./lessonPrompt.js";

type ModelLessonPlan = Omit<LessonPlan, "markdown"> & { markdown?: string };

const missingExampleAnswer = "需教师补充答案";
const modelStringListSchema = z.preprocess(normalizeStringList, z.array(z.string().min(1)));
const modelExampleQuestionSchema = z.preprocess(
  normalizeExampleQuestion,
  z.object({
    question: z.string().min(1),
    answer: z.string().min(1)
  })
);

const modelLessonPlanSchema = lessonPlanSchema.extend({
  teaching_goals: modelStringListSchema,
  key_points: modelStringListSchema,
  difficult_points: modelStringListSchema,
  common_confusions: modelStringListSchema,
  lesson_flow: z.array(
    z.object({
      title: z.string().min(1),
      minutes: z.number().nonnegative(),
      activities: modelStringListSchema
    })
  ),
  board_design: modelStringListSchema,
  example_questions: z.preprocess(normalizeStringList, z.array(modelExampleQuestionSchema)),
  worked_solutions: z.array(
    z.object({
      question: z.string().min(1),
      steps: modelStringListSchema,
      answer: z.string().min(1)
    })
  ),
  classroom_questions: modelStringListSchema,
  homework_suggestions: modelStringListSchema,
  markdown: lessonPlanSchema.shape.markdown.optional()
});

type LessonClient = {
  chatCompletion(input: {
    apiKey: string;
    modelName: string;
    messages: ReturnType<typeof buildLessonPrompt>;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" };
    thinkingBudget?: number;
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
    responseFormat: { type: "json_object" },
    thinkingBudget: 64
  });

  const parsedJson = parseLessonJson(stripCodeFence(raw));
  const parsedPlan = parseLessonPlan(parsedJson);

  return {
    ...parsedPlan,
    markdown: renderLessonMarkdown(parsedPlan)
  };
}

export function renderLessonMarkdown(plan: ModelLessonPlan): string {
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

function renderLessonFlow(items: ModelLessonPlan["lesson_flow"]): string {
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

function parseLessonPlan(value: unknown): ModelLessonPlan {
  try {
    return modelLessonPlanSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`模型返回的教案结构不完整${formatZodIssues(error)}，请重试。`);
    }

    throw error;
  }
}

function normalizeStringList(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return value;
    }

    const items = trimmed
      .split(/\r?\n|[；;]/)
      .map(cleanListItem)
      .filter(Boolean);

    return items.length > 0 ? items : [trimmed];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? cleanListItem(item) : item))
      .filter((item) => typeof item !== "string" || item.length > 0);
  }

  return value;
}

function cleanListItem(value: string): string {
  return value.replace(/^\s*(?:[-*•]\s*)?(?:(?:\d+[.、)]|\(\d+\)|（\d+）)\s*)?/, "").trim();
}

function normalizeExampleQuestion(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const text = cleanListItem(value);
  const match = text.match(/^(?:题目|问题|问|例题)?\s*[:：]?\s*(.*?)\s*(?:答案|答)\s*[:：]\s*(.+)$/s);

  if (!match?.[1]?.trim() || !match[2]?.trim()) {
    return text ? { question: text, answer: missingExampleAnswer } : value;
  }

  return {
    question: cleanListItem(match[1]),
    answer: cleanListItem(match[2])
  };
}

function formatZodIssues(error: ZodError): string {
  const paths = Array.from(new Set(error.issues.map((issue) => issue.path.join(".")).filter(Boolean))).slice(0, 5);

  return paths.length > 0 ? `（问题字段：${paths.join("、")}）` : "";
}
