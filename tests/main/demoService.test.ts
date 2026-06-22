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

function motionPlan(overrides: Partial<ProblemDemoPlan> = {}): ProblemDemoPlan {
  return {
    kind: "motion",
    title: "行程问题",
    originalProblem: "A、B 两地相距 1000 米，小明速度 2 米/秒，需要几秒？",
    knownValues: [
      { label: "路程", value: 1000, unit: "米" },
      { label: "速度", value: 2, unit: "米/秒" }
    ],
    target: "求小明走完全程需要的时间",
    steps: ["找到路程和速度", "用时间=路程÷速度", "1000÷2=500"],
    motion: {
      startLabel: "A 地",
      endLabel: "B 地",
      distance: 1000,
      distanceUnit: "米",
      speed: 2,
      speedUnit: "米/秒",
      answerSeconds: 500
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
    expect(combined).toContain("knownValues 可以为空数组");
    expect(combined).toContain("steps 必须是字符串数组");
    expect(combined).toContain("不能为了省字段把适合 motion 或 equation 的题目改成 simple");
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
      maxTokens: 3200,
      temperature: 0.15,
      responseFormat: { type: "json_object" },
      thinkingBudget: 128
    });
  });

  it("keeps a high-quality demo when the model returns rich step objects", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify(equationPlan({
        steps: [
          { title: "设未知数", description: "设妹妹年龄为 x 岁" },
          { title: "列方程", detail: "根据题意列方程 2x - 4 = 12" },
          { text: "解得 x = 8" }
        ] as unknown as string[]
      })))
    };

    await expect(
      analyzeProblemForDemo({
        problem: "小明今年 12 岁，比妹妹年龄的 2 倍少 4 岁，妹妹几岁？",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toMatchObject({
      kind: "equation",
      steps: ["设未知数：设妹妹年龄为 x 岁", "列方程：根据题意列方程 2x - 4 = 12", "解得 x = 8"]
    });
    expect(fakeClient.chatCompletion).toHaveBeenCalledTimes(1);
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

  it("keeps retrying unparseable JSON and then returns a clear Chinese error", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => "{ bad json")
    };

    await expect(
      analyzeProblemForDemo({
        problem: "列方程解决年龄问题",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).rejects.toThrow("模型连续 3 次未返回可解析的题目演示 JSON，请重试。");
    expect(fakeClient.chatCompletion).toHaveBeenCalledTimes(3);
  });

  it("asks the model again when the first demo plan is schema-incomplete", async () => {
    const fakeClient = {
      chatCompletion: vi.fn()
        .mockResolvedValueOnce(JSON.stringify({ kind: "equation", title: "缺少字段" }))
        .mockResolvedValueOnce(JSON.stringify(equationPlan()))
    };

    await expect(
      analyzeProblemForDemo({
        problem: "列方程解决年龄问题",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toEqual(equationPlan());
    expect(fakeClient.chatCompletion).toHaveBeenCalledTimes(2);
    expect(fakeClient.chatCompletion).toHaveBeenNthCalledWith(2, expect.objectContaining({
      maxTokens: 3200,
      thinkingBudget: 128,
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("上一次返回不符合题目演示 JSON 结构")
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("equation")
        })
      ])
    }));
  });

  it("does not downgrade specialized demos and retries until motion data is complete", async () => {
    const fakeClient = {
      chatCompletion: vi.fn()
        .mockResolvedValueOnce(JSON.stringify({
          kind: "motion",
          title: "行程问题",
          originalProblem: "A、B 两地相距 1000 米，小明速度 2 米/秒，需要几秒？",
          knownValues: [{ label: "距离", value: 1000, unit: "米" }],
          target: "求时间",
          steps: ["用时间=路程÷速度"]
        }))
        .mockResolvedValueOnce(JSON.stringify(motionPlan()))
    };

    await expect(
      analyzeProblemForDemo({
        problem: "A、B 两地相距 1000 米，小明速度 2 米/秒，需要几秒？",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toEqual(motionPlan());
    expect(fakeClient.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("retries invalid JSON before returning a parse error", async () => {
    const fakeClient = {
      chatCompletion: vi.fn()
        .mockResolvedValueOnce("{ bad json")
        .mockResolvedValueOnce("{ still bad")
        .mockResolvedValueOnce(JSON.stringify(equationPlan()))
    };

    await expect(
      analyzeProblemForDemo({
        problem: "列方程解决年龄问题",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).resolves.toEqual(equationPlan());
    expect(fakeClient.chatCompletion).toHaveBeenCalledTimes(3);
  });

  it("keeps failing after all repair attempts return incomplete JSON", async () => {
    const fakeClient = {
      chatCompletion: vi.fn(async () => JSON.stringify({ kind: "equation", title: "仍然缺字段" }))
    };

    await expect(
      analyzeProblemForDemo({
        problem: "列方程解决年龄问题",
        config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
        client: fakeClient
      })
    ).rejects.toThrow("模型连续 3 次未返回完整题目演示结构");
    expect(fakeClient.chatCompletion).toHaveBeenCalledTimes(3);
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
