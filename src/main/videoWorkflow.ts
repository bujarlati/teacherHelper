import type { VideoRecord } from "./historyStore.js";
import { submitVideoTask } from "./videoService.js";
import type { LessonPlan, ModelConfig, VideoTaskStatus } from "../shared/types.js";

type VideoWorkflowClient = {
  submitVideo(input: {
    apiKey: string;
    modelName: string;
    prompt: string;
    image?: string;
    imageSize?: string;
    negativePrompt?: string;
  }): Promise<string>;
};

type VideoStatusClient = {
  getVideoStatus(input: { apiKey: string; requestId: string }): Promise<{
    status: VideoTaskStatus;
    videoUrl?: string;
    reason?: string;
  }>;
};

type CreateVideoTaskFromLessonInput = {
  lessonId: string;
  lesson: LessonPlan;
  config: ModelConfig;
  client: VideoWorkflowClient;
};

type CreateStandaloneVideoTaskInput = {
  config: ModelConfig;
  client: VideoWorkflowClient;
  prompt: string;
  script: string;
  image?: string;
  imageSize?: string;
  negativePrompt?: string;
};

type RefreshVideoTaskStatusInput = {
  task: VideoRecord;
  config: ModelConfig;
  client: VideoStatusClient;
  now: () => string;
};

const missingVideoApiKeyMessage = "请先配置视频模型 API Key。";
const missingVideoUrlMessage = "视频生成成功但未返回视频地址。";
const unknownFailureMessage = "视频生成失败，服务商未返回原因。";

export async function createVideoTaskFromLesson({
  lessonId,
  lesson,
  config,
  client
}: CreateVideoTaskFromLessonInput): Promise<VideoRecord> {
  const task = await submitVideoTask({
    client,
    config,
    prompt: buildVideoGenerationPrompt({
      prompt: lesson.video_prompt,
      script: lesson.video_script
    }),
    script: lesson.video_script
  });

  return {
    ...task,
    lessonId
  };
}

export async function createStandaloneVideoTask({
  config,
  client,
  prompt,
  script,
  image,
  imageSize,
  negativePrompt
}: CreateStandaloneVideoTaskInput): Promise<VideoRecord> {
  return submitVideoTask({
    client,
    config,
    prompt: buildVideoGenerationPrompt({ prompt, script }),
    script,
    image,
    imageSize,
    negativePrompt
  });
}

export function buildVideoGenerationPrompt(input: { prompt: string; script?: string }): string {
  const prompt = input.prompt.trim();
  const script = input.script?.trim();

  if (!script) {
    return prompt;
  }

  return [
    prompt,
    `镜头脚本：${script}`,
    "要求：按时间顺序呈现，画面用于课堂讲解，动作和镜头变化清晰连贯，文字标注简洁可读，整体像一段完整的教学演示视频。"
  ].join("\n");
}

export async function refreshVideoTaskStatus({
  task,
  config,
  client,
  now
}: RefreshVideoTaskStatusInput): Promise<VideoRecord> {
  if (!config.apiKey.trim()) {
    throw new Error(missingVideoApiKeyMessage);
  }

  const statusResult = await client.getVideoStatus({
    apiKey: config.apiKey,
    requestId: task.requestId
  });
  const baseTask = {
    ...task,
    status: statusResult.status,
    updatedAt: now()
  };

  if (statusResult.status === "Succeed") {
    if (!statusResult.videoUrl) {
      return {
        ...baseTask,
        status: "Failed",
        videoUrl: undefined,
        reason: missingVideoUrlMessage
      };
    }

    return {
      ...baseTask,
      videoUrl: statusResult.videoUrl,
      reason: undefined
    };
  }

  if (statusResult.status === "Failed") {
    return {
      ...baseTask,
      videoUrl: undefined,
      reason: statusResult.reason || unknownFailureMessage
    };
  }

  return {
    ...baseTask,
    reason: statusResult.reason ?? task.reason
  };
}
