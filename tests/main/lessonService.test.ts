import { describe, expect, it, vi } from "vitest";
import type { LessonPlan } from "../../src/shared/types";
import { buildLessonPrompt, generateLessonPlan, renderLessonMarkdown } from "../../src/main/lessonService";

function completeLessonPlan(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    title: "一元一次方程",
    grade_suggestion: "七年级",
    teaching_goals: ["理解一元一次方程的意义", "会用等式性质解简单方程"],
    key_points: ["方程的解", "等式两边同时变形"],
    difficult_points: ["从实际情境中找等量关系"],
    common_confusions: ["把未知量和已知量混淆", "移项时忘记变号"],
    lesson_flow: [
      { title: "情境导入", minutes: 5, activities: ["用天平情境引出等式平衡"] },
      { title: "例题讲解", minutes: 15, activities: ["设未知数", "列方程", "解方程"] }
    ],
    board_design: ["设未知数", "列方程", "解方程", "检验"],
    example_questions: [{ question: "小明买笔共花 10 元，每支 2 元，买了几支？", answer: "5 支" }],
    worked_solutions: [
      {
        question: "2x + 3 = 11",
        steps: ["两边同时减 3，得 2x = 8", "两边同时除以 2，得 x = 4"],
        answer: "x = 4"
      }
    ],
    classroom_questions: ["为什么等式两边要做同样的运算？"],
    homework_suggestions: ["完成 3 道列方程解决实际问题"],
    video_script: "展示天平两边保持平衡，逐步消去砝码。",
    video_prompt: "A clean classroom animation showing balance scale equation solving.",
    markdown: "# 模型返回的旧 Markdown",
    ...overrides
  };
}

describe("buildLessonPrompt", () => {
  it("requires structured lesson JSON and video fields", () => {
    const messages = buildLessonPrompt("一元一次方程");
    const combined = messages.map((message) => message.content).join("\n");

    expect(combined).toContain("一元一次方程");
    expect(combined).toContain("结构化教案 JSON");
    expect(combined).toContain("video_script");
    expect(combined).toContain("video_prompt");
    expect(combined).toContain("只返回 JSON");
    expect(combined).toContain("控制输出体量");
  });
});

describe("generateLessonPlan", () => {
  it("parses model JSON into a lesson plan and renders Markdown", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(completeLessonPlan()))
    };

    const plan = await generateLessonPlan({
      topic: "一元一次方程",
      config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
      client: fakeClient
    });

    expect(plan.title).toBe("一元一次方程");
    expect(plan.video_script).toContain("天平");
    expect(plan.markdown).toContain("## 教学重点");
    expect(plan.markdown).toContain("## 视频脚本");
    expect(plan.markdown).not.toBe("# 模型返回的旧 Markdown");
    expect(fakeClient.chatCompletion).toHaveBeenCalledWith({
      apiKey: "key",
      modelName: "Qwen/Qwen3-32B",
      messages: buildLessonPrompt("一元一次方程"),
      maxTokens: 4096,
      temperature: 0.4,
      responseFormat: { type: "json_object" },
      thinkingBudget: 64
    });
  });

  it("strips json fenced model output before parsing", async () => {
    const fakeClient = {
      chatCompletion: async () => `\`\`\`json\n${JSON.stringify(completeLessonPlan())}\n\`\`\``
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({ title: "一元一次方程" });
  });

  it("accepts model lesson JSON without markdown because markdown is rendered locally", async () => {
    const { markdown: _markdown, ...modelLesson } = completeLessonPlan();
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(modelLesson))
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({
      title: "一元一次方程",
      markdown: expect.stringContaining("## 教学重点")
    });
  });

  it("normalizes string list fields that the model returns as text blocks", async () => {
    const { markdown: _markdown, ...baseLesson } = completeLessonPlan();
    const modelLesson = {
      ...baseLesson,
      lesson_flow: baseLesson.lesson_flow.map((item) => ({
        ...item,
        activities: item.activities.join("；")
      })),
      board_design: "设未知数\n列方程\n解方程\n检验"
    };
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(modelLesson))
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({
      board_design: ["设未知数", "列方程", "解方程", "检验"],
      markdown: expect.stringContaining("- 情境导入（5 分钟）：用天平情境引出等式平衡")
    });
  });

  it("fills a useful board design when the model omits board_design", async () => {
    const { markdown: _markdown, board_design: _boardDesign, ...modelLesson } = completeLessonPlan();
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(modelLesson))
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({
      board_design: [
        "课题：一元一次方程",
        "重点：方程的解；等式两边同时变形",
        "难点：从实际情境中找等量关系",
        "例题：2x + 3 = 11"
      ],
      markdown: expect.stringContaining("## 板书设计")
    });
  });

  it("accepts Chinese board design keys from model output", async () => {
    const { markdown: _markdown, board_design: _boardDesign, ...baseLesson } = completeLessonPlan();
    const modelLesson = {
      ...baseLesson,
      板书设计: "设未知数\n列方程\n解方程\n检验"
    };
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(modelLesson))
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({
      board_design: ["设未知数", "列方程", "解方程", "检验"]
    });
  });

  it("normalizes example questions that the model returns as strings", async () => {
    const { markdown: _markdown, ...baseLesson } = completeLessonPlan();
    const modelLesson = {
      ...baseLesson,
      example_questions: [
        "题目：2x + 3 = 11，求 x 的值。答案：x = 4",
        "问题：小明买笔共花 10 元，每支 2 元，买了几支？答：5 支"
      ]
    };
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(modelLesson))
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({
      example_questions: [
        { question: "2x + 3 = 11，求 x 的值。", answer: "x = 4" },
        { question: "小明买笔共花 10 元，每支 2 元，买了几支？", answer: "5 支" }
      ],
      markdown: expect.stringContaining("答：x = 4")
    });
  });

  it("keeps question-only example strings instead of rejecting the full lesson", async () => {
    const { markdown: _markdown, ...baseLesson } = completeLessonPlan();
    const modelLesson = {
      ...baseLesson,
      example_questions: ["2x + 3 = 11，求 x 的值。", "小明买笔共花 10 元，每支 2 元，买了几支？"]
    };
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(modelLesson))
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({
      example_questions: [
        { question: "2x + 3 = 11，求 x 的值。", answer: "需教师补充答案" },
        { question: "小明买笔共花 10 元，每支 2 元，买了几支？", answer: "需教师补充答案" }
      ],
      markdown: expect.stringContaining("答：需教师补充答案")
    });
  });

  it("throws a clear Chinese error when text model config is missing", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(completeLessonPlan()))
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).rejects.toThrow("文本模型配置不完整，请先在设置页填写 API Key 和模型名。");
    expect(fakeClient.chatCompletion).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON instead of returning partial data", async () => {
    const fakeClient = {
      chatCompletion: async () => "{ this is not json"
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).rejects.toThrow();
  });

  it("rejects schema-invalid model output instead of returning partial data", async () => {
    const fakeClient = {
      chatCompletion: async () => JSON.stringify({ title: "只有标题" })
    };

    await expect(
      generateLessonPlan({
        topic: "一元一次方程",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).rejects.toThrow("grade_suggestion");
  });
});

describe("renderLessonMarkdown", () => {
  it("renders important lesson sections", () => {
    const markdown = renderLessonMarkdown(completeLessonPlan());

    expect(markdown).toContain("# 一元一次方程");
    expect(markdown).toContain("## 教学重点");
    expect(markdown).toContain("## 视频脚本");
    expect(markdown).toContain("## 视频提示词");
  });
});
