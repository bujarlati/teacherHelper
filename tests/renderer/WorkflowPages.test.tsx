// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  rerankScore: 0.97,
  rankingSource: "reranker",
  textbookId: "book-1",
  title: "七年级数学",
  sourceName: "local.pdf",
  pageNumber: 2,
  kind: "page",
  imagePath: "D:\\teacherHelper-data\\textbooks\\book-1\\pages\\page-002.png",
  imageDataUrl: "data:image/png;base64,AAA"
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
        generateLesson: vi.fn().mockResolvedValue({
          id: "lesson-1",
          lesson,
          localDemo: {
            id: "local-demo-1",
            title: lesson.title,
            url: "http://127.0.0.1:8123/"
          }
        }),
        exportLessonDocx: vi.fn().mockResolvedValue("D:\\teacherHelper-data\\exports\\一次函数复习.docx"),
        generateVideo: vi.fn(),
        generateLocalTeachingDemo: vi.fn().mockResolvedValue({
          id: "local-demo-1",
          title: "A stable local teaching demo",
          url: "http://127.0.0.1:8123/"
        }),
        generateDemo: vi.fn().mockResolvedValue({ id: "demo-1", plan: demoPlan, url: "http://127.0.0.1:4321/" }),
        openDemo: vi.fn().mockResolvedValue("http://127.0.0.1:4321/"),
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
    expect(screen.getByText("教案已生成，本地教学演示已打开。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "打开本地教学演示" }).getAttribute("href")).toBe("http://127.0.0.1:8123/");

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

  test("LessonPage keeps the generated lesson visible when local demo generation fails", async () => {
    window.teacherHelper.generateLesson = vi.fn().mockResolvedValue({
      id: "lesson-1",
      lesson,
      demoError: "local preview failed"
    });
    const { LessonPage } = await import("../../src/renderer/pages/LessonPage");

    render(<LessonPage />);

    fireEvent.change(screen.getByLabelText("课题"), { target: { value: "一次函数" } });
    fireEvent.click(screen.getByRole("button", { name: "生成教案" }));

    expect(await screen.findByText("# 一次函数复习", { exact: false })).toBeTruthy();
    expect(screen.getByText("教案已生成，本地教学演示生成失败：local preview failed")).toBeTruthy();
  });

  test("LessonPage refines an existing lesson with the current markdown context", async () => {
    const updatedLesson: LessonPlan = {
      ...lesson,
      title: "一次函数复习（生活情境版）",
      markdown: "# 一次函数复习（生活情境版）\n\n加入打车计费情境。"
    };
    window.teacherHelper.generateLesson = vi.fn()
      .mockResolvedValueOnce({ id: "lesson-1", lesson })
      .mockResolvedValueOnce({
        id: "lesson-2",
        lesson: updatedLesson,
        localDemo: {
          id: "lesson-2",
          title: updatedLesson.title,
          url: "http://127.0.0.1:8124/"
        }
      });
    const { LessonPage } = await import("../../src/renderer/pages/LessonPage");

    render(<LessonPage />);

    fireEvent.change(screen.getByLabelText("课题"), { target: { value: "一次函数" } });
    fireEvent.click(screen.getByRole("button", { name: "生成教案" }));
    expect(await screen.findByText("# 一次函数复习", { exact: false })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("教案修改要求"), { target: { value: "加入生活案例，降低难度" } });
    fireEvent.click(screen.getByRole("button", { name: "根据要求修改教案" }));

    await waitFor(() => {
      expect(window.teacherHelper.generateLesson).toHaveBeenCalledTimes(2);
    });
    const refineTopic = vi.mocked(window.teacherHelper.generateLesson).mock.calls[1][0];
    expect(refineTopic).toContain("请基于以下已有教案进行二次修改");
    expect(refineTopic).toContain("原始课题：一次函数");
    expect(refineTopic).toContain("加入生活案例，降低难度");
    expect(refineTopic).toContain(lesson.markdown);
    expect(await screen.findByText("# 一次函数复习（生活情境版）", { exact: false })).toBeTruthy();
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

  test("DemoPage refines an existing demo with the current plan context", async () => {
    const updatedPlan: ProblemDemoPlan = {
      ...demoPlan,
      title: "工程题演示（慢速讲解）",
      steps: ["先画效率条", "再合并效率", "最后求时间"]
    };
    window.teacherHelper.generateDemo = vi.fn()
      .mockResolvedValueOnce({ id: "demo-1", plan: demoPlan, url: "http://127.0.0.1:4321/" })
      .mockResolvedValueOnce({ id: "demo-2", plan: updatedPlan, url: "http://127.0.0.1:4322/" });
    const { DemoPage } = await import("../../src/renderer/pages/DemoPage");

    render(<DemoPage />);

    fireEvent.change(screen.getByLabelText("题目"), { target: { value: "甲乙合作。" } });
    fireEvent.click(screen.getByRole("button", { name: "生成演示" }));
    expect(await screen.findByText("工程题演示")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("演示修改要求"), { target: { value: "改成慢速讲解，突出效率条" } });
    fireEvent.click(screen.getByRole("button", { name: "根据要求修改演示" }));

    await waitFor(() => {
      expect(window.teacherHelper.generateDemo).toHaveBeenCalledTimes(2);
    });
    const refinedProblem = vi.mocked(window.teacherHelper.generateDemo).mock.calls[1][0];
    expect(refinedProblem).toContain("请基于以下已有课堂演示进行二次修改");
    expect(refinedProblem).toContain("原始题目：甲乙合作。");
    expect(refinedProblem).toContain("改成慢速讲解，突出效率条");
    expect(refinedProblem).toContain("相加效率");
    expect(await screen.findByText("工程题演示（慢速讲解）")).toBeTruthy();
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
    expect(await screen.findByText("第 2 页 · page · 相似度 0.91 · 重排 0.97")).toBeTruthy();
    expect(screen.getByRole("img", { name: /教材结果预览：七年级数学/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "查看图片" }));

    expect(await screen.findByRole("heading", { name: "结果图片预览" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /放大预览：七年级数学/ })).toBeTruthy();
    expect(screen.getAllByText("D:\\teacherHelper-data\\textbooks\\book-1\\pages\\page-002.png").length).toBeGreaterThan(0);
  });

  test("TextbookPage refines a search using the current result context", async () => {
    window.teacherHelper.searchTextbooks = vi.fn()
      .mockResolvedValueOnce([textbookSearchResult])
      .mockResolvedValueOnce([{ ...textbookSearchResult, id: "point-2", pageNumber: 3, score: 0.95 }]);
    const { TextbookPage } = await import("../../src/renderer/pages/TextbookPage");

    render(<TextbookPage />);

    expect(await screen.findByText("七年级数学")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("教材检索问题"), { target: { value: "一次函数图像" } });
    fireEvent.click(screen.getByRole("button", { name: "检索教材" }));
    expect(await screen.findByText("第 2 页 · page · 相似度 0.91 · 重排 0.97")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("教材检索修改要求"), { target: { value: "只看含坐标系图形的页面" } });
    fireEvent.click(screen.getByRole("button", { name: "根据要求继续检索" }));

    await waitFor(() => {
      expect(window.teacherHelper.searchTextbooks).toHaveBeenCalledTimes(2);
    });
    const refinedQuery = vi.mocked(window.teacherHelper.searchTextbooks).mock.calls[1][0].query;
    expect(refinedQuery).toContain("请基于上一次教材检索结果继续检索");
    expect(refinedQuery).toContain("原问题：一次函数图像");
    expect(refinedQuery).toContain("只看含坐标系图形的页面");
    expect(refinedQuery).toContain("七年级数学");
    expect(await screen.findByText("第 3 页 · page · 相似度 0.95 · 重排 0.97")).toBeTruthy();
  });

  test("TextbookPage shows a readable fallback when a search result image is unavailable", async () => {
    window.teacherHelper.searchTextbooks = vi.fn().mockResolvedValue([{
      ...textbookSearchResult,
      id: "point-without-image",
      imageDataUrl: undefined,
      rankingSource: "qdrant",
      rerankScore: undefined
    }]);
    const { TextbookPage } = await import("../../src/renderer/pages/TextbookPage");

    render(<TextbookPage />);

    expect(await screen.findByText("七年级数学")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("教材检索问题"), { target: { value: "一次函数图像" } });
    fireEvent.click(screen.getByRole("button", { name: "检索教材" }));

    expect(await screen.findByText("图片预览不可用")).toBeTruthy();
  });

  test("TextbookPage indexes multiple PDFs as one textbook library", async () => {
    const renderPdfFileToIndexItems = vi.fn(async () => [{
      kind: "page" as const,
      pageNumber: 1,
      imageDataUrl: "data:image/png;base64,AAA"
    }]);
    vi.doMock("../../src/renderer/pdfRenderer", () => ({
      renderPdfFileToIndexItems
    }));
    window.teacherHelper.indexTextbook = vi.fn().mockResolvedValue({
      ...textbook,
      id: "library-1",
      title: "Middle school library",
      sourceName: "algebra.pdf, geometry.pdf",
      sourceNames: ["algebra.pdf", "geometry.pdf"],
      sources: [
        { name: "algebra.pdf", pageCount: 1, itemCount: 1 },
        { name: "geometry.pdf", pageCount: 1, itemCount: 1 }
      ],
      pageCount: 2,
      itemCount: 2
    });
    const { TextbookPage } = await import("../../src/renderer/pages/TextbookPage");

    const { container } = render(<TextbookPage />);
    const inputs = container.querySelectorAll("input");
    const fileInput = inputs[0] as HTMLInputElement;
    const titleInput = inputs[1] as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(["a"], "algebra.pdf", { type: "application/pdf" }),
          new File(["b"], "geometry.pdf", { type: "application/pdf" })
        ]
      }
    });
    fireEvent.change(titleInput, { target: { value: "Middle school library" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      expect(window.teacherHelper.indexTextbook).toHaveBeenCalledWith({
        title: "Middle school library",
        sourceNames: ["algebra.pdf", "geometry.pdf"],
        items: [
          expect.objectContaining({ pageNumber: 1, sourceName: "algebra.pdf", sourcePageNumber: 1 }),
          expect.objectContaining({ pageNumber: 2, sourceName: "geometry.pdf", sourcePageNumber: 1 })
        ]
      });
    });
    expect(renderPdfFileToIndexItems).toHaveBeenCalledTimes(2);
    expect((await screen.findAllByText("Middle school library")).length).toBeGreaterThan(0);
    expect(screen.getByText("algebra.pdf")).toBeTruthy();
    expect(screen.getByText("geometry.pdf")).toBeTruthy();
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
    expect(screen.getByRole("link", { name: "打开视频" }).getAttribute("href")).toBe(
      "https://cdn.example.test/video.mp4"
    );
    expect(screen.getByLabelText("生成视频预览").getAttribute("src")).toBe("https://cdn.example.test/video.mp4");
  });

  test("VideoPage generates a local teaching demo from the current prompt and script", async () => {
    window.teacherHelper.generateLocalTeachingDemo = vi.fn().mockResolvedValue({
      id: "local-demo-1",
      title: "A stable local teaching demo",
      url: "http://127.0.0.1:8123/"
    });
    const { VideoPage } = await import("../../src/renderer/pages/VideoPage");

    render(<VideoPage />);

    const textareas = document.querySelectorAll("textarea");
    fireEvent.change(textareas[0], { target: { value: " A number line animation. " } });
    fireEvent.change(textareas[1], { target: { value: " Show A then B. " } });
    fireEvent.click(screen.getByRole("button", { name: "生成本地演示" }));

    await waitFor(() => {
      expect(window.teacherHelper.generateLocalTeachingDemo).toHaveBeenCalledWith({
        prompt: "A number line animation.",
        script: "Show A then B."
      });
    });
    expect(await screen.findByText("本地教学演示已生成并打开。")).toBeTruthy();
    expect(screen.getByText("A stable local teaching demo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "打开本地演示" }).getAttribute("href")).toBe("http://127.0.0.1:8123/");
  });

  test("VideoPage refines a local teaching demo with the current prompt and script context", async () => {
    window.teacherHelper.generateLocalTeachingDemo = vi.fn()
      .mockResolvedValueOnce({
        id: "local-demo-1",
        title: "A stable local teaching demo",
        url: "http://127.0.0.1:8123/"
      })
      .mockResolvedValueOnce({
        id: "local-demo-2",
        title: "A slower local teaching demo",
        url: "http://127.0.0.1:8124/"
      });
    const { VideoPage } = await import("../../src/renderer/pages/VideoPage");

    render(<VideoPage />);

    fireEvent.change(screen.getByLabelText("提示词"), { target: { value: "A number line animation." } });
    fireEvent.change(screen.getByLabelText("脚本/分镜"), { target: { value: "Show A then B." } });
    fireEvent.click(screen.getByRole("button", { name: "生成本地演示" }));
    expect(await screen.findByText("A stable local teaching demo")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("视频修改要求"), { target: { value: "放慢节奏，并加入停顿提问" } });
    fireEvent.click(screen.getByRole("button", { name: "根据要求修改本地演示" }));

    await waitFor(() => {
      expect(window.teacherHelper.generateLocalTeachingDemo).toHaveBeenCalledTimes(2);
    });
    const refinedInput = vi.mocked(window.teacherHelper.generateLocalTeachingDemo).mock.calls[1][0];
    expect(refinedInput.prompt).toContain("请基于以下已有视频/本地演示方案进行二次修改");
    expect(refinedInput.prompt).toContain("A number line animation.");
    expect(refinedInput.prompt).toContain("放慢节奏，并加入停顿提问");
    expect(refinedInput.script).toContain("Show A then B.");
    expect(await screen.findByText("A slower local teaching demo")).toBeTruthy();
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

  test("HistoryPage opens a saved HTML demo", async () => {
    const demos: DemoRecord[] = [{
      id: "demo-1",
      title: "工程题演示",
      problem: "甲乙合作。",
      kind: "simple",
      demoPath: "D:\\demos\\demo-1",
      createdAt: "2026-06-15T02:03:04.000Z"
    }];
    window.teacherHelper.listHistory = vi.fn().mockResolvedValue({ lessons: [], demos, videos: [] });
    window.teacherHelper.openDemo = vi.fn().mockResolvedValue("http://127.0.0.1:4321/");
    const { HistoryPage } = await import("../../src/renderer/pages/HistoryPage");

    render(<HistoryPage />);

    expect(await screen.findByText("工程题演示")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "打开演示" }));

    await waitFor(() => {
      expect(window.teacherHelper.openDemo).toHaveBeenCalledWith("demo-1");
    });
    expect(await screen.findByText("演示已打开：http://127.0.0.1:4321/")).toBeTruthy();
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
    expect(screen.getByRole("link", { name: "打开视频" }).getAttribute("href")).toBe(
      "https://cdn.example.test/video.mp4"
    );
    expect(screen.getByLabelText("视频任务 video-1 预览").getAttribute("src")).toBe(
      "https://cdn.example.test/video.mp4"
    );
    expect(screen.getByText("视频已生成。")).toBeTruthy();
  });

  test("VideoPage automatically refreshes a queued video and plays the downloaded local copy", async () => {
    vi.useFakeTimers();
    const queuedVideo: VideoRecord = {
      id: "video-standalone-1",
      requestId: "request-video-1",
      status: "InQueue",
      prompt: "A number line animation.",
      script: "Show A then B.",
      imageSize: "960x960",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T03:04:05.000Z"
    };
    const finishedVideo: VideoRecord = {
      ...queuedVideo,
      status: "Succeed",
      videoUrl: "https://cdn.example.test/video.mp4",
      localVideoPath: "D:\\teacherHelper-data\\videos\\video-standalone-1.mp4",
      updatedAt: "2026-06-15T04:05:06.000Z"
    };
    window.teacherHelper.generateVideo = vi.fn().mockResolvedValue(queuedVideo);
    window.teacherHelper.refreshVideo = vi.fn().mockResolvedValue(finishedVideo);
    const { VideoPage } = await import("../../src/renderer/pages/VideoPage");

    render(<VideoPage />);

    fireEvent.change(screen.getByLabelText("提示词"), { target: { value: "A number line animation." } });
    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("视频任务已提交：InQueue")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(window.teacherHelper.refreshVideo).toHaveBeenCalledWith("video-standalone-1");
    expect(screen.getByLabelText("生成视频预览").getAttribute("src")).toBe(
      "file:///D:/teacherHelper-data/videos/video-standalone-1.mp4"
    );
    expect(screen.getByRole("link", { name: "打开视频" }).getAttribute("href")).toBe(
      "file:///D:/teacherHelper-data/videos/video-standalone-1.mp4"
    );
  });

  test("HistoryPage previews saved videos and refreshes completed video links", async () => {
    const finishedVideo: VideoRecord = {
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "request-1",
      status: "Succeed",
      prompt: "prompt",
      script: "script",
      videoUrl: "https://cdn.example.test/old-video.mp4",
      createdAt: "2026-06-15T03:04:05.000Z",
      updatedAt: "2026-06-15T04:05:06.000Z"
    };
    const refreshedVideo: VideoRecord = {
      ...finishedVideo,
      videoUrl: "https://cdn.example.test/new-video.mp4",
      updatedAt: "2026-06-15T05:06:07.000Z"
    };
    window.teacherHelper.listHistory = vi.fn().mockResolvedValue({
      lessons: [],
      demos: [],
      videos: [finishedVideo]
    });
    window.teacherHelper.refreshVideo = vi.fn().mockResolvedValue(refreshedVideo);
    const { HistoryPage } = await import("../../src/renderer/pages/HistoryPage");

    render(<HistoryPage />);

    expect(await screen.findByText("视频任务 video-1")).toBeTruthy();
    expect(screen.getByRole("link", { name: "打开视频" }).getAttribute("href")).toBe(
      "https://cdn.example.test/old-video.mp4"
    );
    expect(screen.getByLabelText("视频任务 video-1 预览").getAttribute("src")).toBe(
      "https://cdn.example.test/old-video.mp4"
    );

    fireEvent.click(screen.getByRole("button", { name: "刷新状态" }));

    await waitFor(() => {
      expect(window.teacherHelper.refreshVideo).toHaveBeenCalledWith("video-1");
    });
    expect(screen.getByRole("link", { name: "打开视频" }).getAttribute("href")).toBe(
      "https://cdn.example.test/new-video.mp4"
    );
    expect(screen.getByLabelText("视频任务 video-1 预览").getAttribute("src")).toBe(
      "https://cdn.example.test/new-video.mp4"
    );
  });

  test("HistoryPage shows long queue warnings and auto-refreshes queued videos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));
    const queuedVideo: VideoRecord = {
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "request-1",
      status: "InQueue",
      prompt: "prompt",
      script: "script",
      createdAt: "2026-06-15T03:20:00.000Z",
      updatedAt: "2026-06-15T03:20:00.000Z"
    };
    const refreshedVideo: VideoRecord = {
      ...queuedVideo,
      status: "Succeed",
      videoUrl: "https://cdn.example.test/video.mp4",
      localVideoPath: "D:\\teacherHelper-data\\videos\\video-1.mp4",
      updatedAt: "2026-06-15T04:00:30.000Z"
    };
    window.teacherHelper.listHistory = vi.fn().mockResolvedValue({
      lessons: [],
      demos: [],
      videos: [queuedVideo]
    });
    window.teacherHelper.refreshVideo = vi.fn().mockResolvedValue(refreshedVideo);
    const { HistoryPage } = await import("../../src/renderer/pages/HistoryPage");

    render(<HistoryPage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("排队：40 分钟")).toBeTruthy();
    expect(screen.getByText("排队超过 30 分钟，可能服务商拥堵，建议重试或换模型。")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(window.teacherHelper.refreshVideo).toHaveBeenCalledWith("video-1");
    expect(screen.getByLabelText("视频任务 video-1 预览").getAttribute("src")).toBe(
      "file:///D:/teacherHelper-data/videos/video-1.mp4"
    );
  });
});
