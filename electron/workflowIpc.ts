import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { lessonPlanSchema } from "../src/shared/schemas.js";
import type {
  AppSettings,
  KnowledgeConnectionTestResult,
  LessonPlan,
  LocalQdrantStatus,
  ProblemDemoPlan,
  TextbookIndexItem,
  TextbookRecord,
  TextbookSearchResult
} from "../src/shared/types.js";
import type { DemoRecord, LessonRecord, VideoRecord } from "../src/main/historyStore.js";
import type { EmbeddingClientLike, QdrantClientLike as KnowledgeQdrantClientLike } from "../src/main/knowledgeConnectionService.js";
import type { IpcMainLike } from "./settingsIpc.js";

type DemoServer = {
  url: string;
  close(): Promise<void>;
};

type ConfigStoreLike = {
  load(): Promise<AppSettings>;
};

type HistoryStoreLike = {
  addLesson(record: LessonRecord): Promise<void>;
  addDemo(record: DemoRecord): Promise<void>;
  upsertVideo(record: VideoRecord): Promise<void>;
  listLessons(): Promise<LessonRecord[]>;
  listDemos(): Promise<DemoRecord[]>;
  listVideos(): Promise<VideoRecord[]>;
};

type TextbookStoreLike = {
  upsert(record: TextbookRecord): Promise<void>;
  list(): Promise<TextbookRecord[]>;
};

type QdrantClientLike = KnowledgeQdrantClientLike & {
  ensureCollection(input: {
    url: string;
    apiKey: string;
    collectionName: string;
    vectorSize: number;
  }): Promise<void>;
  upsertPoints(input: {
    url: string;
    apiKey: string;
    collectionName: string;
    points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>;
  }): Promise<void>;
  searchPoints(input: {
    url: string;
    apiKey: string;
    collectionName: string;
    vector: number[];
    limit: number;
  }): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>>;
};

type WorkflowDeps = {
  configStore: ConfigStoreLike;
  historyStore: HistoryStoreLike;
  textbookStore?: TextbookStoreLike;
  dataDir: string;
  client: unknown;
  qdrantClient?: QdrantClientLike;
  localQdrantManager?: {
    ensureRunning(settings: AppSettings): Promise<LocalQdrantStatus>;
    getStatus(): LocalQdrantStatus;
  };
  createId(): string;
  now(): string;
  testKnowledgeConnections?(input: {
    settings: AppSettings;
    embeddingClient: EmbeddingClientLike;
    qdrantClient: QdrantClientLike;
  }): Promise<KnowledgeConnectionTestResult>;
  generateLessonPlan(input: { topic: string; config: AppSettings["textModel"]; client: unknown }): Promise<LessonPlan>;
  createVideoTaskFromLesson(input: {
    lessonId: string;
    lesson: LessonPlan;
    config: AppSettings["videoModel"];
    client: unknown;
  }): Promise<VideoRecord>;
  createStandaloneVideoTask?(input: {
    config: AppSettings["videoModel"];
    client: unknown;
    prompt: string;
    script: string;
    image?: string;
    imageSize?: string;
    negativePrompt?: string;
  }): Promise<VideoRecord>;
  refreshVideoTaskStatus(input: {
    task: VideoRecord;
    config: AppSettings["videoModel"];
    client: unknown;
    now: () => string;
  }): Promise<VideoRecord>;
  analyzeProblemForDemo(input: {
    problem: string;
    config: AppSettings["textModel"];
    client: unknown;
  }): Promise<ProblemDemoPlan>;
  chooseDemoRenderer(plan: ProblemDemoPlan): "motion" | "equation" | "simple";
  renderMotionDemoHtml(plan: ProblemDemoPlan): string;
  renderEquationDemoHtml(plan: ProblemDemoPlan): string;
  renderSimpleDemoHtml(plan: ProblemDemoPlan): string;
  startDemoServer(rootDir: string): Promise<DemoServer>;
  openExternal(url: string): Promise<void>;
  exportLessonDocx(input: { filePath: string; lesson: LessonPlan }): Promise<void>;
  indexTextbook?(input: {
    id: string;
    title: string;
    sourceName?: string;
    sourceNames?: string[];
    items: TextbookIndexItem[];
    settings: AppSettings;
    embeddingClient: EmbeddingClientLike;
    qdrantClient: QdrantClientLike;
    textbookStore: TextbookStoreLike;
    dataDir: string;
    now: () => string;
    createPointId: () => string;
  }): Promise<TextbookRecord>;
  searchTextbookIndex?(input: {
    query: string;
    settings: AppSettings;
    embeddingClient: EmbeddingClientLike;
    qdrantClient: QdrantClientLike;
    limit: number;
  }): Promise<TextbookSearchResult[]>;
};

const nonEmptyStringSchema = z.string().trim().min(1);
const optionalTrimmedStringSchema = z.string().trim().optional().transform((value) => value || undefined);
const videoImageSizeSchema = z.enum(["1280x720", "720x1280", "960x960"]);
const generateVideoInputSchema = z.object({
  prompt: nonEmptyStringSchema,
  script: z.string().trim().optional().default(""),
  imageDataUrl: optionalTrimmedStringSchema,
  imageSize: videoImageSizeSchema.default("1280x720"),
  negativePrompt: optionalTrimmedStringSchema
});
const exportLessonInputSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  lesson: lessonPlanSchema
});
const textbookIndexItemSchema = z.object({
  kind: z.enum(["page", "crop"]),
  pageNumber: z.number().int().positive(),
  imageDataUrl: z.string().trim().min(1),
  sourceName: nonEmptyStringSchema.optional(),
  sourcePageNumber: z.number().int().positive().optional(),
  cropRect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional()
});
const textbookIndexInputSchema = z.object({
  title: nonEmptyStringSchema,
  sourceName: nonEmptyStringSchema.optional(),
  sourceNames: z.array(nonEmptyStringSchema).min(1).optional(),
  items: z.array(textbookIndexItemSchema).min(1)
}).superRefine((value, ctx) => {
  if (!value.sourceName && !value.sourceNames?.length) {
    ctx.addIssue({
      code: "custom",
      message: "textbook index requires at least one PDF source name",
      path: ["sourceNames"]
    });
  }
});
const textbookSearchInputSchema = z.object({
  query: nonEmptyStringSchema,
  limit: z.number().int().positive().max(20).default(6)
});

export function registerWorkflowIpcHandlers(ipcMainLike: IpcMainLike, deps: WorkflowDeps): void {
  let activeDemoServer: DemoServer | undefined;
  let demoQueue: Promise<unknown> = Promise.resolve();

  ipcMainLike.handle("lesson:generate", async (_event, topicInput) => {
    const topic = nonEmptyStringSchema.parse(topicInput);
    const settings = await deps.configStore.load();
    const lesson = await deps.generateLessonPlan({ topic, config: settings.textModel, client: deps.client });
    const id = deps.createId();
    const createdAt = deps.now();

    await deps.historyStore.addLesson({
      id,
      title: lesson.title,
      topic,
      markdown: lesson.markdown,
      createdAt
    });

    let videoTask: VideoRecord | undefined;
    let videoError: string | undefined;
    if (settings.videoModel.apiKey.trim() && settings.videoModel.modelName.trim()) {
      try {
        const createdVideoTask = await deps.createVideoTaskFromLesson({
          lessonId: id,
          lesson,
          config: settings.videoModel,
          client: deps.client
        });
        await deps.historyStore.upsertVideo(createdVideoTask);
        videoTask = createdVideoTask;
      } catch (error) {
        videoError = getErrorMessage(error);
      }
    }

    return { id, lesson, videoTask, videoError };
  });

  ipcMainLike.handle("lesson:exportDocx", async (_event, input) => {
    const parsed = exportLessonInputSchema.parse(input);
    const filePath = join(deps.dataDir, "exports", `${safeFileName(parsed.title)}-${safeFileName(parsed.id)}.docx`);

    await deps.exportLessonDocx({ filePath, lesson: parsed.lesson });
    await updateLessonWordPath(deps.historyStore, parsed.id, filePath);

    return filePath;
  });

  ipcMainLike.handle("demo:generate", async (_event, problemInput) => {
    const queuedDemo = demoQueue.then(
      () => generateDemo(problemInput, deps, activeDemoServer),
      () => generateDemo(problemInput, deps, activeDemoServer)
    );

    demoQueue = queuedDemo
      .then((result) => {
        activeDemoServer = result.activeDemoServer;
      })
      .catch(() => undefined);

    const result = await queuedDemo;
    activeDemoServer = result.activeDemoServer;

    return result.response;
  });

  ipcMainLike.handle("video:generate", async (_event, input) => {
    if (!deps.createStandaloneVideoTask) {
      throw new Error("视频生成服务未初始化。");
    }

    const parsed = generateVideoInputSchema.parse(input);
    const settings = await deps.configStore.load();
    const videoTask = await deps.createStandaloneVideoTask({
      config: settings.videoModel,
      client: deps.client,
      prompt: parsed.prompt,
      script: parsed.script,
      image: parsed.imageDataUrl,
      imageSize: parsed.imageSize,
      negativePrompt: parsed.negativePrompt
    });
    await deps.historyStore.upsertVideo(videoTask);

    return videoTask;
  });

  ipcMainLike.handle("video:refresh", async (_event, videoIdInput) => {
    const videoId = nonEmptyStringSchema.parse(videoIdInput);
    const settings = await deps.configStore.load();
    const videos = await deps.historyStore.listVideos();
    const video = videos.find((item) => item.id === videoId);
    if (!video) {
      throw new Error("未找到视频任务。");
    }

    const updatedVideo = await deps.refreshVideoTaskStatus({
      task: video,
      config: settings.videoModel,
      client: deps.client,
      now: deps.now
    });
    await deps.historyStore.upsertVideo(updatedVideo);

    return updatedVideo;
  });

  ipcMainLike.handle("knowledge:testConnections", async () => {
    if (!deps.testKnowledgeConnections || !deps.qdrantClient) {
      throw new Error("知识库连接测试服务未初始化。");
    }

    const settings = await deps.configStore.load();
    if (settings.qdrant.mode === "local") {
      await deps.localQdrantManager?.ensureRunning(settings);
    }

    return deps.testKnowledgeConnections({
      settings,
      embeddingClient: deps.client as EmbeddingClientLike,
      qdrantClient: deps.qdrantClient
    });
  });

  ipcMainLike.handle("knowledge:qdrantStatus", async () => {
    if (!deps.localQdrantManager) {
      throw new Error("本地向量库服务未初始化。");
    }

    return deps.localQdrantManager.getStatus();
  });

  ipcMainLike.handle("textbook:index", async (_event, input) => {
    if (!deps.indexTextbook || !deps.textbookStore || !deps.qdrantClient) {
      throw new Error("教材索引服务未初始化。");
    }

    const parsed = textbookIndexInputSchema.parse(input);
    const settings = await deps.configStore.load();
    if (settings.qdrant.mode === "local") {
      await deps.localQdrantManager?.ensureRunning(settings);
    }

    return deps.indexTextbook({
      id: deps.createId(),
      title: parsed.title,
      ...(parsed.sourceName ? { sourceName: parsed.sourceName } : {}),
      ...(parsed.sourceNames ? { sourceNames: parsed.sourceNames } : {}),
      items: parsed.items,
      settings,
      embeddingClient: deps.client as EmbeddingClientLike,
      qdrantClient: deps.qdrantClient,
      textbookStore: deps.textbookStore,
      dataDir: deps.dataDir,
      now: deps.now,
      createPointId: deps.createId
    });
  });

  ipcMainLike.handle("textbook:list", async () => {
    if (!deps.textbookStore) {
      throw new Error("教材索引服务未初始化。");
    }

    return deps.textbookStore.list();
  });

  ipcMainLike.handle("textbook:search", async (_event, input) => {
    if (!deps.searchTextbookIndex || !deps.qdrantClient) {
      throw new Error("教材检索服务未初始化。");
    }

    const parsed = textbookSearchInputSchema.parse(input);
    const settings = await deps.configStore.load();

    return deps.searchTextbookIndex({
      query: parsed.query,
      settings,
      embeddingClient: deps.client as EmbeddingClientLike,
      qdrantClient: deps.qdrantClient,
      limit: parsed.limit
    });
  });

  ipcMainLike.handle("history:list", async () => ({
    lessons: await deps.historyStore.listLessons(),
    demos: await deps.historyStore.listDemos(),
    videos: await deps.historyStore.listVideos()
  }));
}

async function generateDemo(
  problemInput: unknown,
  deps: WorkflowDeps,
  activeDemoServer: DemoServer | undefined
): Promise<{ response: { id: string; plan: ProblemDemoPlan; url: string }; activeDemoServer: DemoServer }> {
  const problem = nonEmptyStringSchema.parse(problemInput);
  const settings = await deps.configStore.load();
  const plan = await deps.analyzeProblemForDemo({ problem, config: settings.textModel, client: deps.client });
  const renderer = deps.chooseDemoRenderer(plan);
  const html = renderDemoHtml(renderer, plan, deps);
  const id = deps.createId();
  const createdAt = deps.now();
  const demoDir = join(deps.dataDir, "demos", id);

  await mkdir(demoDir, { recursive: true });
  await writeFile(join(demoDir, "index.html"), html, "utf8");

  let newDemoServer: DemoServer | undefined;
  try {
    newDemoServer = await deps.startDemoServer(demoDir);
    const url = newDemoServer.url;
    await deps.openExternal(url);

    await deps.historyStore.addDemo({
      id,
      title: plan.title,
      problem,
      kind: plan.kind,
      demoPath: demoDir,
      createdAt
    });

    const promotedDemoServer = newDemoServer;
    newDemoServer = undefined;
    if (activeDemoServer) {
      await closeDemoServerQuietly(activeDemoServer);
    }

    return { response: { id, plan, url }, activeDemoServer: promotedDemoServer };
  } catch (error) {
    if (newDemoServer) {
      await newDemoServer.close();
    }

    throw error;
  }
}

function renderDemoHtml(renderer: "motion" | "equation" | "simple", plan: ProblemDemoPlan, deps: WorkflowDeps): string {
  if (renderer === "motion") return deps.renderMotionDemoHtml(plan);
  if (renderer === "equation") return deps.renderEquationDemoHtml(plan);

  return deps.renderSimpleDemoHtml(plan);
}

async function updateLessonWordPath(historyStore: HistoryStoreLike, id: string, filePath: string): Promise<void> {
  const lessons = await historyStore.listLessons();
  const existingLesson = lessons.find((item) => item.id === id);
  if (!existingLesson) {
    return;
  }

  await historyStore.addLesson({ ...existingLesson, wordPath: filePath });
}

function safeFileName(value: string): string {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  return safe || "lesson";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "视频任务提交失败。";
}

async function closeDemoServerQuietly(server: DemoServer): Promise<void> {
  try {
    await server.close();
  } catch {
    // A stale demo server failing to close must not break the newly opened demo.
  }
}
