import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWorkflowIpcHandlers } from "../../electron/workflowIpc";
import type { AppSettings, LessonPlan, ProblemDemoPlan } from "../../src/shared/types";
import type { DemoRecord, LessonRecord, VideoRecord } from "../../src/main/historyStore";

type Handler = (_event: unknown, ...args: unknown[]) => unknown;

function createFakeIpcMain() {
  const handlers = new Map<string, Handler>();

  return {
    handlers,
    handle(channel: string, handler: Handler) {
      handlers.set(channel, handler);
    }
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
});
