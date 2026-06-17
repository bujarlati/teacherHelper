import { describe, expect, it } from "vitest";
import {
  appSettingsSchema,
  defaultRerankerModelName,
  lessonPlanSchema,
  modelConfigSchema,
  problemDemoPlanSchema,
  videoStatusSchema
} from "../../src/shared/schemas";

describe("lessonPlanSchema", () => {
  it("accepts a complete lesson plan", () => {
    const parsed = lessonPlanSchema.parse({
      title: "一元一次方程",
      grade_suggestion: "七年级",
      teaching_goals: ["理解方程的意义"],
      key_points: ["列方程"],
      difficult_points: ["找等量关系"],
      common_confusions: ["把未知量和已知量混淆"],
      lesson_flow: [{ title: "导入", minutes: 5, activities: ["情境提问"] }],
      board_design: ["设未知数", "列方程", "解方程"],
      example_questions: [{ question: "小明买笔...", answer: "x=3" }],
      worked_solutions: [{ question: "小明买笔...", steps: ["设 x", "列式"], answer: "3 支" }],
      classroom_questions: ["为什么两边相等？"],
      homework_suggestions: ["完成 3 道同类题"],
      video_script: "展示天平两边保持平衡。",
      video_prompt: "A classroom animation showing equation balance.",
      markdown: "# 一元一次方程"
    });

    expect(parsed.title).toBe("一元一次方程");
  });
});

describe("problemDemoPlanSchema", () => {
  it("accepts a high-quality equation demo plan", () => {
    const parsed = problemDemoPlanSchema.parse({
      kind: "equation",
      title: "买笔问题",
      originalProblem: "每支笔 2 元，买了 x 支共 10 元。",
      knownValues: [{ label: "单价", value: 2, unit: "元" }],
      target: "求购买数量",
      steps: ["设购买 x 支", "列方程 2x=10", "解得 x=5"],
      equation: {
        variable: "x",
        relationship: "总价 = 单价 × 数量",
        expression: "2x = 10",
        solution: "x = 5",
        verification: "2 × 5 = 10"
      }
    });

    expect(parsed.kind).toBe("equation");
  });

  it("rejects a motion demo plan without motion data", () => {
    const result = problemDemoPlanSchema.safeParse({
      kind: "motion",
      title: "行程问题",
      originalProblem: "A/B 两地相距 1000m，小明速度是 2m/s。",
      knownValues: [{ label: "距离", value: 1000, unit: "m" }],
      target: "求走完全程需要几秒",
      steps: ["找距离", "找速度", "用时间 = 距离 ÷ 速度"]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "motion plan requires motion data", path: ["motion"] })
        ])
      );
    }
  });

  it("rejects an equation demo plan without equation data", () => {
    const result = problemDemoPlanSchema.safeParse({
      kind: "equation",
      title: "买笔问题",
      originalProblem: "每支笔 2 元，买了 x 支共 10 元。",
      knownValues: [{ label: "单价", value: 2, unit: "元" }],
      target: "求购买数量",
      steps: ["设购买 x 支", "列方程 2x=10", "解得 x=5"]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: "equation plan requires equation data", path: ["equation"] })
        ])
      );
    }
  });

  it("accepts a high-quality motion demo plan", () => {
    const parsed = problemDemoPlanSchema.parse({
      kind: "motion",
      title: "行程问题",
      originalProblem: "A/B 两地相距 1000m，小明速度是 2m/s。",
      knownValues: [
        { label: "距离", value: 1000, unit: "m" },
        { label: "速度", value: 2, unit: "m/s" }
      ],
      target: "求走完全程需要几秒",
      steps: ["找距离 1000m", "找速度 2m/s", "时间 = 1000 ÷ 2 = 500s"],
      motion: {
        startLabel: "A 地",
        endLabel: "B 地",
        distance: 1000,
        distanceUnit: "m",
        speed: 2,
        speedUnit: "m/s",
        answerSeconds: 500
      }
    });

    expect(parsed.motion?.answerSeconds).toBe(500);
  });
});

describe("modelConfigSchema", () => {
  it("accepts api key and model name settings", () => {
    const parsed = modelConfigSchema.parse({
      apiKey: "sk-test",
      modelName: "Qwen/Qwen3-32B"
    });

    expect(parsed.modelName).toBe("Qwen/Qwen3-32B");
  });
});

describe("appSettingsSchema", () => {
  it("accepts text, video, embedding, and qdrant setting groups", () => {
    const parsed = appSettingsSchema.parse({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" },
      embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
      qdrant: {
        mode: "remote",
        url: "https://cluster.example.qdrant.io",
        apiKey: "qdrant-key",
        collectionPrefix: "teacherhelper"
      }
    });

    expect(parsed.videoModel.apiKey).toBe("video-key");
    expect(parsed.embeddingModel.modelName).toBe("Qwen/Qwen3-VL-Embedding-8B");
    expect(parsed.rerankerModel.modelName).toBe(defaultRerankerModelName);
    expect(parsed.qdrant.mode).toBe("remote");
    expect(parsed.qdrant.url).toBe("https://cluster.example.qdrant.io");
    expect(parsed.qdrant.collectionPrefix).toBe("teacherhelper");
  });

  it("fills knowledge defaults for older settings files", () => {
    const parsed = appSettingsSchema.parse({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" }
    });

    expect(parsed.embeddingModel).toEqual({
      apiKey: "",
      modelName: "Qwen/Qwen3-VL-Embedding-8B"
    });
    expect(parsed.rerankerModel).toEqual({
      apiKey: "",
      modelName: defaultRerankerModelName
    });
    expect(parsed.qdrant).toEqual({
      mode: "local",
      url: "http://127.0.0.1:6333",
      apiKey: "",
      collectionPrefix: "teacherhelper"
    });
  });

  it("fills local qdrant mode for settings saved before local hosting", () => {
    const parsed = appSettingsSchema.parse({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" },
      embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
      qdrant: { url: "http://localhost:6333", apiKey: "", collectionPrefix: "teacherhelper" }
    });

    expect(parsed.qdrant).toEqual({
      mode: "local",
      url: "http://localhost:6333",
      apiKey: "",
      collectionPrefix: "teacherhelper"
    });
  });

  it("keeps explicit reranker settings when present", () => {
    const parsed = appSettingsSchema.parse({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" },
      embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
      rerankerModel: { apiKey: "rerank-key", modelName: "Qwen/Qwen3-VL-Reranker-8B" }
    });

    expect(parsed.rerankerModel).toEqual({
      apiKey: "rerank-key",
      modelName: "Qwen/Qwen3-VL-Reranker-8B"
    });
  });
});

describe("videoStatusSchema", () => {
  it("accepts a valid video status", () => {
    expect(videoStatusSchema.parse("InProgress")).toBe("InProgress");
  });

  it("rejects unsupported video statuses", () => {
    const result = videoStatusSchema.safeParse("Cancelled");

    expect(result.success).toBe(false);
  });
});
