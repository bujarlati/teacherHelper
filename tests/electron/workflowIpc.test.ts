import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWorkflowIpcHandlers } from "../../electron/workflowIpc";
import type { AppSettings, LessonPlan, LocalQdrantStatus, ProblemDemoPlan } from "../../src/shared/types";
import type { TextbookIndexItem, TextbookRecord, TextbookSearchResult } from "../../src/shared/types";
import type { DemoRecord, LessonRecord, VideoRecord } from "../../src/main/historyStore";

type Handler = (_event: unknown, ...args: unknown[]) => unknown;

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function createFakeIpcMain() {
  const handlers = new Map<string, Handler>();

  return {
    handlers,
    handle(channel: string, handler: Handler) {
      handlers.set(channel, handler);
    }
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 1000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError;
}

function createBaseDeps(overrides: Record<string, unknown> = {}) {
  return {
    configStore: { load: vi.fn().mockResolvedValue(completeSettings) },
    historyStore: {
      addLesson: vi.fn(),
      addDemo: vi.fn(),
      upsertVideo: vi.fn(),
      listLessons: vi.fn(),
      listDemos: vi.fn(),
      listVideos: vi.fn()
    },
    textbookStore: {
      upsert: vi.fn(),
      list: vi.fn()
    },
    dataDir: tmpDir,
    client: {},
    qdrantClient: {
      testConnection: vi.fn(),
      ensureCollection: vi.fn(),
      upsertPoints: vi.fn(),
      searchPoints: vi.fn()
    },
    createId: vi.fn()
      .mockReturnValueOnce("generated-1")
      .mockReturnValueOnce("generated-2")
      .mockReturnValue("generated-next"),
    now: () => "2026-06-15T03:04:05.000Z",
    generateLessonPlan: vi.fn(),
    createVideoTaskFromLesson: vi.fn(),
    createStandaloneVideoTask: vi.fn(),
    refreshVideoTaskStatus: vi.fn(),
    analyzeProblemForDemo: vi.fn().mockResolvedValue(demoPlan),
    chooseDemoRenderer: vi.fn().mockReturnValue("equation"),
    renderMotionDemoHtml: vi.fn(),
    renderEquationDemoHtml: vi.fn().mockReturnValue("<!doctype html><title>demo</title>"),
    renderSimpleDemoHtml: vi.fn(),
    renderTeachingDemoHtml: vi.fn().mockReturnValue("<!doctype html><title>local demo</title>"),
    startDemoServer: vi.fn(),
    openExternal: vi.fn().mockResolvedValue(undefined),
    exportLessonDocx: vi.fn(),
    indexTextbook: vi.fn(),
    searchTextbookIndex: vi.fn(),
    ...overrides
  };
}

const completeSettings: AppSettings = {
  textModel: { apiKey: "text-key", modelName: "text-model" },
  videoModel: { apiKey: "video-key", modelName: "video-model" },
  imageModel: { apiKey: "image-key", modelName: "Tongyi-MAI/Z-Image" },
  embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
  rerankerModel: { apiKey: "rerank-key", modelName: "Qwen/Qwen3-VL-Reranker-8B" },
  qdrant: { mode: "local", url: "http://127.0.0.1:6333", apiKey: "", collectionPrefix: "teacherhelper" }
};

const lesson: LessonPlan = {
  title: "一次函数复习",
  grade_suggestion: "八年级",
  teaching_goals: ["理解一次函数图像"],
  key_points: ["斜率与截距"],
  difficult_points: ["图像与表达式互化"],
  common_confusions: ["把截距当斜率"],
  lesson_flow: [{ title: "导入", minutes: 5, activities: ["回顾旧知"] }],
  board_design: ["y=kx+b"],
  example_questions: [{ question: "画出 y=2x+1", answer: "过 (0,1) 和 (1,3)" }],
  worked_solutions: [{ question: "求斜率", steps: ["比较表达式"], answer: "2" }],
  classroom_questions: ["k 的意义是什么？"],
  homework_suggestions: ["完成 3 道图像题"],
  video_script: "讲解一次函数图像。",
  video_prompt: "课堂黑板，一次函数图像。",
  markdown: "# 一次函数复习"
};

const demoPlan: ProblemDemoPlan = {
  kind: "equation",
  title: "方程演示",
  originalProblem: "小明买笔。",
  knownValues: [{ label: "单价", value: 3, unit: "元" }],
  target: "求数量",
  steps: ["设 x", "列方程"],
  equation: {
    variable: "x",
    relationship: "总价=单价x数量",
    expression: "3x=12",
    solution: "x=4",
    verification: "3*4=12"
  }
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = join(tmpdir(), `teacherhelper-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("registerWorkflowIpcHandlers", () => {
  it("generates a lesson, saves it, and opens a local teaching demo", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const addedLessons: LessonRecord[] = [];
    const addedDemos: DemoRecord[] = [];
    const upsertedVideos: VideoRecord[] = [];
    const createdAt = "2026-06-15T01:02:03.000Z";
    const createVideoTaskFromLesson = vi.fn();
    const renderTeachingDemoHtml = vi.fn().mockReturnValue("<!doctype html><title>lesson demo</title>");
    const openExternal = vi.fn().mockResolvedValue(undefined);

    registerWorkflowIpcHandlers(fakeIpcMain, {
      configStore: { load: vi.fn().mockResolvedValue(completeSettings) },
      historyStore: {
        addLesson: async (record) => { addedLessons.push(record); },
        addDemo: async (record) => { addedDemos.push(record); },
        upsertVideo: async (record) => { upsertedVideos.push(record); },
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      dataDir: tmpDir,
      client: {},
      createId: () => "lesson-1",
      now: () => createdAt,
      generateLessonPlan: vi.fn().mockResolvedValue(lesson),
      createVideoTaskFromLesson,
      refreshVideoTaskStatus: vi.fn(),
      analyzeProblemForDemo: vi.fn(),
      chooseDemoRenderer: vi.fn(),
      renderMotionDemoHtml: vi.fn(),
      renderEquationDemoHtml: vi.fn(),
      renderSimpleDemoHtml: vi.fn(),
      renderTeachingDemoHtml,
      startDemoServer: vi.fn().mockResolvedValue({ url: "http://127.0.0.1:8123/", close: vi.fn() }),
      openExternal,
      exportLessonDocx: vi.fn()
    });

    const result = await fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ");

    expect(result).toEqual({
      id: "lesson-1",
      lesson,
      localDemo: {
        id: "lesson-1",
        title: lesson.title,
        url: "http://127.0.0.1:8123/"
      }
    });
    expect(addedLessons).toEqual([{
      id: "lesson-1",
      title: lesson.title,
      topic: "一次函数",
      markdown: lesson.markdown,
      createdAt
    }]);
    expect(addedDemos).toEqual([{
      id: "lesson-1",
      title: lesson.title,
      problem: lesson.video_prompt,
      kind: "simple",
      demoPath: join(tmpDir, "local-demos", "lesson-1"),
      createdAt
    }]);
    expect(renderTeachingDemoHtml).toHaveBeenCalledWith({
      title: lesson.title,
      prompt: lesson.video_prompt,
      script: lesson.video_script,
      exampleQuestions: lesson.example_questions,
      workedSolutions: lesson.worked_solutions
    });
    await expect(readFile(join(tmpDir, "local-demos", "lesson-1", "index.html"), "utf8")).resolves.toContain("lesson demo");
    expect(openExternal).toHaveBeenCalledWith("http://127.0.0.1:8123/");
    expect(createVideoTaskFromLesson).not.toHaveBeenCalled();
    expect(upsertedVideos).toEqual([]);
  });

  it("returns a lesson with a local demo error when local demo generation fails", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const addedLessons: LessonRecord[] = [];
    const upsertVideo = vi.fn();

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      historyStore: {
        addLesson: async (record: LessonRecord) => { addedLessons.push(record); },
        addDemo: vi.fn(),
        upsertVideo,
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      createId: () => "lesson-1",
      now: () => "2026-06-15T01:02:03.000Z",
      generateLessonPlan: vi.fn().mockResolvedValue(lesson),
      startDemoServer: vi.fn().mockRejectedValue(new Error("local preview failed"))
    }));

    await expect(fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ")).resolves.toEqual({
      id: "lesson-1",
      lesson,
      demoError: "local preview failed"
    });
    expect(addedLessons).toEqual([{
      id: "lesson-1",
      title: lesson.title,
      topic: "一次函数",
      markdown: lesson.markdown,
      createdAt: "2026-06-15T01:02:03.000Z"
    }]);
    expect(upsertVideo).not.toHaveBeenCalled();
  });

  it("generates lesson image assets and injects them into the local teaching demo", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const imageAssets = [{
      title: "故事导入图",
      prompt: "数轴小路",
      src: "data:image/png;base64,AQID"
    }];
    const generateLessonImages = vi.fn().mockResolvedValue(imageAssets);
    const renderTeachingDemoHtml = vi.fn().mockReturnValue("<!doctype html><title>lesson images</title>");
    const deps = createBaseDeps({
      createId: () => "lesson-1",
      generateLessonPlan: vi.fn().mockResolvedValue(lesson),
      generateLessonImages,
      renderTeachingDemoHtml,
      startDemoServer: vi.fn().mockResolvedValue({ url: "http://127.0.0.1:8123/", close: vi.fn() })
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);

    await expect(fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ")).resolves.toMatchObject({
      id: "lesson-1",
      imageAssets,
      localDemo: {
        id: "lesson-1",
        title: lesson.title,
        url: "http://127.0.0.1:8123/"
      }
    });
    expect(generateLessonImages).toHaveBeenCalledWith({
      lesson,
      lessonId: "lesson-1",
      config: completeSettings.imageModel,
      client: deps.client,
      dataDir: tmpDir
    });
    expect(renderTeachingDemoHtml).toHaveBeenCalledWith(expect.objectContaining({
      imageAssets
    }));
  });

  it("keeps the lesson and local demo when lesson image generation fails", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const renderTeachingDemoHtml = vi.fn().mockReturnValue("<!doctype html><title>lesson without images</title>");
    const deps = createBaseDeps({
      createId: () => "lesson-1",
      generateLessonPlan: vi.fn().mockResolvedValue(lesson),
      generateLessonImages: vi.fn().mockRejectedValue(new Error("image generation failed")),
      renderTeachingDemoHtml,
      startDemoServer: vi.fn().mockResolvedValue({ url: "http://127.0.0.1:8123/", close: vi.fn() })
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);

    await expect(fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ")).resolves.toEqual({
      id: "lesson-1",
      lesson,
      localDemo: {
        id: "lesson-1",
        title: lesson.title,
        url: "http://127.0.0.1:8123/"
      },
      imageError: "image generation failed"
    });
    expect(renderTeachingDemoHtml).toHaveBeenCalledWith(expect.not.objectContaining({
      imageAssets: expect.anything()
    }));
  });

  it("generates a standalone video task and saves it to history", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const upsertVideo = vi.fn().mockResolvedValue(undefined);
    const videoTask: VideoRecord = {
      id: "video-standalone-1",
      requestId: "request-video-1",
      status: "InQueue",
      prompt: "A number line animation.\n镜头脚本：Show A then B.",
      script: "Show A then B.",
      imageSize: "960x960",
      negativePrompt: "blurry",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T03:04:05.000Z"
    };
    const createStandaloneVideoTask = vi.fn().mockResolvedValue(videoTask);
    const deps = createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo,
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      createStandaloneVideoTask
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);

    await expect(fakeIpcMain.handlers.get("video:generate")?.({}, {
      prompt: " A number line animation. ",
      script: " Show A then B. ",
      imageDataUrl: "data:image/png;base64,AAA",
      imageSize: "960x960",
      negativePrompt: " blurry "
    })).resolves.toEqual(videoTask);
    expect(createStandaloneVideoTask).toHaveBeenCalledWith({
      config: completeSettings.videoModel,
      client: deps.client,
      prompt: "A number line animation.",
      script: "Show A then B.",
      image: "data:image/png;base64,AAA",
      imageSize: "960x960",
      negativePrompt: "blurry"
    });
    expect(upsertVideo).toHaveBeenCalledWith(videoTask);
  });

  it("generates a local teaching demo without creating a provider video task", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const renderTeachingDemoHtml = vi.fn().mockReturnValue("<!doctype html><title>local demo</title>");
    const createStandaloneVideoTask = vi.fn();
    const addDemo = vi.fn().mockResolvedValue(undefined);
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const deps = createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo,
        upsertVideo: vi.fn(),
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      createId: () => "local-demo-1",
      renderTeachingDemoHtml,
      createStandaloneVideoTask,
      startDemoServer: vi.fn().mockResolvedValue({
        url: "http://127.0.0.1:8123/",
        close: vi.fn()
      }),
      openExternal
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);

    await expect(fakeIpcMain.handlers.get("video:generateLocalDemo")?.({}, {
      prompt: " Show A + B on a number line. ",
      script: " Draw A. Draw B. "
    })).resolves.toEqual({
      id: "local-demo-1",
      title: "Show A + B on a number line.",
      url: "http://127.0.0.1:8123/"
    });
    expect(renderTeachingDemoHtml).toHaveBeenCalledWith({
      title: "Show A + B on a number line.",
      prompt: "Show A + B on a number line.",
      script: "Draw A. Draw B."
    });
    await expect(readFile(join(tmpDir, "local-demos", "local-demo-1", "index.html"), "utf8")).resolves.toContain("local demo");
    expect(openExternal).toHaveBeenCalledWith("http://127.0.0.1:8123/");
    expect(addDemo).toHaveBeenCalledWith({
      id: "local-demo-1",
      title: "Show A + B on a number line.",
      problem: "Show A + B on a number line.\n\n脚本：Draw A. Draw B.",
      kind: "simple",
      demoPath: join(tmpDir, "local-demos", "local-demo-1"),
      createdAt: "2026-06-15T03:04:05.000Z"
    });
    expect(createStandaloneVideoTask).not.toHaveBeenCalled();
  });

  it("does not submit a provider video task while generating a lesson", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const createVideoTaskFromLesson = vi.fn();
    const upsertVideo = vi.fn();

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo,
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      createId: () => "lesson-1",
      generateLessonPlan: vi.fn().mockResolvedValue(lesson),
      createVideoTaskFromLesson,
      startDemoServer: vi.fn().mockResolvedValue({ url: "http://127.0.0.1:8123/", close: vi.fn() })
    }));

    await expect(fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ")).resolves.toEqual({
      id: "lesson-1",
      lesson,
      localDemo: {
        id: "lesson-1",
        title: lesson.title,
        url: "http://127.0.0.1:8123/"
      }
    });
    expect(createVideoTaskFromLesson).not.toHaveBeenCalled();
    expect(upsertVideo).not.toHaveBeenCalled();
  });

  it("generates a demo, writes index.html, starts the server, opens the URL, and saves demo history", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const addedDemos: DemoRecord[] = [];
    const closeActiveServer = vi.fn().mockResolvedValue(undefined);
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const createdAt = "2026-06-15T02:03:04.000Z";

    registerWorkflowIpcHandlers(fakeIpcMain, {
      configStore: { load: vi.fn().mockResolvedValue(completeSettings) },
      historyStore: {
        addLesson: vi.fn(),
        addDemo: async (record) => { addedDemos.push(record); },
        upsertVideo: vi.fn(),
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      dataDir: tmpDir,
      client: {},
      createId: () => "demo-1",
      now: () => createdAt,
      generateLessonPlan: vi.fn(),
      createVideoTaskFromLesson: vi.fn(),
      refreshVideoTaskStatus: vi.fn(),
      analyzeProblemForDemo: vi.fn().mockResolvedValue(demoPlan),
      chooseDemoRenderer: vi.fn().mockReturnValue("equation"),
      renderMotionDemoHtml: vi.fn(),
      renderEquationDemoHtml: vi.fn().mockReturnValue("<!doctype html><title>demo</title>"),
      renderSimpleDemoHtml: vi.fn(),
      renderTeachingDemoHtml: vi.fn(),
      startDemoServer: vi.fn().mockResolvedValue({ url: "http://127.0.0.1:4321/", close: closeActiveServer }),
      openExternal,
      exportLessonDocx: vi.fn()
    });

    const result = await fakeIpcMain.handlers.get("demo:generate")?.({}, " 小明买笔 ");

    expect(result).toEqual({ id: "demo-1", plan: demoPlan, url: "http://127.0.0.1:4321/" });
    await expect(readFile(join(tmpDir, "demos", "demo-1", "index.html"), "utf8")).resolves.toContain("demo");
    expect(openExternal).toHaveBeenCalledWith("http://127.0.0.1:4321/");
    expect(addedDemos).toEqual([{
      id: "demo-1",
      title: demoPlan.title,
      problem: "小明买笔",
      kind: "equation",
      demoPath: join(tmpDir, "demos", "demo-1"),
      createdAt
    }]);
  });

  it("closes a newly started demo server when opening it fails and does not make it active", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const failedServerClose = vi.fn().mockResolvedValue(undefined);
    const successfulServerClose = vi.fn().mockResolvedValue(undefined);
    const openExternal = vi.fn()
      .mockRejectedValueOnce(new Error("cannot open browser"))
      .mockResolvedValueOnce(undefined);

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      createId: vi.fn()
        .mockReturnValueOnce("failed-demo")
        .mockReturnValueOnce("successful-demo"),
      startDemoServer: vi.fn()
        .mockResolvedValueOnce({ url: "http://127.0.0.1:5001/", close: failedServerClose })
        .mockResolvedValueOnce({ url: "http://127.0.0.1:5002/", close: successfulServerClose }),
      openExternal
    }));

    await expect(fakeIpcMain.handlers.get("demo:generate")?.({}, " 第一次 ")).rejects.toThrow("cannot open browser");
    expect(failedServerClose).toHaveBeenCalledTimes(1);

    await expect(fakeIpcMain.handlers.get("demo:generate")?.({}, " 第二次 ")).resolves.toMatchObject({
      id: "successful-demo",
      url: "http://127.0.0.1:5002/"
    });
    expect(failedServerClose).toHaveBeenCalledTimes(1);
    expect(successfulServerClose).not.toHaveBeenCalled();
  });

  it("serializes concurrent demo generation and leaves only the latest server active", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const firstStart = createDeferred<{ url: string; close(): Promise<void> }>();
    const secondStart = createDeferred<{ url: string; close(): Promise<void> }>();
    const firstServerClose = vi.fn().mockResolvedValue(undefined);
    const secondServerClose = vi.fn().mockResolvedValue(undefined);
    const startDemoServer = vi.fn()
      .mockReturnValueOnce(firstStart.promise)
      .mockReturnValueOnce(secondStart.promise);
    const addDemo = vi.fn().mockResolvedValue(undefined);

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      createId: vi.fn()
        .mockReturnValueOnce("first-demo")
        .mockReturnValueOnce("second-demo"),
      historyStore: {
        addLesson: vi.fn(),
        addDemo,
        upsertVideo: vi.fn(),
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      startDemoServer
    }));

    const firstResult = fakeIpcMain.handlers.get("demo:generate")?.({}, " 第一道题 ") as Promise<unknown>;
    const secondResult = fakeIpcMain.handlers.get("demo:generate")?.({}, " 第二道题 ") as Promise<unknown>;

    await waitForAssertion(() => expect(startDemoServer).toHaveBeenCalled());
    expect(startDemoServer).toHaveBeenCalledTimes(1);

    firstStart.resolve({ url: "http://127.0.0.1:6001/", close: firstServerClose });
    await expect(firstResult).resolves.toMatchObject({ id: "first-demo", url: "http://127.0.0.1:6001/" });
    await waitForAssertion(() => expect(startDemoServer).toHaveBeenCalledTimes(2));

    secondStart.resolve({ url: "http://127.0.0.1:6002/", close: secondServerClose });
    await expect(secondResult).resolves.toMatchObject({ id: "second-demo", url: "http://127.0.0.1:6002/" });
    expect(firstServerClose).toHaveBeenCalledTimes(1);
    expect(secondServerClose).not.toHaveBeenCalled();
  });

  it("keeps a new successful demo active when closing the previous server fails", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const firstServerClose = vi.fn().mockRejectedValue(new Error("close failed"));
    const secondServerClose = vi.fn().mockResolvedValue(undefined);
    const startDemoServer = vi.fn()
      .mockResolvedValueOnce({ url: "http://127.0.0.1:7001/", close: firstServerClose })
      .mockResolvedValueOnce({ url: "http://127.0.0.1:7002/", close: secondServerClose });

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      createId: vi.fn()
        .mockReturnValueOnce("first-demo")
        .mockReturnValueOnce("second-demo"),
      startDemoServer
    }));

    await expect(fakeIpcMain.handlers.get("demo:generate")?.({}, " 第一道题 ")).resolves.toMatchObject({
      id: "first-demo",
      url: "http://127.0.0.1:7001/"
    });
    await expect(fakeIpcMain.handlers.get("demo:generate")?.({}, " 第二道题 ")).resolves.toMatchObject({
      id: "second-demo",
      url: "http://127.0.0.1:7002/"
    });
    expect(firstServerClose).toHaveBeenCalledTimes(1);
    expect(secondServerClose).not.toHaveBeenCalled();
  });

  it("rejects an invalid lesson export payload before exporting", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const exportLessonDocx = vi.fn();

    registerWorkflowIpcHandlers(fakeIpcMain, {
      configStore: { load: vi.fn().mockResolvedValue(completeSettings) },
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo: vi.fn(),
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      dataDir: tmpDir,
      client: {},
      createId: () => "export-1",
      now: () => "2026-06-15T03:04:05.000Z",
      generateLessonPlan: vi.fn(),
      createVideoTaskFromLesson: vi.fn(),
      refreshVideoTaskStatus: vi.fn(),
      analyzeProblemForDemo: vi.fn(),
      chooseDemoRenderer: vi.fn(),
      renderMotionDemoHtml: vi.fn(),
      renderEquationDemoHtml: vi.fn(),
      renderSimpleDemoHtml: vi.fn(),
      renderTeachingDemoHtml: vi.fn(),
      startDemoServer: vi.fn(),
      openExternal: vi.fn(),
      exportLessonDocx
    });

    await expect(
      fakeIpcMain.handlers.get("lesson:exportDocx")?.({}, { id: "lesson-1", title: "坏教案", lesson: { title: "" } })
    ).rejects.toThrow();
    expect(exportLessonDocx).not.toHaveBeenCalled();
  });

  it("exports lessons with the same title to distinct id-based file paths", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const exportLessonDocx = vi.fn().mockResolvedValue(undefined);
    const updatedLessons: LessonRecord[] = [];
    const lessons: LessonRecord[] = [
      { id: "lesson/one", title: lesson.title, topic: "一次函数", createdAt: "2026-06-15T01:02:03.000Z" },
      { id: "lesson:two", title: lesson.title, topic: "一次函数", createdAt: "2026-06-15T02:03:04.000Z" }
    ];

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      historyStore: {
        addLesson: async (record: LessonRecord) => { updatedLessons.push(record); },
        addDemo: vi.fn(),
        upsertVideo: vi.fn(),
        listLessons: vi.fn().mockResolvedValue(lessons),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      exportLessonDocx
    }));

    const firstPath = await fakeIpcMain.handlers.get("lesson:exportDocx")?.({}, {
      id: "lesson/one",
      title: lesson.title,
      lesson
    });
    const secondPath = await fakeIpcMain.handlers.get("lesson:exportDocx")?.({}, {
      id: "lesson:two",
      title: lesson.title,
      lesson
    });

    expect(firstPath).not.toBe(secondPath);
    expect(firstPath).toContain("一次函数复习-lesson_one.docx");
    expect(secondPath).toContain("一次函数复习-lesson_two.docx");
    expect(updatedLessons).toEqual([
      { ...lessons[0], wordPath: firstPath },
      { ...lessons[1], wordPath: secondPath }
    ]);
  });

  it("lists lesson, demo, and video history from the store", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const lessons: LessonRecord[] = [{ id: "lesson-1", title: "L", topic: "T", createdAt: "2026-06-15" }];
    const demos: DemoRecord[] = [{
      id: "demo-1",
      title: "D",
      problem: "P",
      kind: "simple",
      demoPath: "demo-path",
      createdAt: "2026-06-15"
    }];
    const videos: VideoRecord[] = [{
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "request-1",
      status: "InQueue",
      prompt: "prompt",
      script: "script",
      createdAt: "2026-06-15",
      updatedAt: "2026-06-15"
    }];

    registerWorkflowIpcHandlers(fakeIpcMain, {
      configStore: { load: vi.fn().mockResolvedValue(completeSettings) },
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo: vi.fn(),
        listLessons: vi.fn().mockResolvedValue(lessons),
        listDemos: vi.fn().mockResolvedValue(demos),
        listVideos: vi.fn().mockResolvedValue(videos)
      },
      dataDir: tmpDir,
      client: {},
      createId: () => "unused",
      now: () => "2026-06-15T03:04:05.000Z",
      generateLessonPlan: vi.fn(),
      createVideoTaskFromLesson: vi.fn(),
      refreshVideoTaskStatus: vi.fn(),
      analyzeProblemForDemo: vi.fn(),
      chooseDemoRenderer: vi.fn(),
      renderMotionDemoHtml: vi.fn(),
      renderEquationDemoHtml: vi.fn(),
      renderSimpleDemoHtml: vi.fn(),
      renderTeachingDemoHtml: vi.fn(),
      startDemoServer: vi.fn(),
      openExternal: vi.fn(),
      exportLessonDocx: vi.fn()
    });

    await expect(fakeIpcMain.handlers.get("history:list")?.({})).resolves.toEqual({ lessons, demos, videos });
  });

  it("opens a saved demo from history", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const demoPath = join(tmpDir, "demos", "demo-1");
    const demos: DemoRecord[] = [{
      id: "demo-1",
      title: "D",
      problem: "P",
      kind: "simple",
      demoPath,
      createdAt: "2026-06-15"
    }];
    const startDemoServer = vi.fn().mockResolvedValue({
      url: "http://127.0.0.1:4321/",
      close: vi.fn()
    });
    const openExternal = vi.fn().mockResolvedValue(undefined);

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo: vi.fn(),
        listLessons: vi.fn(),
        listDemos: vi.fn().mockResolvedValue(demos),
        listVideos: vi.fn()
      },
      startDemoServer,
      openExternal
    }));

    await expect(fakeIpcMain.handlers.get("demo:open")?.({}, " demo-1 ")).resolves.toBe("http://127.0.0.1:4321/");
    expect(startDemoServer).toHaveBeenCalledWith(demoPath);
    expect(openExternal).toHaveBeenCalledWith("http://127.0.0.1:4321/");
  });

  it("refreshes a video task status and saves the updated record", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const queuedVideo: VideoRecord = {
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "request-1",
      status: "InQueue",
      prompt: "prompt",
      script: "script",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T03:04:05.000Z"
    };
    const refreshedVideo: VideoRecord = {
      ...queuedVideo,
      status: "Succeed",
      videoUrl: "https://cdn.example.test/video.mp4",
      updatedAt: "2026-06-15T04:05:06.000Z"
    };
    const downloadedVideo: VideoRecord = {
      ...refreshedVideo,
      localVideoPath: join(tmpDir, "videos", "video-1.mp4")
    };
    const upsertVideo = vi.fn().mockResolvedValue(undefined);
    const refreshVideoTaskStatus = vi.fn().mockResolvedValue(refreshedVideo);
    const downloadVideoFile = vi.fn().mockResolvedValue(downloadedVideo.localVideoPath);
    const deps = createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo,
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn().mockResolvedValue([queuedVideo])
      },
      refreshVideoTaskStatus,
      downloadVideoFile
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);
    const handler = fakeIpcMain.handlers.get("video:refresh");

    expect(handler).toBeDefined();
    await expect(handler?.({}, " video-1 ")).resolves.toEqual(downloadedVideo);
    expect(refreshVideoTaskStatus).toHaveBeenCalledWith({
      task: queuedVideo,
      config: completeSettings.videoModel,
      client: deps.client,
      now: deps.now
    });
    expect(downloadVideoFile).toHaveBeenCalledWith({
      dataDir: tmpDir,
      videoId: "video-1",
      videoUrl: "https://cdn.example.test/video.mp4"
    });
    expect(upsertVideo).toHaveBeenCalledWith(downloadedVideo);
  });

  it("tests knowledge connections using current settings", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const qdrantClient = {};
    const localQdrantStatus: LocalQdrantStatus = {
      mode: "local",
      status: "running",
      url: "http://127.0.0.1:6333",
      managed: true
    };
    const localQdrantManager = {
      ensureRunning: vi.fn().mockResolvedValue(localQdrantStatus),
      getStatus: vi.fn().mockReturnValue(localQdrantStatus)
    };
    const testKnowledgeConnections = vi.fn().mockResolvedValue({ embedding: "ok", qdrant: "ok" });
    const deps = createBaseDeps({
      qdrantClient,
      localQdrantManager,
      testKnowledgeConnections
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);

    await expect(fakeIpcMain.handlers.get("knowledge:testConnections")?.({})).resolves.toEqual({
      embedding: "ok",
      qdrant: "ok"
    });
    expect(localQdrantManager.ensureRunning).toHaveBeenCalledWith(completeSettings);
    expect(testKnowledgeConnections).toHaveBeenCalledWith({
      settings: completeSettings,
      embeddingClient: deps.client,
      qdrantClient
    });
  });

  it("returns the current local qdrant status", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const localQdrantStatus: LocalQdrantStatus = {
      mode: "local",
      status: "missing",
      url: "http://127.0.0.1:6333",
      message: "未找到内置 Qdrant"
    };

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      localQdrantManager: {
        ensureRunning: vi.fn(),
        getStatus: vi.fn().mockReturnValue(localQdrantStatus)
      }
    }));

    await expect(fakeIpcMain.handlers.get("knowledge:qdrantStatus")?.({})).resolves.toEqual(localQdrantStatus);
  });

  it("indexes textbook pages through qdrant and saves the textbook record", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const items: TextbookIndexItem[] = [{
      kind: "page",
      pageNumber: 1,
      sourceName: "algebra.pdf",
      sourcePageNumber: 1,
      imageDataUrl: "data:image/png;base64,AAA"
    }];
    const record: TextbookRecord = {
      id: "book-1",
      title: "七年级数学",
      sourceName: "algebra.pdf, geometry.pdf",
      sourceNames: ["algebra.pdf", "geometry.pdf"],
      sources: [
        { name: "algebra.pdf", pageCount: 1, itemCount: 1 },
        { name: "geometry.pdf", pageCount: 0, itemCount: 0 }
      ],
      collectionName: "teacherhelper_textbook_visual",
      pageCount: 1,
      itemCount: 1,
      status: "indexed",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T03:04:05.000Z"
    };
    const localQdrantManager = {
      ensureRunning: vi.fn().mockResolvedValue({ mode: "local", status: "running", url: "http://127.0.0.1:6333" }),
      getStatus: vi.fn()
    };
    const deps = createBaseDeps({
      createId: () => "book-1",
      qdrantClient: {},
      localQdrantManager,
      indexTextbook: vi.fn().mockResolvedValue(record)
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);

    await expect(fakeIpcMain.handlers.get("textbook:index")?.({}, {
      title: " 七年级数学 ",
      sourceNames: ["algebra.pdf", "geometry.pdf"],
      items
    })).resolves.toEqual(record);
    expect(localQdrantManager.ensureRunning).toHaveBeenCalledWith(completeSettings);
    expect(deps.indexTextbook).toHaveBeenCalledWith({
      id: "book-1",
      title: "七年级数学",
      sourceNames: ["algebra.pdf", "geometry.pdf"],
      items,
      settings: completeSettings,
      embeddingClient: deps.client,
      qdrantClient: deps.qdrantClient,
      textbookStore: deps.textbookStore,
      dataDir: tmpDir,
      now: deps.now,
      createPointId: expect.any(Function)
    });
  });

  it("lists indexed textbooks and searches indexed textbook vectors", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const textbooks: TextbookRecord[] = [{
      id: "book-1",
      title: "七年级数学",
      sourceName: "local.pdf",
      collectionName: "teacherhelper_textbook_visual",
      pageCount: 1,
      itemCount: 1,
      status: "indexed",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T03:04:05.000Z"
    }];
    const searchResults: TextbookSearchResult[] = [{
      id: "point-1",
      score: 0.9,
      rankingSource: "qdrant",
      textbookId: "book-1",
      title: "七年级数学",
      sourceName: "local.pdf",
      pageNumber: 2,
      kind: "page",
      imagePath: "D:\\page-002.png"
    }];
    const deps = createBaseDeps({
      textbookStore: {
        upsert: vi.fn(),
        list: vi.fn().mockResolvedValue(textbooks)
      },
      qdrantClient: {},
      searchTextbookIndex: vi.fn().mockResolvedValue(searchResults)
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);

    await expect(fakeIpcMain.handlers.get("textbook:list")?.({})).resolves.toEqual(textbooks);
    await expect(fakeIpcMain.handlers.get("textbook:search")?.({}, {
      query: "一次函数",
      limit: 4
    })).resolves.toEqual(searchResults);
    expect(deps.searchTextbookIndex).toHaveBeenCalledWith({
      query: "一次函数",
      settings: completeSettings,
      embeddingClient: deps.client,
      qdrantClient: deps.qdrantClient,
      limit: 4
    });
  });

  it("rejects refresh for an unknown video task without calling the provider", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const refreshVideoTaskStatus = vi.fn();
    const upsertVideo = vi.fn();

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo,
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn().mockResolvedValue([])
      },
      refreshVideoTaskStatus
    }));

    const handler = fakeIpcMain.handlers.get("video:refresh");

    expect(handler).toBeDefined();
    await expect(handler?.({}, "missing-video")).rejects.toThrow("未找到视频任务。");
    expect(refreshVideoTaskStatus).not.toHaveBeenCalled();
    expect(upsertVideo).not.toHaveBeenCalled();
  });
});
