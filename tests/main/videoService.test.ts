import { describe, expect, it, vi } from "vitest";
import { pollVideoUntilDone, submitVideoTask } from "../../src/main/videoService";
import type { ModelConfig, VideoTaskStatus } from "../../src/shared/types";

type SubmitClient = {
  submitVideo: (input: { apiKey: string; modelName: string; prompt: string }) => Promise<string>;
};

type StatusClient = {
  getVideoStatus: (input: {
    apiKey: string;
    requestId: string;
  }) => Promise<{ status: VideoTaskStatus; videoUrl?: string; reason?: string }>;
};

describe("submitVideoTask", () => {
  it("submits prompt through the client and creates a local queued task", async () => {
    const client: SubmitClient = {
      submitVideo: vi.fn().mockResolvedValue("request-123")
    };
    const config: ModelConfig = {
      apiKey: "video-key",
      modelName: "Wan-AI/Wan2.2-T2V-A14B"
    };

    const task = await submitVideoTask({
      client,
      config,
      prompt: "A clear classroom animation about equation balance.",
      script: "Show a balance scale with both sides changing together."
    });

    expect(client.submitVideo).toHaveBeenCalledWith({
      apiKey: "video-key",
      modelName: "Wan-AI/Wan2.2-T2V-A14B",
      prompt: "A clear classroom animation about equation balance."
    });
    expect(task).toMatchObject({
      requestId: "request-123",
      status: "InQueue",
      prompt: "A clear classroom animation about equation balance.",
      script: "Show a balance scale with both sides changing together."
    });
    expect(task.id).toEqual(expect.any(String));
    expect(task.id).not.toHaveLength(0);
    expect(Date.parse(task.createdAt)).not.toBeNaN();
    expect(Date.parse(task.updatedAt)).not.toBeNaN();
  });

  it("throws a clear Chinese error before calling the client when video model config is missing", async () => {
    const client: SubmitClient = {
      submitVideo: vi.fn()
    };

    await expect(
      submitVideoTask({
        client,
        config: { apiKey: "", modelName: "" },
        prompt: "A math animation.",
        script: "Show the math idea."
      })
    ).rejects.toThrow("请先配置视频模型 API Key 和模型名称。");
    expect(client.submitVideo).not.toHaveBeenCalled();
  });
});

describe("pollVideoUntilDone", () => {
  it("polls InProgress then Succeed and returns the video URL", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client: StatusClient = {
      getVideoStatus: vi
        .fn()
        .mockResolvedValueOnce({ status: "InProgress" })
        .mockResolvedValueOnce({ status: "Succeed", videoUrl: "https://cdn.example.test/video.mp4" })
    };

    await expect(
      pollVideoUntilDone({
        client,
        apiKey: "video-key",
        requestId: "request-123",
        intervalMs: 1,
        maxAttempts: 3,
        sleep
      })
    ).resolves.toEqual({
      status: "Succeed",
      videoUrl: "https://cdn.example.test/video.mp4"
    });

    expect(client.getVideoStatus).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1);
  });

  it("returns Failed immediately when provider returns Failed", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client: StatusClient = {
      getVideoStatus: vi.fn().mockResolvedValue({ status: "Failed", reason: "provider rejected prompt" })
    };

    await expect(
      pollVideoUntilDone({
        client,
        apiKey: "video-key",
        requestId: "request-123",
        intervalMs: 1,
        maxAttempts: 3,
        sleep
      })
    ).resolves.toEqual({
      status: "Failed",
      reason: "provider rejected prompt"
    });

    expect(client.getVideoStatus).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns Failed with a clear Chinese timeout reason after max attempts", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client: StatusClient = {
      getVideoStatus: vi.fn().mockResolvedValue({ status: "InProgress" })
    };

    await expect(
      pollVideoUntilDone({
        client,
        apiKey: "video-key",
        requestId: "request-123",
        intervalMs: 1,
        maxAttempts: 2,
        sleep
      })
    ).resolves.toEqual({
      status: "Failed",
      reason: "视频生成轮询超时，请稍后在任务历史中重试。"
    });

    expect(client.getVideoStatus).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not sleep after a terminal Succeed status", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client: StatusClient = {
      getVideoStatus: vi
        .fn()
        .mockResolvedValue({ status: "Succeed", videoUrl: "https://cdn.example.test/video.mp4" })
    };

    await pollVideoUntilDone({
      client,
      apiKey: "video-key",
      requestId: "request-123",
      intervalMs: 1,
      maxAttempts: 3,
      sleep
    });

    expect(client.getVideoStatus).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
