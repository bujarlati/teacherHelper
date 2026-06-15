import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHistoryStore } from "../../src/main/historyStore";
import { readJsonFile, writeJsonFile } from "../../src/main/jsonStore";
import type { DemoRecord, LessonRecord, VideoRecord } from "../../src/main/historyStore";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function lessonRecord(input: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: "lesson-1",
    topic: "一元一次方程",
    title: "一元一次方程入门",
    markdown: "# 一元一次方程入门",
    createdAt: "2026-06-15T08:00:00.000Z",
    ...input
  };
}

function demoRecord(input: Partial<DemoRecord> = {}): DemoRecord {
  return {
    id: "demo-1",
    lessonId: "lesson-1",
    title: "方程天平演示",
    kind: "equation",
    originalProblem: "x + 2 = 5",
    filePath: "D:\\teacherHelper\\output\\demo.html",
    createdAt: "2026-06-15T08:00:00.000Z",
    ...input
  };
}

function videoRecord(input: Partial<VideoRecord> = {}): VideoRecord {
  return {
    id: "video-1",
    lessonId: "lesson-1",
    requestId: "request-1",
    status: "InQueue",
    prompt: "A classroom animation.",
    script: "Show the equation.",
    createdAt: "2026-06-15T08:00:00.000Z",
    updatedAt: "2026-06-15T08:00:00.000Z",
    ...input
  };
}

describe("createHistoryStore", () => {
  it("returns empty lists when history file does not exist", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await expect(store.listLessons()).resolves.toEqual([]);
    await expect(store.listDemos()).resolves.toEqual([]);
    await expect(store.listVideos()).resolves.toEqual([]);
  });

  it("adds and lists lesson records newest first", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await store.addLesson(lessonRecord({ id: "lesson-old", createdAt: "2026-06-15T08:00:00.000Z" }));
    await store.addLesson(lessonRecord({ id: "lesson-new", createdAt: "2026-06-15T09:00:00.000Z" }));

    await expect(store.listLessons()).resolves.toEqual([
      lessonRecord({ id: "lesson-new", createdAt: "2026-06-15T09:00:00.000Z" }),
      lessonRecord({ id: "lesson-old", createdAt: "2026-06-15T08:00:00.000Z" })
    ]);
  });

  it("replaces a lesson with the same id instead of duplicating it", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await store.addLesson(lessonRecord({ title: "旧标题" }));
    await store.addLesson(lessonRecord({ title: "新标题", markdown: "# 新标题" }));

    await expect(store.listLessons()).resolves.toEqual([lessonRecord({ title: "新标题", markdown: "# 新标题" })]);
  });

  it("adds and lists demo records newest first", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await store.addDemo(demoRecord({ id: "demo-old", createdAt: "2026-06-15T08:00:00.000Z" }));
    await store.addDemo(demoRecord({ id: "demo-new", createdAt: "2026-06-15T09:00:00.000Z" }));

    await expect(store.listDemos()).resolves.toEqual([
      demoRecord({ id: "demo-new", createdAt: "2026-06-15T09:00:00.000Z" }),
      demoRecord({ id: "demo-old", createdAt: "2026-06-15T08:00:00.000Z" })
    ]);
  });

  it("upserts and lists video task records newest first", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await store.upsertVideo(videoRecord({ id: "video-old", createdAt: "2026-06-15T08:00:00.000Z" }));
    await store.upsertVideo(videoRecord({ id: "video-new", createdAt: "2026-06-15T09:00:00.000Z" }));
    await store.upsertVideo(
      videoRecord({
        id: "video-old",
        status: "Succeed",
        videoUrl: "https://cdn.example.test/video.mp4",
        updatedAt: "2026-06-15T10:00:00.000Z"
      })
    );

    await expect(store.listVideos()).resolves.toEqual([
      videoRecord({ id: "video-new", createdAt: "2026-06-15T09:00:00.000Z" }),
      videoRecord({
        id: "video-old",
        status: "Succeed",
        videoUrl: "https://cdn.example.test/video.mp4",
        updatedAt: "2026-06-15T10:00:00.000Z"
      })
    ]);
  });

  it("rejects invalid history JSON without resetting it", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);
    await writeFile(join(tempDir, "history.json"), "{ invalid json", "utf-8");

    await expect(store.listLessons()).rejects.toThrow(SyntaxError);
  });

  it("persists history.json with lessons, demos, and videos sections", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await store.addLesson(lessonRecord());

    await expect(readJsonFile(join(tempDir, "history.json"), {})).resolves.toEqual({
      lessons: [lessonRecord()],
      demos: [],
      videos: []
    });
  });
});

describe("jsonStore", () => {
  it("writes pretty JSON and creates parent directories", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-json-"));
    const filePath = join(tempDir, "nested", "settings", "value.json");

    await writeJsonFile(filePath, { ok: true, count: 2 });

    await expect(readFile(filePath, "utf-8")).resolves.toBe('{\n  "ok": true,\n  "count": 2\n}');
    await expect(readJsonFile(filePath, {})).resolves.toEqual({ ok: true, count: 2 });
  });

  it("returns a fresh fallback value when JSON file is missing", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-json-"));
    const filePath = join(tempDir, "missing", "value.json");
    const fallback = { lessons: [] as LessonRecord[] };

    const first = await readJsonFile(filePath, fallback);
    first.lessons.push(lessonRecord());

    await expect(readJsonFile(filePath, fallback)).resolves.toEqual({ lessons: [] });
  });
});
