import { randomUUID } from "node:crypto";
import type { ModelConfig, VideoTask, VideoTaskStatus } from "../shared/types.js";

type VideoSubmitClient = {
  submitVideo(input: { apiKey: string; modelName: string; prompt: string }): Promise<string>;
};

type VideoStatusClient = {
  getVideoStatus(input: { apiKey: string; requestId: string }): Promise<VideoStatusResult>;
};

type VideoStatusResult = {
  status: VideoTaskStatus;
  videoUrl?: string;
  reason?: string;
};

type SubmitVideoTaskInput = {
  client: VideoSubmitClient;
  config: ModelConfig;
  prompt: string;
  script: string;
};

type PollVideoUntilDoneInput = {
  client: VideoStatusClient;
  apiKey: string;
  requestId: string;
  intervalMs: number;
  maxAttempts: number;
  sleep?: (intervalMs: number) => Promise<void>;
};

type PollVideoResult = {
  status: Extract<VideoTaskStatus, "Succeed" | "Failed">;
  videoUrl?: string;
  reason?: string;
};

const missingVideoConfigMessage = "请先配置视频模型 API Key 和模型名称。";
const timeoutMessage = "视频生成轮询超时，请稍后在任务历史中重试。";

export async function submitVideoTask(input: SubmitVideoTaskInput): Promise<VideoTask> {
  if (!input.config.apiKey.trim() || !input.config.modelName.trim()) {
    throw new Error(missingVideoConfigMessage);
  }

  const requestId = await input.client.submitVideo({
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    prompt: input.prompt
  });
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    requestId,
    status: "InQueue",
    prompt: input.prompt,
    script: input.script,
    createdAt: now,
    updatedAt: now
  };
}

export async function pollVideoUntilDone(input: PollVideoUntilDoneInput): Promise<PollVideoResult> {
  const sleep = input.sleep ?? delay;

  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    const result = await input.client.getVideoStatus({
      apiKey: input.apiKey,
      requestId: input.requestId
    });

    if (result.status === "Succeed") {
      if (!result.videoUrl) {
        return { status: "Failed", reason: "视频生成成功但未返回视频地址。" };
      }
      return { status: "Succeed", videoUrl: result.videoUrl };
    }

    if (result.status === "Failed") {
      return { status: "Failed", reason: result.reason };
    }

    if (attempt < input.maxAttempts) {
      await sleep(input.intervalMs);
    }
  }

  return { status: "Failed", reason: timeoutMessage };
}

function delay(intervalMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, intervalMs);
  });
}
