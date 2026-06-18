import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { lessonPlanSchema } from "../src/shared/schemas.js";
import type {
  AppSettings,
  KnowledgeConnectionTestResult,
  LessonImageAsset,
  LessonPlan,
  LocalTeachingDemoInput,
  LocalTeachingDemoResult,
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
  deleteLesson?(id: string): Promise<LessonRecord | undefined>;
  deleteDemo?(id: string): Promise<DemoRecord | undefined>;
  deleteVideo?(id: string): Promise<VideoRecord | undefined>;
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
  generateLessonImages?(input: {
    lesson: LessonPlan;
    lessonId: string;
    config: AppSettings["imageModel"];
    client: unknown;
    dataDir: string;
  }): Promise<LessonImageAsset[]>;
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
  downloadVideoFile?(input: {
    dataDir: string;
    videoId: string;
    videoUrl: string;
  }): Promise<string>;
  analyzeProblemForDemo(input: {
    problem: string;
    config: AppSettings["textModel"];
    client: unknown;
  }): Promise<ProblemDemoPlan>;
  chooseDemoRenderer(plan: ProblemDemoPlan): "motion" | "equation" | "simple";
  renderMotionDemoHtml(plan: ProblemDemoPlan): string;
  renderEquationDemoHtml(plan: ProblemDemoPlan): string;
  renderSimpleDemoHtml(plan: ProblemDemoPlan): string;
  renderTeachingDemoHtml(input: LocalTeachingDemoInput & { title: string }): string;
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
const localTeachingDemoInputSchema = z.object({
  prompt: nonEmptyStringSchema,
  script: optionalTrimmedStringSchema,
  exampleQuestions: z.array(z.object({
    question: nonEmptyStringSchema,
    answer: nonEmptyStringSchema
  })).optional(),
  workedSolutions: z.array(z.object({
    question: nonEmptyStringSchema,
    steps: z.array(nonEmptyStringSchema),
    answer: nonEmptyStringSchema
  })).optional(),
  imageAssets: z.array(z.object({
    title: nonEmptyStringSchema,
    prompt: nonEmptyStringSchema,
    src: nonEmptyStringSchema,
    localPath: nonEmptyStringSchema.optional()
  })).optional()
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
const historyDeleteInputSchema = z.object({
  kind: z.enum(["lesson", "demo", "video"]),
  id: nonEmptyStringSchema
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
    const lessonRecord: LessonRecord = {
      id,
      title: lesson.title,
      topic,
      markdown: lesson.markdown,
      createdAt
    };

    await deps.historyStore.addLesson(lessonRecord);

    let imageAssets: LessonImageAsset[] = [];
    let imageError: string | undefined;
    if (deps.generateLessonImages) {
      try {
        imageAssets = await deps.generateLessonImages({
          lesson,
          lessonId: id,
          config: settings.imageModel,
          client: deps.client,
          dataDir: deps.dataDir
        });
      } catch (error) {
        imageError = getErrorMessage(error);
      }
    }

    let localDemo: LocalTeachingDemoResult | undefined;
    let demoError: string | undefined;
    try {
      const demoResult = await generateLocalTeachingDemo({
        prompt: lesson.video_prompt,
        script: lesson.video_script,
        exampleQuestions: lesson.example_questions,
        workedSolutions: lesson.worked_solutions,
        ...(imageAssets.length > 0 ? { imageAssets } : {})
      }, deps, activeDemoServer, {
        id,
        title: lesson.title,
        historyProblem: lesson.video_prompt
      });
      activeDemoServer = demoResult.activeDemoServer;
      const linkedLocalDemo = demoResult.response;
      await deps.historyStore.addLesson({
        ...lessonRecord,
        demoId: linkedLocalDemo.id,
        demoPath: join(deps.dataDir, "local-demos", id)
      });
      localDemo = linkedLocalDemo;
    } catch (error) {
      demoError = getErrorMessage(error);
    }

    return {
      id,
      lesson,
      ...(imageAssets.length > 0 ? { imageAssets } : {}),
      ...(imageError ? { imageError } : {}),
      ...(localDemo ? { localDemo } : {}),
      ...(demoError ? { demoError } : {})
    };
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

  ipcMainLike.handle("demo:open", async (_event, demoIdInput) => {
    const queuedDemo = demoQueue.then(
      () => openSavedDemo(demoIdInput, deps, activeDemoServer),
      () => openSavedDemo(demoIdInput, deps, activeDemoServer)
    );

    demoQueue = queuedDemo
      .then((result) => {
        activeDemoServer = result.activeDemoServer;
      })
      .catch(() => undefined);

    const result = await queuedDemo;
    activeDemoServer = result.activeDemoServer;

    return result.url;
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

  ipcMainLike.handle("video:generateLocalDemo", async (_event, input) => {
    const queuedDemo = demoQueue.then(
      () => generateLocalTeachingDemo(input, deps, activeDemoServer),
      () => generateLocalTeachingDemo(input, deps, activeDemoServer)
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
    const savedVideo = await saveCompletedVideoLocally(updatedVideo, deps);
    await deps.historyStore.upsertVideo(savedVideo);

    return savedVideo;
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

  ipcMainLike.handle("history:list", async () => listHistory(deps.historyStore));

  ipcMainLike.handle("history:delete", async (_event, input) => {
    const parsed = historyDeleteInputSchema.parse(input);
    await deleteHistoryRecord(parsed, deps);

    return listHistory(deps.historyStore);
  });
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

async function openSavedDemo(
  demoIdInput: unknown,
  deps: WorkflowDeps,
  activeDemoServer: DemoServer | undefined
): Promise<{ url: string; activeDemoServer: DemoServer }> {
  const demoId = nonEmptyStringSchema.parse(demoIdInput);
  const demos = await deps.historyStore.listDemos();
  const demo = demos.find((item) => item.id === demoId);
  if (!demo) {
    throw new Error("未找到演示记录。");
  }

  let newDemoServer: DemoServer | undefined;
  try {
    newDemoServer = await deps.startDemoServer(demo.demoPath);
    const url = newDemoServer.url;
    await deps.openExternal(url);

    const promotedDemoServer = newDemoServer;
    newDemoServer = undefined;
    if (activeDemoServer) {
      await closeDemoServerQuietly(activeDemoServer);
    }

    return { url, activeDemoServer: promotedDemoServer };
  } catch (error) {
    if (newDemoServer) {
      await newDemoServer.close();
    }

    throw error;
  }
}

async function generateLocalTeachingDemo(
  input: unknown,
  deps: WorkflowDeps,
  activeDemoServer: DemoServer | undefined,
  options: { id?: string; title?: string; historyProblem?: string } = {}
): Promise<{ response: LocalTeachingDemoResult; activeDemoServer: DemoServer }> {
  const parsed = localTeachingDemoInputSchema.parse(input);
  const id = options.id ?? deps.createId();
  const title = options.title ?? createLocalDemoTitle(parsed.prompt);
  const html = deps.renderTeachingDemoHtml({
    title,
    prompt: parsed.prompt,
    script: parsed.script,
    ...(parsed.exampleQuestions ? { exampleQuestions: parsed.exampleQuestions } : {}),
    ...(parsed.workedSolutions ? { workedSolutions: parsed.workedSolutions } : {}),
    ...(parsed.imageAssets ? { imageAssets: parsed.imageAssets } : {})
  });
  const demoDir = join(deps.dataDir, "local-demos", id);

  await mkdir(demoDir, { recursive: true });
  await writeFile(join(demoDir, "index.html"), html, "utf8");

  let newDemoServer: DemoServer | undefined;
  try {
    newDemoServer = await deps.startDemoServer(demoDir);
    const url = newDemoServer.url;
    await deps.openExternal(url);
    await deps.historyStore.addDemo({
      id,
      title,
      problem: options.historyProblem ?? createLocalDemoHistoryProblem(parsed.prompt, parsed.script),
      kind: "simple",
      demoPath: demoDir,
      createdAt: deps.now()
    });

    const promotedDemoServer = newDemoServer;
    newDemoServer = undefined;
    if (activeDemoServer) {
      await closeDemoServerQuietly(activeDemoServer);
    }

    return { response: { id, title, url }, activeDemoServer: promotedDemoServer };
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

async function listHistory(historyStore: HistoryStoreLike): Promise<{
  lessons: LessonRecord[];
  demos: DemoRecord[];
  videos: VideoRecord[];
}> {
  return {
    lessons: await historyStore.listLessons(),
    demos: await historyStore.listDemos(),
    videos: await historyStore.listVideos()
  };
}

async function deleteHistoryRecord(
  input: z.infer<typeof historyDeleteInputSchema>,
  deps: WorkflowDeps
): Promise<void> {
  requireDeleteHistoryStore(deps.historyStore);

  if (input.kind === "lesson") {
    const lessons = await deps.historyStore.listLessons();
    const demos = await deps.historyStore.listDemos();
    const lesson = lessons.find((item) => item.id === input.id);
    if (!lesson) {
      throw new Error("未找到历史教案。");
    }

    const linkedDemoIds = new Set([lesson.demoId, lesson.id].filter(Boolean));
    const linkedDemos = demos.filter((demo) => linkedDemoIds.has(demo.id));
    const pathsToRemove = new Set<string>();
    addPath(pathsToRemove, lesson.demoPath);
    addPath(pathsToRemove, lesson.wordPath);
    for (const demo of linkedDemos) {
      addPath(pathsToRemove, demo.demoPath);
    }

    await deps.historyStore.deleteLesson(input.id);
    for (const demo of linkedDemos) {
      await deps.historyStore.deleteDemo(demo.id);
    }
    await removeGeneratedPaths(pathsToRemove, deps.dataDir);
    return;
  }

  if (input.kind === "demo") {
    const demos = await deps.historyStore.listDemos();
    const demo = demos.find((item) => item.id === input.id);
    if (!demo) {
      throw new Error("未找到演示记录。");
    }

    await deps.historyStore.deleteDemo(input.id);
    await removeGeneratedPaths(new Set([demo.demoPath]), deps.dataDir);
    return;
  }

  const videos = await deps.historyStore.listVideos();
  const video = videos.find((item) => item.id === input.id);
  if (!video) {
    throw new Error("未找到视频任务。");
  }

  await deps.historyStore.deleteVideo(input.id);
  await removeGeneratedPaths(new Set(video.localVideoPath ? [video.localVideoPath] : []), deps.dataDir);
}

function requireDeleteHistoryStore(historyStore: HistoryStoreLike): asserts historyStore is HistoryStoreLike & {
  deleteLesson(id: string): Promise<LessonRecord | undefined>;
  deleteDemo(id: string): Promise<DemoRecord | undefined>;
  deleteVideo(id: string): Promise<VideoRecord | undefined>;
} {
  if (!historyStore.deleteLesson || !historyStore.deleteDemo || !historyStore.deleteVideo) {
    throw new Error("历史删除服务未初始化。");
  }
}

function addPath(paths: Set<string>, value: string | undefined): void {
  if (value) {
    paths.add(value);
  }
}

async function removeGeneratedPaths(paths: Set<string>, dataDir: string): Promise<void> {
  for (const path of paths) {
    if (isInsideDirectory(dataDir, path)) {
      await rm(path, { recursive: true, force: true });
    }
  }
}

function isInsideDirectory(baseDir: string, targetPath: string): boolean {
  const relativePath = relative(resolve(baseDir), resolve(targetPath));
  return relativePath !== "" && !relativePath.startsWith("..") && !relativePath.includes(":");
}

function safeFileName(value: string): string {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  return safe || "lesson";
}

function createLocalDemoTitle(prompt: string): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  return compact.slice(0, 80) || "本地教学演示";
}

function createLocalDemoHistoryProblem(prompt: string, script?: string): string {
  if (!script) {
    return prompt;
  }

  return `${prompt}\n\n脚本：${script}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "视频任务提交失败。";
}

async function saveCompletedVideoLocally(video: VideoRecord, deps: WorkflowDeps): Promise<VideoRecord> {
  if (video.status !== "Succeed" || !video.videoUrl || video.localVideoPath || !deps.downloadVideoFile) {
    return video;
  }

  try {
    const localVideoPath = await deps.downloadVideoFile({
      dataDir: deps.dataDir,
      videoId: video.id,
      videoUrl: video.videoUrl
    });

    return {
      ...video,
      localVideoPath,
      reason: undefined
    };
  } catch (error) {
    return {
      ...video,
      reason: `视频已生成，但下载到本地失败：${getErrorMessage(error)}。请尽快打开视频链接保存。`
    };
  }
}

async function closeDemoServerQuietly(server: DemoServer): Promise<void> {
  try {
    await server.close();
  } catch {
    // A stale demo server failing to close must not break the newly opened demo.
  }
}
