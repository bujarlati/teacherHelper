import { describe, expect, it, vi } from "vitest";
import {
  buildVideoGenerationPrompt,
  createStandaloneVideoTask,
  createVideoTaskFromLesson,
  refreshVideoTaskStatus
} from "../../src/main/videoWorkflow";
import type { ModelConfig, LessonPlan, VideoTaskStatus } from "../../src/shared/types";
import type { VideoRecord } from "../../src/main/historyStore";

type SubmitClient = {
  submitVideo: (input: {
    apiKey: string;
    modelName: string;
    prompt: string;
    image?: string;
    imageSize?: string;
    negativePrompt?: string;
    duration?: number;
    referenceVideo?: string;
  }) => Promise<string>;
};

type StatusClient = {
  submitVideo?: SubmitClient["submitVideo"];
  getVideoStatus: (input: {
    apiKey: string;
    requestId: string;
  }) => Promise<{ status: VideoTaskStatus; videoUrl?: string; reason?: string }>;
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
  it("submits a video task using a richer lesson video prompt and script", async () => {
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
      prompt: expect.stringContaining("镜头脚本：画面展示天平左右两边同时增加砝码，保持平衡。"),
      duration: 15
    });
    expect(record).toMatchObject({
      lessonId: "lesson-1",
      requestId: "request-lesson-1",
      status: "InQueue",
      prompt: expect.stringContaining("A classroom animation showing equation balance with a scale."),
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

  it("uses the matching text-to-video model for lesson videos when settings contain an image-to-video model", async () => {
    const client: SubmitClient = {
      submitVideo: vi.fn().mockResolvedValue("request-lesson-1")
    };

    await createVideoTaskFromLesson({
      lessonId: "lesson-1",
      lesson: createLesson(),
      config: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-I2V-A14B" },
      client
    });

    expect(client.submitVideo).toHaveBeenCalledWith(expect.objectContaining({
      modelName: "Wan-AI/Wan2.2-T2V-A14B"
    }));
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

describe("createStandaloneVideoTask", () => {
  it("submits and returns a standalone image-to-video record", async () => {
    const client: SubmitClient = {
      submitVideo: vi.fn().mockResolvedValue("request-video-1")
    };

    const record = await createStandaloneVideoTask({
      config: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-I2V-A14B" },
      client,
      prompt: "A number line animation explaining addition.",
      script: "Show one jump of A and another jump of B, then highlight A+B.",
      image: "data:image/png;base64,AAA",
      imageSize: "1280x720",
      negativePrompt: "low quality",
      duration: 15
    });

    expect(client.submitVideo).toHaveBeenCalledWith({
      apiKey: "video-key",
      modelName: "Wan-AI/Wan2.2-I2V-A14B",
      prompt: expect.stringContaining("A number line animation explaining addition."),
      image: "data:image/png;base64,AAA",
      imageSize: "1280x720",
      negativePrompt: "low quality",
      duration: 15
    });
    expect(record).toMatchObject({
      requestId: "request-video-1",
      status: "InQueue",
      prompt: expect.stringContaining("A number line animation explaining addition."),
      script: "Show one jump of A and another jump of B, then highlight A+B.",
      imageSize: "1280x720",
      negativePrompt: "low quality",
      duration: 15
    });
    expect(record.lessonId).toBeUndefined();
  });
});

describe("buildVideoGenerationPrompt", () => {
  it("combines the base prompt and script into a director-style prompt", () => {
    const prompt = buildVideoGenerationPrompt({
      prompt: "A clean classroom animation about equation balance.",
      script: "First show the full equation, then remove equal weights from both sides."
    });

    expect(prompt).toContain("A clean classroom animation about equation balance.");
    expect(prompt).toContain("镜头脚本：First show the full equation");
    expect(prompt).toContain("按时间顺序");
  });
});

describe("refreshVideoTaskStatus", () => {
  it("updates a queued video record with the provider status and video URL", async () => {
    const client: StatusClient = {
      getVideoStatus: vi.fn().mockResolvedValue({
        status: "Succeed",
        videoUrl: "https://cdn.example.test/video.mp4"
      })
    };
    const task = createVideoRecord({ status: "InQueue" });

    await expect(
      refreshVideoTaskStatus({
        task,
        config: { apiKey: "video-key", modelName: "video-model" },
        client,
        now: () => "2026-06-15T05:00:00.000Z"
      })
    ).resolves.toEqual({
      ...task,
      status: "Succeed",
      videoUrl: "https://cdn.example.test/video.mp4",
      reason: undefined,
      updatedAt: "2026-06-15T05:00:00.000Z"
    });

    expect(client.getVideoStatus).toHaveBeenCalledWith({
      apiKey: "video-key",
      requestId: "request-lesson-1"
    });
  });

  it("submits the next Seedance segment with the previous segment video as reference", async () => {
    const client: StatusClient = {
      getVideoStatus: vi.fn().mockResolvedValueOnce({ status: "Succeed", videoUrl: "https://cdn.example.test/1.mp4" }),
      submitVideo: vi.fn().mockResolvedValueOnce("ark:segment-2")
    };
    const task = createVideoRecord({
      requestId: "segments:ark:segment-1",
      duration: 60,
      segmentRequests: [
        { index: 1, requestId: "ark:segment-1", status: "InQueue", duration: 15 },
        { index: 2, status: "Pending", duration: 15 },
        { index: 3, status: "Pending", duration: 15 },
        { index: 4, status: "Pending", duration: 15 }
      ]
    });

    await expect(
      refreshVideoTaskStatus({
        task,
        config: { apiKey: "ark-key", modelName: "doubao-seedance-2-0-260128" },
        client,
        now: () => "2026-06-15T05:00:00.000Z"
      })
    ).resolves.toMatchObject({
      status: "InQueue",
      requestId: "segments:ark:segment-1,ark:segment-2",
      updatedAt: "2026-06-15T05:00:00.000Z",
      segmentRequests: [
        { index: 1, requestId: "ark:segment-1", status: "Succeed", videoUrl: "https://cdn.example.test/1.mp4" },
        { index: 2, requestId: "ark:segment-2", status: "InQueue", duration: 15 },
        { index: 3, status: "Pending", duration: 15 },
        { index: 4, status: "Pending", duration: 15 }
      ]
    });

    expect(client.getVideoStatus).toHaveBeenCalledTimes(1);
    expect(client.submitVideo).toHaveBeenCalledWith(expect.objectContaining({
      referenceVideo: "https://cdn.example.test/1.mp4",
      duration: 15,
      prompt: expect.stringContaining("第 2/4 段")
    }));
  });

  it("marks a successful provider response without a URL as failed", async () => {
    const client: StatusClient = {
      getVideoStatus: vi.fn().mockResolvedValue({ status: "Succeed" })
    };
    const task = createVideoRecord({ status: "InProgress" });

    await expect(
      refreshVideoTaskStatus({
        task,
        config: { apiKey: "video-key", modelName: "video-model" },
        client,
        now: () => "2026-06-15T05:00:00.000Z"
      })
    ).resolves.toMatchObject({
      status: "Failed",
      reason: "视频生成成功但未返回视频地址。",
      updatedAt: "2026-06-15T05:00:00.000Z"
    });
  });

  it("requires a video API key before refreshing status", async () => {
    const client: StatusClient = {
      getVideoStatus: vi.fn()
    };

    await expect(
      refreshVideoTaskStatus({
        task: createVideoRecord(),
        config: { apiKey: "", modelName: "video-model" },
        client,
        now: () => "2026-06-15T05:00:00.000Z"
      })
    ).rejects.toThrow("请先配置视频模型 API Key。");
    expect(client.getVideoStatus).not.toHaveBeenCalled();
  });
});

function createVideoRecord(overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    id: "video-1",
    lessonId: "lesson-1",
    requestId: "request-lesson-1",
    status: "InQueue",
    prompt: "A classroom animation showing equation balance with a scale.",
    script: "画面展示天平左右两边同时增加砝码，保持平衡。",
    createdAt: "2026-06-15T01:02:03.000Z",
    updatedAt: "2026-06-15T01:02:03.000Z",
    ...overrides
  };
}
