// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LessonPlan, ProblemDemoPlan, VideoTask } from "../../src/shared/types";
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

describe("workflow pages", () => {
  beforeEach(() => {
    vi.resetModules();

    Object.defineProperty(window, "teacherHelper", {
      configurable: true,
      value: {
        loadSettings: vi.fn(),
        saveSettings: vi.fn(),
        clearSettings: vi.fn(),
        generateLesson: vi.fn().mockResolvedValue({ id: "lesson-1", lesson, videoTask }),
        exportLessonDocx: vi.fn().mockResolvedValue("D:\\teacherHelper-data\\exports\\一次函数复习.docx"),
        generateDemo: vi.fn().mockResolvedValue({ id: "demo-1", plan: demoPlan, url: "http://127.0.0.1:4321/" }),
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
});
