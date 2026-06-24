import { join } from "node:path";
import type { DemoKind, VideoSegmentTask, VideoTaskStatus } from "../shared/types.js";
import { readJsonFile, writeJsonFile } from "./jsonStore.js";

export type LessonRecord = {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  markdown?: string;
  wordPath?: string;
  demoId?: string;
  demoPath?: string;
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
  lessonId?: string;
  requestId: string;
  status: VideoTaskStatus;
  prompt: string;
  script: string;
  imageSize?: string;
  duration?: number;
  negativePrompt?: string;
  videoUrl?: string;
  localVideoPath?: string;
  segmentRequests?: VideoSegmentTask[];
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

function removeById<T extends { id: string }>(records: T[], id: string): { records: T[]; removed?: T } {
  const removed = records.find((item) => item.id === id);
  return {
    records: records.filter((item) => item.id !== id),
    ...(removed ? { removed } : {})
  };
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

    async deleteLesson(id: string): Promise<LessonRecord | undefined> {
      const history = await loadHistory();
      const result = removeById(history.lessons, id);
      await saveHistory({
        ...history,
        lessons: result.records
      });

      return result.removed;
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

    async deleteDemo(id: string): Promise<DemoRecord | undefined> {
      const history = await loadHistory();
      const result = removeById(history.demos, id);
      await saveHistory({
        ...history,
        demos: result.records
      });

      return result.removed;
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
    },

    async deleteVideo(id: string): Promise<VideoRecord | undefined> {
      const history = await loadHistory();
      const result = removeById(history.videos, id);
      await saveHistory({
        ...history,
        videos: result.records
      });

      return result.removed;
    }
  };
}
