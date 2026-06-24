import { randomUUID } from "node:crypto";
import type { ModelConfig, VideoSegmentTask, VideoTask, VideoTaskStatus } from "../shared/types.js";
import { createVideoSegmentPrompt } from "./videoSegmentPrompt.js";

type VideoSubmitClient = {
  submitVideo(input: {
    apiKey: string;
    modelName: string;
    prompt: string;
    image?: string;
    imageSize?: string;
    negativePrompt?: string;
    duration?: number;
    referenceVideo?: string;
  }): Promise<string>;
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
  image?: string;
  imageSize?: string;
  negativePrompt?: string;
  duration?: number;
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
const defaultVideoDurationSeconds = 15;
const maxProviderVideoDurationSeconds = 15;

export async function submitVideoTask(input: SubmitVideoTaskInput): Promise<VideoTask> {
  if (!input.config.apiKey.trim() || !input.config.modelName.trim()) {
    throw new Error(missingVideoConfigMessage);
  }
  if (isImageToVideoModel(input.config.modelName) && !input.image?.trim()) {
    throw new Error(
      `图生视频模型需要参考图片，请上传图片或改用文生视频模型 ${toTextToVideoModelName(input.config.modelName)}。`
    );
  }

  const requestedDuration = input.duration ?? defaultVideoDurationSeconds;
  if (isSeedanceModel(input.config.modelName) && requestedDuration > maxProviderVideoDurationSeconds) {
    return submitSegmentedVideoTask(input, requestedDuration);
  }

  const submitInput: Parameters<VideoSubmitClient["submitVideo"]>[0] = {
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    prompt: input.prompt
  };

  if (input.image) submitInput.image = input.image;
  if (input.imageSize) submitInput.imageSize = input.imageSize;
  if (input.negativePrompt) submitInput.negativePrompt = input.negativePrompt;
  submitInput.duration = input.duration ?? defaultVideoDurationSeconds;

  const requestId = await input.client.submitVideo(submitInput);
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    requestId,
    status: "InQueue",
    prompt: input.prompt,
    script: input.script,
    imageSize: input.imageSize,
    duration: input.duration ?? defaultVideoDurationSeconds,
    negativePrompt: input.negativePrompt,
    createdAt: now,
    updatedAt: now
  };
}

async function submitSegmentedVideoTask(input: SubmitVideoTaskInput, requestedDuration: number): Promise<VideoTask> {
  const segments = createVideoSegments(requestedDuration);
  const segmentRequests: VideoSegmentTask[] = [];
  const firstDuration = segments[0] ?? maxProviderVideoDurationSeconds;
  const firstRequestId = await input.client.submitVideo({
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    prompt: createVideoSegmentPrompt({
      prompt: input.prompt,
      script: input.script,
      index: 1,
      total: segments.length,
      duration: firstDuration
    }),
    ...(input.image ? { image: input.image } : {}),
    ...(input.imageSize ? { imageSize: input.imageSize } : {}),
    ...(input.negativePrompt ? { negativePrompt: input.negativePrompt } : {}),
    duration: firstDuration
  });

  segmentRequests.push({
    index: 1,
    requestId: firstRequestId,
    status: "InQueue",
    duration: firstDuration
  });

  for (const [index, duration] of segments.slice(1).entries()) {
    segmentRequests.push({
      index: index + 2,
      status: "Pending",
      duration
    });
  }

  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    requestId: `segments:${firstRequestId}`,
    status: "InQueue",
    prompt: input.prompt,
    script: input.script,
    imageSize: input.imageSize,
    duration: requestedDuration,
    negativePrompt: input.negativePrompt,
    segmentRequests,
    createdAt: now,
    updatedAt: now
  };
}

function createVideoSegments(duration: number): number[] {
  const segments: number[] = [];
  let remaining = duration;

  while (remaining > 0) {
    const segmentDuration = Math.min(maxProviderVideoDurationSeconds, remaining);
    segments.push(segmentDuration);
    remaining -= segmentDuration;
  }

  return segments;
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

function isImageToVideoModel(modelName: string): boolean {
  return /I2V/i.test(modelName);
}

function isSeedanceModel(modelName: string): boolean {
  return /(?:^|\/)doubao-seedance-|(?:^|\/)seedance-/i.test(modelName);
}

function toTextToVideoModelName(modelName: string): string {
  return modelName.replace(/I2V/gi, (match) => match[0] === "i" ? "t2v" : "T2V");
}
