// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LessonPlan, ProblemDemoPlan, VideoTask } from "../../src/shared/types";
import type { TextbookRecord, TextbookSearchResult } from "../../src/shared/types";
import type { DemoRecord, LessonRecord, VideoRecord } from "../../src/main/historyStore";

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
  markdown: "# 一次函数复习\n\n## 视频脚本\n讲解一次函数图像。"
};

const videoTask: VideoTask = {
  id: "video-1",
  requestId: "request-1",
  status: "InQueue",
  prompt: lesson.video_prompt,
  script: lesson.video_script,
  createdAt: "2026-06-15T01:02:03.000Z",
  updatedAt: "2026-06-15T01:02:03.000Z"
};

const demoPlan: ProblemDemoPlan = {
  kind: "simple",
  title: "工程题演示",
  originalProblem: "甲乙合作。",
  knownValues: [{ label: "甲效率", value: "1/6" }],
  target: "求合作时间",
  steps: ["相加效率", "求倒数"]
};

const textbook: TextbookRecord = {
  id: "book-1",
  title: "七年级数学",
  sourceName: "local.pdf",
  collectionName: "teacherhelper_textbook_visual",
  pageCount: 2,
  itemCount: 6,
  status: "indexed",
  createdAt: "2026-06-15T03:04:05.000Z",
  updatedAt: "2026-06-15T03:04:05.000Z"
};

const textbookSearchResult: TextbookSearchResult = {
  id: "point-1",
  score: 0.91,
  textbookId: "book-1",
  title: "七年级数学",
  sourceName: "local.pdf",
  pageNumber: 2,
  kind: "page",
  imagePath: "D:\\teacherHelper-data\\textbooks\\book-1\\pages\\page-002.png"
};

describe("workflow pages", () => {
  beforeEach(() => {
    vi.resetModules();

    Object.defineProperty(window, "teacherHelper", {
      configurable: true,
      value: {
        loadSettings: vi.fn(),
        saveSettings: vi.fn(),
        clearSettings: vi.fn(),
        testKnowledgeConnections: vi.fn(),
        getQdrantStatus: vi.fn(),
        indexTextbook: vi.fn(),
        listTextbooks: vi.fn().mockResolvedValue([textbook]),
        searchTextbooks: vi.fn().mockResolvedValue([textbookSearchResult]),
        generateLesson: vi.fn().mockResolvedValue({ id: "lesson-1", lesson, videoTask }),
        exportLessonDocx: vi.fn().mockResolvedValue("D:\\teacherHelper-data\\exports\\一次函数复习.docx"),
        generateVideo: vi.fn(),
        generateDemo: vi.fn().mockResolvedValue({ id: "demo-1", plan: demoPlan, url: "http://127.0.0.1:4321/" }),
        refreshVideo: vi.fn(),
        listHistory: vi.fn()
      }
    });

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("LessonPage generates a lesson and supports export and copy", async () => {
    const { LessonPage } = await import("../../src/renderer/pages/LessonPage");

    render(<LessonPage />);

    fireEvent.change(screen.getByLabelText("课题"), { target: { value: "一次函数" } });
    fireEvent.click(screen.getByRole("button", { name: "生成教案" }));

    await waitFor(() => {
      expect(window.teacherHelper.generateLesson).toHaveBeenCalledWith("一次函数");
    });
    expect(await screen.findByText("# 一次函数复习", { exact: false })).toBeTruthy();
    expect(screen.getByText("视频任务已提交：InQueue")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制 Markdown" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(lesson.markdown);
    });
    expect(await screen.findByText("Markdown 已复制。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "导出 Word" }));
    await waitFor(() => {
      expect(window.teacherHelper.exportLessonDocx).toHaveBeenCalledWith({
        id: "lesson-1",
        title: lesson.title,
        lesson
      });
    });
    expect(await screen.findByText("D:\\teacherHelper-data\\exports\\一次函数复习.docx")).toBeTruthy();
  });

  test("LessonPage keeps the generated lesson visible when video submission fails", async () => {
    window.teacherHelper.generateLesson = vi.fn().mockResolvedValue({
      id: "lesson-1",
      lesson,
      videoError: "video quota exceeded"
    });
    const { LessonPage } = await import("../../src/renderer/pages/LessonPage");

    render(<LessonPage />);

    fireEvent.change(screen.getByLabelText("课题"), { target: { value: "一次函数" } });
    fireEvent.click(screen.getByRole("button", { name: "生成教案" }));

    expect(await screen.findByText("# 一次函数复习", { exact: false })).toBeTruthy();
    expect(screen.getByText("教案已生成，视频任务提交失败：video quota exceeded")).toBeTruthy();
  });

  test("LessonPage shows progress, elapsed time, and slow-generation guidance while generating", async () => {
    vi.useFakeTimers();
    window.teacherHelper.generateLesson = vi.fn().mockReturnValue(new Promise(() => undefined));
    const { LessonPage } = await import("../../src/renderer/pages/LessonPage");

    render(<LessonPage />);

    fireEvent.change(screen.getByLabelText("课题"), { target: { value: "一次函数" } });
    fireEvent.click(screen.getByRole("button", { name: "生成教案" }));

    expect(screen.getByRole("progressbar", { name: "教案生成进度" })).toBeTruthy();
    expect(screen.getByText("准备请求")).toBeTruthy();
    expect(screen.getByText("已等待 0 秒")).toBeTruthy();

    await vi.advanceTimersByTimeAsync(6000);
    expect(screen.getByText("等待硅基流动模型返回")).toBeTruthy();
    expect(screen.getByText("已等待 6 秒")).toBeTruthy();

    await vi.advanceTimersByTimeAsync(54000);
    expect(screen.getByText("模型仍在生成，GLM 等推理模型生成完整教案可能需要 2 到 5 分钟。")).toBeTruthy();
    vi.useRealTimers();
  });

  test("LessonPage hides progress and shows the failure reason when generation fails", async () => {
    window.teacherHelper.generateLesson = vi.fn().mockRejectedValue(
      new Error("硅基流动请求超时，请检查网络、API Key、模型名，或换用响应更快的文本模型后重试。")
    );
    const { LessonPage } = await import("../../src/renderer/pages/LessonPage");

    render(<LessonPage />);

    fireEvent.change(screen.getByLabelText("课题"), { target: { value: "一次函数" } });
    fireEvent.click(screen.getByRole("button", { name: "生成教案" }));

    expect(await screen.findByText("硅基流动请求超时，请检查网络、API Key、模型名，或换用响应更快的文本模型后重试。")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "教案生成进度" })).toBeNull();
    expect((screen.getByRole("button", { name: "生成教案" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("DemoPage generates a demo and shows the returned URL and plan details", async () => {
    const { DemoPage } = await import("../../src/renderer/pages/DemoPage");

    render(<DemoPage />);

    fireEvent.change(screen.getByLabelText("题目"), { target: { value: "甲乙合作。" } });
    fireEvent.click(screen.getByRole("button", { name: "生成演示" }));

    await waitFor(() => {
      expect(window.teacherHelper.generateDemo).toHaveBeenCalledWith("甲乙合作。");
    });
    expect(await screen.findByText("工程题演示")).toBeTruthy();
    expect(screen.getByText("simple")).toBeTruthy();
    expect(screen.getByText("http://127.0.0.1:4321/")).toBeTruthy();
    expect(screen.getByText("演示已生成并打开。")).toBeTruthy();
  });

  test("App exposes the standalone video generation page", async () => {
    const { App } = await import("../../src/renderer/App");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "视频生成" }));

    expect(screen.getByRole("heading", { name: "视频生成" })).toBeTruthy();
    expect(screen.getByLabelText("提示词")).toBeTruthy();
  });

  test("App exposes the textbook indexing page", async () => {
    const { App } = await import("../../src/renderer/App");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "教材索引" }));

    expect(screen.getByRole("heading", { name: "教材索引" })).toBeTruthy();
    expect(await screen.findByText("七年级数学")).toBeTruthy();
  });

  test("TextbookPage searches indexed textbooks", async () => {
    const { TextbookPage } = await import("../../src/renderer/pages/TextbookPage");

    render(<TextbookPage />);

    expect(await screen.findByText("七年级数学")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("教材检索问题"), { target: { value: "一次函数图像" } });
    fireEvent.click(screen.getByRole("button", { name: "检索教材" }));

    await waitFor(() => {
      expect(window.teacherHelper.searchTextbooks).toHaveBeenCalledWith({ query: "一次函数图像", limit: 6 });
    });
    expect(await screen.findByText("第 2 页 · page · 相似度 0.91")).toBeTruthy();
  });

  test("VideoPage submits an image-to-video task and refreshes its status", async () => {
    const queuedVideo: VideoRecord = {
      id: "video-standalone-1",
      requestId: "request-video-1",
      status: "InQueue",
      prompt: "A number line animation.",
      script: "Show A then B.",
      imageSize: "960x960",
      negativePrompt: "blurry",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T03:04:05.000Z"
    };
    const finishedVideo: VideoRecord = {
      ...queuedVideo,
      status: "Succeed",
      videoUrl: "https://cdn.example.test/video.mp4",
      updatedAt: "2026-06-15T04:05:06.000Z"
    };
    window.teacherHelper.generateVideo = vi.fn().mockResolvedValue(queuedVideo);
    window.teacherHelper.refreshVideo = vi.fn().mockResolvedValue(finishedVideo);
    const { VideoPage } = await import("../../src/renderer/pages/VideoPage");

    render(<VideoPage />);

    fireEvent.change(screen.getByLabelText("提示词"), { target: { value: "A number line animation." } });
    fireEvent.change(screen.getByLabelText("脚本/分镜"), { target: { value: "Show A then B." } });
    fireEvent.change(screen.getByLabelText("尺寸"), { target: { value: "960x960" } });
    fireEvent.change(screen.getByLabelText("负面提示词"), { target: { value: "blurry" } });
    fireEvent.change(screen.getByLabelText("参考图片"), {
      target: { files: [new File(["image-bytes"], "diagram.png", { type: "image/png" })] }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));

    await waitFor(() => {
      expect(window.teacherHelper.generateVideo).toHaveBeenCalledWith({
        prompt: "A number line animation.",
        script: "Show A then B.",
        imageSize: "960x960",
        negativePrompt: "blurry",
        imageDataUrl: expect.stringMatching(/^data:image\/png;base64,/)
      });
    });
    expect(await screen.findByText("视频任务已提交：InQueue")).toBeTruthy();
    expect(screen.getByText("请求：request-video-1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "刷新状态" }));

    await waitFor(() => {
      expect(window.teacherHelper.refreshVideo).toHaveBeenCalledWith("video-standalone-1");
    });
    expect(await screen.findByText("状态：Succeed")).toBeTruthy();
    expect(screen.getByText("https://cdn.example.test/video.mp4")).toBeTruthy();
  });

  test("HistoryPage lists lesson, demo, and video records", async () => {
    const lessons: LessonRecord[] = [{
      id: "lesson-1",
      title: "一次函数复习",
      topic: "一次函数",
      markdown: "# 一次函数复习",
      wordPath: "D:\\exports\\lesson.docx",
      createdAt: "2026-06-15T01:02:03.000Z"
    }];
    const demos: DemoRecord[] = [{
      id: "demo-1",
      title: "工程题演示",
      problem: "甲乙合作。",
      kind: "simple",
      demoPath: "D:\\demos\\demo-1",
      createdAt: "2026-06-15T02:03:04.000Z"
    }];
    const videos: VideoRecord[] = [{
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "request-1",
      status: "InQueue",
      prompt: "prompt",
      script: "script",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T03:04:05.000Z"
    }];
    window.teacherHelper.listHistory = vi.fn().mockResolvedValue({ lessons, demos, videos });
    const { HistoryPage } = await import("../../src/renderer/pages/HistoryPage");

    render(<HistoryPage />);

    expect(await screen.findByText("一次函数复习")).toBeTruthy();
    expect(screen.getByText("课题：一次函数")).toBeTruthy();
    expect(screen.getByText("工程题演示")).toBeTruthy();
    expect(screen.getByText("类型：simple")).toBeTruthy();
    expect(screen.getByText("视频任务 video-1")).toBeTruthy();
    expect(screen.getByText("状态：InQueue")).toBeTruthy();
  });

  test("HistoryPage opens a saved lesson and copies its markdown", async () => {
    const lessons: LessonRecord[] = [{
      id: "lesson-1",
      title: "一次函数复习",
      topic: "一次函数",
      markdown: lesson.markdown,
      createdAt: "2026-06-15T01:02:03.000Z"
    }];
    window.teacherHelper.listHistory = vi.fn().mockResolvedValue({ lessons, demos: [], videos: [] });
    const { HistoryPage } = await import("../../src/renderer/pages/HistoryPage");

    render(<HistoryPage />);

    expect(await screen.findByText("一次函数复习")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看教案" }));

    expect(screen.getByRole("heading", { name: "一次函数复习" })).toBeTruthy();
    expect(screen.getByText("# 一次函数复习", { exact: false })).toBeTruthy();
    expect(screen.getByText("## 视频脚本", { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制 Markdown" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(lesson.markdown);
    });
    expect(await screen.findByText("历史教案 Markdown 已复制。")).toBeTruthy();
  });

  test("HistoryPage refreshes a queued video task and shows the returned video URL", async () => {
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
    window.teacherHelper.listHistory = vi.fn().mockResolvedValue({
      lessons: [],
      demos: [],
      videos: [queuedVideo]
    });
    window.teacherHelper.refreshVideo = vi.fn().mockResolvedValue(refreshedVideo);
    const { HistoryPage } = await import("../../src/renderer/pages/HistoryPage");

    render(<HistoryPage />);

    expect(await screen.findByText("视频任务 video-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "刷新状态" }));

    await waitFor(() => {
      expect(window.teacherHelper.refreshVideo).toHaveBeenCalledWith("video-1");
    });
    expect(await screen.findByText("状态：Succeed")).toBeTruthy();
    expect(screen.getByText("https://cdn.example.test/video.mp4")).toBeTruthy();
    expect(screen.getByText("视频已生成。")).toBeTruthy();
  });
});
