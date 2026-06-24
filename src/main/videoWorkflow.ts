import type { VideoRecord } from "./historyStore.js";
import { submitVideoTask } from "./videoService.js";
import { createVideoSegmentPrompt } from "./videoSegmentPrompt.js";
import type { LessonPlan, ModelConfig, VideoSegmentTask, VideoTaskStatus } from "../shared/types.js";

type VideoWorkflowClient = {
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
  duration?: number;
};

type RefreshVideoTaskStatusInput = {
  task: VideoRecord;
  config: ModelConfig;
  client: VideoStatusClient & Partial<VideoWorkflowClient>;
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
    config: {
      ...config,
      modelName: toTextToVideoModelName(config.modelName)
    },
    prompt: buildVideoGenerationPrompt({
      prompt: lesson.video_prompt,
      script: lesson.video_script
    }),
    script: lesson.video_script,
    duration: 15
  });

  return {
    ...task,
    lessonId
  };
}

function toTextToVideoModelName(modelName: string): string {
  return modelName.replace(/I2V/gi, (match) => match[0] === "i" ? "t2v" : "T2V");
}

export async function createStandaloneVideoTask({
  config,
  client,
  prompt,
  script,
  image,
  imageSize,
  negativePrompt,
  duration
}: CreateStandaloneVideoTaskInput): Promise<VideoRecord> {
  return submitVideoTask({
    client,
    config,
    prompt: buildVideoGenerationPrompt({ prompt, script }),
    script,
    image,
    imageSize,
    negativePrompt,
    duration
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

  if (task.segmentRequests?.length) {
    return refreshSegmentedVideoTaskStatus({ task, config, client, now });
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

async function refreshSegmentedVideoTaskStatus({
  task,
  config,
  client,
  now
}: RefreshVideoTaskStatusInput): Promise<VideoRecord> {
  const updatedSegments: VideoSegmentTask[] = [];

  for (const segment of task.segmentRequests ?? []) {
    if (segment.status === "Succeed" || segment.status === "Failed") {
      updatedSegments.push(segment);
      continue;
    }

    if (segment.status === "Pending") {
      const previousSegment = updatedSegments[updatedSegments.length - 1];
      if (previousSegment?.status === "Succeed" && previousSegment.videoUrl) {
        if (!client.submitVideo) {
          throw new Error("视频生成服务未初始化。");
        }

        const requestId = await client.submitVideo({
          apiKey: config.apiKey,
          modelName: config.modelName,
          prompt: createVideoSegmentPrompt({
            prompt: task.prompt,
            script: task.script,
            index: segment.index,
            total: task.segmentRequests?.length ?? segment.index,
            duration: segment.duration,
            referencePrevious: true
          }),
          ...(task.imageSize ? { imageSize: task.imageSize } : {}),
          ...(task.negativePrompt ? { negativePrompt: task.negativePrompt } : {}),
          referenceVideo: previousSegment.videoUrl,
          duration: segment.duration
        });

        updatedSegments.push({
          ...segment,
          requestId,
          status: "InQueue"
        });
        continue;
      }

      updatedSegments.push(segment);
      continue;
    }

    if (!segment.requestId) {
      updatedSegments.push(segment);
      continue;
    }

    const statusResult = await client.getVideoStatus({
      apiKey: config.apiKey,
      requestId: segment.requestId
    });

    updatedSegments.push({
      ...segment,
      status: statusResult.status,
      ...(statusResult.videoUrl ? { videoUrl: statusResult.videoUrl } : {}),
      ...(statusResult.reason ? { reason: statusResult.reason } : {})
    });
  }

  const updatedAt = now();
  const failedSegment = updatedSegments.find((segment) => segment.status === "Failed");
  if (failedSegment) {
    return {
      ...task,
      status: "Failed",
      segmentRequests: updatedSegments,
      reason: failedSegment.reason ?? `第 ${failedSegment.index} 段视频生成失败。`,
      updatedAt
    };
  }

  const allSucceeded = updatedSegments.every((segment) => segment.status === "Succeed");
  if (allSucceeded) {
    return {
      ...task,
      status: "Succeed",
      videoUrl: updatedSegments[0]?.videoUrl,
      reason: undefined,
      segmentRequests: updatedSegments,
      updatedAt
    };
  }

  const anyInProgress = updatedSegments.some((segment) => segment.status === "InProgress");

  return {
    ...task,
    status: anyInProgress ? "InProgress" : "InQueue",
    requestId: createSegmentedRequestId(updatedSegments),
    segmentRequests: updatedSegments,
    updatedAt
  };
}

function createSegmentedRequestId(segments: VideoSegmentTask[]): string {
  const requestIds = segments
    .map((segment) => segment.requestId)
    .filter((requestId): requestId is string => Boolean(requestId));

  return `segments:${requestIds.join(",")}`;
}
