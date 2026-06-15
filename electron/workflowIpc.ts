import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { lessonPlanSchema } from "../src/shared/schemas.js";
import type { AppSettings, LessonPlan, ProblemDemoPlan } from "../src/shared/types.js";
import type { DemoRecord, LessonRecord, VideoRecord } from "../src/main/historyStore.js";
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

type WorkflowDeps = {
  configStore: ConfigStoreLike;
  historyStore: HistoryStoreLike;
  dataDir: string;
  client: unknown;
  createId(): string;
  now(): string;
  generateLessonPlan(input: { topic: string; config: AppSettings["textModel"]; client: unknown }): Promise<LessonPlan>;
  createVideoTaskFromLesson(input: {
    lessonId: string;
    lesson: LessonPlan;
    config: AppSettings["videoModel"];
    client: unknown;
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
};

const nonEmptyStringSchema = z.string().trim().min(1);
const exportLessonInputSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  lesson: lessonPlanSchema
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
        videoTask = await deps.createVideoTaskFromLesson({
          lessonId: id,
          lesson,
          config: settings.videoModel,
          client: deps.client
        });
        await deps.historyStore.upsertVideo(videoTask);
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

    if (activeDemoServer) {
      await activeDemoServer.close();
    }

    const promotedDemoServer = newDemoServer;
    newDemoServer = undefined;

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
