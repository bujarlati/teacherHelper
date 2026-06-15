import type { VideoRecord } from "./historyStore.js";
import { submitVideoTask } from "./videoService.js";
import type { LessonPlan, ModelConfig, VideoTaskStatus } from "../shared/types.js";

type VideoWorkflowClient = {
  submitVideo(input: { apiKey: string; modelName: string; prompt: string }): Promise<string>;
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
    prompt: lesson.video_prompt,
    script: lesson.video_script
  });

  return {
    ...task,
    lessonId
  };
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
