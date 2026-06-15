import type { VideoRecord } from "./historyStore.js";
import { submitVideoTask } from "./videoService.js";
import type { LessonPlan, ModelConfig } from "../shared/types.js";

type VideoWorkflowClient = {
  submitVideo(input: { apiKey: string; modelName: string; prompt: string }): Promise<string>;
};

type CreateVideoTaskFromLessonInput = {
  lessonId: string;
  lesson: LessonPlan;
  config: ModelConfig;
  client: VideoWorkflowClient;
};

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
