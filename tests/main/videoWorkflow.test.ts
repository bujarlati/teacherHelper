import { describe, expect, it, vi } from "vitest";
import { createVideoTaskFromLesson } from "../../src/main/videoWorkflow";
import type { ModelConfig, LessonPlan } from "../../src/shared/types";

type SubmitClient = {
  submitVideo: (input: { apiKey: string; modelName: string; prompt: string }) => Promise<string>;
};

function createLesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    title: "一元一次方程",
    grade_suggestion: "七年级",
    teaching_goals: ["理解等式性质"],
    key_points: ["移项与合并同类项"],
    difficult_points: ["等式两边同步变化"],
    common_confusions: ["只改变等式一边"],
    lesson_flow: [{ title: "导入", minutes: 5, activities: ["观察天平"] }],
    board_design: ["等式两边同时加减同一个数"],
    example_questions: [{ question: "x + 2 = 5", answer: "x = 3" }],
    worked_solutions: [
      {
        question: "2x + 1 = 7",
        steps: ["两边减 1", "两边除以 2"],
        answer: "x = 3"
      }
    ],
    classroom_questions: ["为什么两边要同时变化？"],
    homework_suggestions: ["完成 5 道等式性质练习"],
    video_script: "画面展示天平左右两边同时增加砝码，保持平衡。",
    video_prompt: "A classroom animation showing equation balance with a scale.",
    markdown: "# 一元一次方程",
    ...overrides
  };
}

describe("createVideoTaskFromLesson", () => {
  it("submits a video task using the lesson video prompt and script", async () => {
    const client: SubmitClient = {
      submitVideo: vi.fn().mockResolvedValue("request-lesson-1")
    };
    const config: ModelConfig = {
      apiKey: "video-key",
      modelName: "Wan-AI/Wan2.2-T2V-A14B"
    };
    const lesson = createLesson();

    const record = await createVideoTaskFromLesson({
      lessonId: "lesson-1",
      lesson,
      config,
      client
    });

    expect(client.submitVideo).toHaveBeenCalledWith({
      apiKey: "video-key",
      modelName: "Wan-AI/Wan2.2-T2V-A14B",
      prompt: "A classroom animation showing equation balance with a scale."
    });
    expect(record).toMatchObject({
      lessonId: "lesson-1",
      requestId: "request-lesson-1",
      status: "InQueue",
      prompt: "A classroom animation showing equation balance with a scale.",
      script: "画面展示天平左右两边同时增加砝码，保持平衡。"
    });
    expect(record.id).toEqual(expect.any(String));
    expect(record.id).not.toHaveLength(0);
    expect(Date.parse(record.createdAt)).not.toBeNaN();
    expect(Date.parse(record.updatedAt)).not.toBeNaN();
  });

  it("propagates missing video config errors without calling the client", async () => {
    const client: SubmitClient = {
      submitVideo: vi.fn()
    };

    await expect(
      createVideoTaskFromLesson({
        lessonId: "lesson-1",
        lesson: createLesson(),
        config: { apiKey: "", modelName: "" },
        client
      })
    ).rejects.toThrow("请先配置视频模型 API Key 和模型名称。");
    expect(client.submitVideo).not.toHaveBeenCalled();
  });

  it("does not modify the lesson object", async () => {
    const client: SubmitClient = {
      submitVideo: vi.fn().mockResolvedValue("request-lesson-1")
    };
    const lesson = Object.freeze(createLesson());
    const lessonBefore = structuredClone(lesson);

    await createVideoTaskFromLesson({
      lessonId: "lesson-1",
      lesson,
      config: { apiKey: "video-key", modelName: "video-model" },
      client
    });

    expect(lesson).toEqual(lessonBefore);
  });
});
