import { join } from "node:path";
import type { DemoKind, VideoTaskStatus } from "../shared/types.js";
import { readJsonFile, writeJsonFile } from "./jsonStore.js";

export type LessonRecord = {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  markdown?: string;
  wordPath?: string;
};

export type DemoRecord = {
  id: string;
  title: string;
  problem: string;
  kind: DemoKind;
  demoPath: string;
  createdAt: string;
};

export type VideoRecord = {
  id: string;
  lessonId: string;
  requestId: string;
  status: VideoTaskStatus;
  prompt: string;
  script: string;
  videoUrl?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

type HistoryFile = {
  lessons: LessonRecord[];
  demos: DemoRecord[];
  videos: VideoRecord[];
};

function createEmptyHistory(): HistoryFile {
  return {
    lessons: [],
    demos: [],
    videos: []
  };
}

function sortByCreatedAtDescending<T extends { createdAt: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function replaceById<T extends { id: string }>(records: T[], record: T): T[] {
  return [record, ...records.filter((item) => item.id !== record.id)];
}

export function createHistoryStore(baseDir: string) {
  const filePath = join(baseDir, "history.json");

  async function loadHistory(): Promise<HistoryFile> {
    return readJsonFile(filePath, createEmptyHistory());
  }

  async function saveHistory(history: HistoryFile): Promise<void> {
    await writeJsonFile(filePath, history);
  }

  return {
    async addLesson(record: LessonRecord): Promise<void> {
      const history = await loadHistory();
      await saveHistory({
        ...history,
        lessons: replaceById(history.lessons, record)
      });
    },

    async listLessons(): Promise<LessonRecord[]> {
      const history = await loadHistory();
      return sortByCreatedAtDescending(history.lessons);
    },

    async addDemo(record: DemoRecord): Promise<void> {
      const history = await loadHistory();
      await saveHistory({
        ...history,
        demos: replaceById(history.demos, record)
      });
    },

    async listDemos(): Promise<DemoRecord[]> {
      const history = await loadHistory();
      return sortByCreatedAtDescending(history.demos);
    },

    async upsertVideo(record: VideoRecord): Promise<void> {
      const history = await loadHistory();
      await saveHistory({
        ...history,
        videos: replaceById(history.videos, record)
      });
    },

    async listVideos(): Promise<VideoRecord[]> {
      const history = await loadHistory();
      return sortByCreatedAtDescending(history.videos);
    }
  };
}
