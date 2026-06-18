import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { AppSettings, LessonImageAsset, LessonPlan } from "../shared/types.js";

type LessonImagePrompt = {
  title: string;
  prompt: string;
};

export type ImageGenerationClientLike = {
  createImage(input: {
    apiKey: string;
    modelName: string;
    prompt: string;
    imageSize?: string;
    negativePrompt?: string;
  }): Promise<{ imageUrl: string }>;
};

type GenerateLessonImagesInput = {
  lesson: LessonPlan;
  lessonId: string;
  config: AppSettings["imageModel"];
  client: unknown;
  dataDir: string;
  fetchImpl?: typeof fetch;
};

const defaultImageSize = "1024x1024";
const imageNegativePrompt = "low quality, blurry, watermark, dense text, copyrighted character, scary scene";

export function createLessonImagePrompts(lesson: LessonPlan): LessonImagePrompt[] {
  const title = compactText(lesson.title);
  const keyPoints = compactList(lesson.key_points, "核心概念");
  const confusions = compactList(lesson.common_confusions, "常见疑点");

  return [
    {
      title: "故事导入图",
      prompt: [
        `为一节“${title}”课程生成一张课堂故事导入插图。`,
        `画面要适合中小学生，明亮、有趣、有课堂任务感，突出${keyPoints}。`,
        "使用温暖的教室或校园场景，人物表情专注好奇，构图清晰，少量中文板书即可。"
      ].join(" ")
    },
    {
      title: "生活场景图",
      prompt: [
        `为“${title}”生成一张生活化数学场景图。`,
        `画面要把抽象知识变成学生熟悉的购物、运动、路线、测量或课堂活动，避免密集文字。`,
        `重点帮助学生看见：${keyPoints}。`
      ].join(" ")
    },
    {
      title: "原理观察图",
      prompt: [
        `为“${title}”生成一张原理观察图，风格为清爽教学插画。`,
        `用图形、箭头、简单标注表现关键关系，并提醒学生容易混淆的地方：${confusions}。`,
        "画面应便于投屏讲解，留出干净空间给老师二次提问。"
      ].join(" ")
    }
  ];
}

export async function generateLessonImages(input: GenerateLessonImagesInput): Promise<LessonImageAsset[]> {
  const apiKey = input.config.apiKey.trim();
  const modelName = input.config.modelName.trim();
  if (!apiKey || !modelName) {
    return [];
  }

  const client = asImageGenerationClient(input.client);
  const prompts = createLessonImagePrompts(input.lesson);
  const assets: LessonImageAsset[] = [];

  for (const [index, prompt] of prompts.entries()) {
    const generated = await client.createImage({
      apiKey,
      modelName,
      prompt: prompt.prompt,
      imageSize: defaultImageSize,
      negativePrompt: imageNegativePrompt
    });
    const downloaded = await downloadGeneratedImage({
      dataDir: input.dataDir,
      lessonId: input.lessonId,
      index,
      imageUrl: generated.imageUrl,
      fetchImpl: input.fetchImpl
    });

    assets.push({
      title: prompt.title,
      prompt: prompt.prompt,
      src: downloaded.dataUrl,
      localPath: downloaded.filePath
    });
  }

  return assets;
}

function asImageGenerationClient(client: unknown): ImageGenerationClientLike {
  if (
    typeof client === "object"
    && client !== null
    && "createImage" in client
    && typeof (client as { createImage?: unknown }).createImage === "function"
  ) {
    return client as ImageGenerationClientLike;
  }

  throw new Error("图片生成服务未初始化。");
}

async function downloadGeneratedImage(input: {
  dataDir: string;
  lessonId: string;
  index: number;
  imageUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{ filePath: string; dataUrl: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(input.imageUrl);

  if (!response.ok) {
    throw new Error(`图片下载失败：HTTP ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = normalizeImageContentType(response.headers.get("content-type"));
  const extension = inferImageExtension(input.imageUrl, contentType);
  const imageDir = join(input.dataDir, "lesson-images");
  await mkdir(imageDir, { recursive: true });

  const filePath = join(imageDir, `${safeFileName(input.lessonId)}-${String(input.index + 1).padStart(2, "0")}${extension}`);
  await writeFile(filePath, bytes);

  return {
    filePath,
    dataUrl: `data:${contentType};base64,${bytes.toString("base64")}`
  };
}

function normalizeImageContentType(contentType: string | null): string {
  if (!contentType) return "image/png";
  const type = contentType.split(";")[0]?.trim().toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") return "image/jpeg";
  if (type === "image/webp") return "image/webp";
  if (type === "image/png") return "image/png";

  return "image/png";
}

function inferImageExtension(imageUrl: string, contentType: string): string {
  try {
    const extension = extname(new URL(imageUrl).pathname).toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
      return extension === ".jpeg" ? ".jpg" : extension;
    }
  } catch {
    // Fall through to content-type based inference.
  }

  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/webp") return ".webp";

  return ".png";
}

function compactList(values: string[], fallback: string): string {
  const compacted = values.map(compactText).filter(Boolean).slice(0, 3).join("、");
  return compacted || fallback;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeFileName(value: string): string {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .slice(0, 100);

  return safe || "lesson";
}
