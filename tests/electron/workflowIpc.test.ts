import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWorkflowIpcHandlers } from "../../electron/workflowIpc";
import type { AppSettings, LessonPlan, ProblemDemoPlan } from "../../src/shared/types";
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
    dataDir: tmpDir,
    client: {},
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
    startDemoServer: vi.fn(),
    openExternal: vi.fn().mockResolvedValue(undefined),
    exportLessonDocx: vi.fn(),
    ...overrides
  };
}

const completeSettings: AppSettings = {
  textModel: { apiKey: "text-key", modelName: "text-model" },
  videoModel: { apiKey: "video-key", modelName: "video-model" }
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
  it("generates a lesson, saves it, and submits a video task when video config is present", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const addedLessons: LessonRecord[] = [];
    const upsertedVideos: VideoRecord[] = [];
    const createdAt = "2026-06-15T01:02:03.000Z";
    const videoTask: VideoRecord = {
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "request-1",
      status: "InQueue",
      prompt: lesson.video_prompt,
      script: lesson.video_script,
      createdAt,
      updatedAt: createdAt
    };

    registerWorkflowIpcHandlers(fakeIpcMain, {
      configStore: { load: vi.fn().mockResolvedValue(completeSettings) },
      historyStore: {
        addLesson: async (record) => { addedLessons.push(record); },
        addDemo: vi.fn(),
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
      createVideoTaskFromLesson: vi.fn().mockResolvedValue(videoTask),
      refreshVideoTaskStatus: vi.fn(),
      analyzeProblemForDemo: vi.fn(),
      chooseDemoRenderer: vi.fn(),
      renderMotionDemoHtml: vi.fn(),
      renderEquationDemoHtml: vi.fn(),
      renderSimpleDemoHtml: vi.fn(),
      startDemoServer: vi.fn(),
      openExternal: vi.fn(),
      exportLessonDocx: vi.fn()
    });

    const result = await fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ");

    expect(result).toEqual({ id: "lesson-1", lesson, videoTask });
    expect(addedLessons).toEqual([{
      id: "lesson-1",
      title: lesson.title,
      topic: "一次函数",
      markdown: lesson.markdown,
      createdAt
    }]);
    expect(upsertedVideos).toEqual([videoTask]);
  });

  it("returns a lesson with a video error when video submission fails", async () => {
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
      createVideoTaskFromLesson: vi.fn().mockRejectedValue(new Error("video quota exceeded"))
    }));

    await expect(fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ")).resolves.toEqual({
      id: "lesson-1",
      lesson,
      videoError: "video quota exceeded"
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

  it("returns only a video error when saving a created video task fails", async () => {
    const fakeIpcMain = createFakeIpcMain();
    const createdAt = "2026-06-15T01:02:03.000Z";
    const videoTask: VideoRecord = {
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "request-1",
      status: "InQueue",
      prompt: lesson.video_prompt,
      script: lesson.video_script,
      createdAt,
      updatedAt: createdAt
    };

    registerWorkflowIpcHandlers(fakeIpcMain, createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo: vi.fn().mockRejectedValue(new Error("history write failed")),
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn()
      },
      createId: () => "lesson-1",
      now: () => createdAt,
      generateLessonPlan: vi.fn().mockResolvedValue(lesson),
      createVideoTaskFromLesson: vi.fn().mockResolvedValue(videoTask)
    }));

    await expect(fakeIpcMain.handlers.get("lesson:generate")?.({}, " 一次函数 ")).resolves.toEqual({
      id: "lesson-1",
      lesson,
      videoError: "history write failed"
    });
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
      startDemoServer: vi.fn(),
      openExternal: vi.fn(),
      exportLessonDocx: vi.fn()
    });

    await expect(fakeIpcMain.handlers.get("history:list")?.({})).resolves.toEqual({ lessons, demos, videos });
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
    const upsertVideo = vi.fn().mockResolvedValue(undefined);
    const refreshVideoTaskStatus = vi.fn().mockResolvedValue(refreshedVideo);
    const deps = createBaseDeps({
      historyStore: {
        addLesson: vi.fn(),
        addDemo: vi.fn(),
        upsertVideo,
        listLessons: vi.fn(),
        listDemos: vi.fn(),
        listVideos: vi.fn().mockResolvedValue([queuedVideo])
      },
      refreshVideoTaskStatus
    });

    registerWorkflowIpcHandlers(fakeIpcMain, deps);
    const handler = fakeIpcMain.handlers.get("video:refresh");

    expect(handler).toBeDefined();
    await expect(handler?.({}, " video-1 ")).resolves.toEqual(refreshedVideo);
    expect(refreshVideoTaskStatus).toHaveBeenCalledWith({
      task: queuedVideo,
      config: completeSettings.videoModel,
      client: deps.client,
      now: deps.now
    });
    expect(upsertVideo).toHaveBeenCalledWith(refreshedVideo);
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
