import { describe, expect, it, vi } from "vitest";
import {
  analyzeProblemForDemo,
  buildAnalyzeProblemPrompt,
  chooseDemoRenderer
} from "../../src/main/demo/demoService";
import type { ProblemDemoPlan } from "../../src/shared/types";

function equationPlan(overrides: Partial<ProblemDemoPlan> = {}): ProblemDemoPlan {
  return {
    kind: "equation",
    title: "年龄问题",
    originalProblem: "小明今年 12 岁，比妹妹年龄的 2 倍少 4 岁，妹妹几岁？",
    knownValues: [
      { label: "小明年龄", value: 12, unit: "岁" },
      { label: "少的岁数", value: 4, unit: "岁" }
    ],
    target: "求妹妹年龄",
    steps: ["设妹妹年龄为 x 岁", "根据题意列方程 2x - 4 = 12", "解得 x = 8"],
    equation: {
      variable: "x",
      relationship: "小明年龄 = 妹妹年龄的 2 倍 - 4",
      expression: "2x - 4 = 12",
      solution: "x = 8",
      verification: "2 × 8 - 4 = 12，符合题意"
    },
    ...overrides
  };
}

describe("buildAnalyzeProblemPrompt", () => {
  it("tells the model how to classify demo kinds and return JSON only", () => {
    const messages = buildAnalyzeProblemPrompt("小车每秒行 3 米，行 12 米需要几秒？");
    const combined = messages.map((message) => message.content).join("\n");

    expect(combined).toContain("motion");
    expect(combined).toContain("equation");
    expect(combined).toContain("只返回 JSON");
    expect(combined).toContain("路程/速度/时间题 -> motion");
    expect(combined).toContain("方程应用题 -> equation");
    expect(combined).toContain("小车每秒行 3 米");
  });
});

describe("analyzeProblemForDemo", () => {
  it("parses equation demo plan JSON returned by the injected client", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(equationPlan()))
    };

    const plan = await analyzeProblemForDemo({
      problem: "小明今年 12 岁，比妹妹年龄的 2 倍少 4 岁，妹妹几岁？",
      config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
      client: fakeClient
    });

    expect(plan.kind).toBe("equation");
    expect(plan.equation?.expression).toBe("2x - 4 = 12");
    expect(fakeClient.chatCompletion).toHaveBeenCalledWith({
      apiKey: "key",
      modelName: "Qwen/Qwen3-32B",
      messages: buildAnalyzeProblemPrompt("小明今年 12 岁，比妹妹年龄的 2 倍少 4 岁，妹妹几岁？"),
      maxTokens: 1800,
      temperature: 0.2,
      responseFormat: { type: "json_object" },
      thinkingBudget: 64
    });
  });

  it("throws a clear Chinese error when text model config is blank", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(equationPlan()))
    };

    await expect(
      analyzeProblemForDemo({
        problem: "解方程应用题",
        config: { apiKey: "   ", modelName: "" },
        client: fakeClient
      })
    ).rejects.toThrow("文本模型配置不完整，请先在设置页填写 API Key 和模型名。");
    expect(fakeClient.chatCompletion).not.toHaveBeenCalled();
  });

  it("strips fenced JSON before parsing", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => `\`\`\`json\n${JSON.stringify(equationPlan())}\n\`\`\``)
    };

    await expect(
      analyzeProblemForDemo({
        problem: "列方程解决年龄问题",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({ kind: "equation", title: "年龄问题" });
  });

  it("rejects unparseable JSON with a clear Chinese error", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => "{ bad json")
    };

    await expect(
      analyzeProblemForDemo({
        problem: "列方程解决年龄问题",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).rejects.toThrow("模型返回的题目演示 JSON 无法解析，请重试。");
  });

  it("rejects schema-invalid model output with a clear Chinese error", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify({ kind: "equation", title: "缺少字段" }))
    };

    await expect(
      analyzeProblemForDemo({
        problem: "列方程解决年龄问题",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).rejects.toThrow("模型返回的题目演示结构不完整，请重试。");
  });
});

describe("chooseDemoRenderer", () => {
  it("selects dedicated renderers for motion and equation, otherwise simple", () => {
    expect(chooseDemoRenderer({ ...equationPlan(), kind: "motion", motion: {
      startLabel: "家",
      endLabel: "学校",
      distance: 120,
      distanceUnit: "米",
      speed: 3,
      speedUnit: "米/秒",
      answerSeconds: 40
    } })).toBe("motion");
    expect(chooseDemoRenderer(equationPlan())).toBe("equation");
    expect(chooseDemoRenderer({ ...equationPlan(), kind: "geometry", equation: undefined })).toBe("simple");
  });
});
