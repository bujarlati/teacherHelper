import type { DemoRecord, LessonRecord, VideoRecord } from "../main/historyStore";
import type {
  AppSettings,
  KnowledgeConnectionTestResult,
  LessonPlan,
  LocalQdrantStatus,
  ProblemDemoPlan,
  TextbookIndexItem,
  TextbookRecord,
  TextbookSearchResult,
  VideoGenerateInput,
  VideoTask
} from "../shared/types";

export type LessonGenerateResult = {
  id: string;
  lesson: LessonPlan;
  videoTask?: VideoTask;
  videoError?: string;
};

export type DemoGenerateResult = {
  id: string;
  plan: ProblemDemoPlan;
  url: string;
};

export type HistoryListResult = {
  lessons: LessonRecord[];
  demos: DemoRecord[];
  videos: VideoRecord[];
};

export type TeacherHelperRendererApi = {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  clearSettings(): Promise<void>;
  testKnowledgeConnections(): Promise<KnowledgeConnectionTestResult>;
  getQdrantStatus(): Promise<LocalQdrantStatus>;
  indexTextbook(input: {
    title: string;
    sourceName?: string;
    sourceNames?: string[];
    items: TextbookIndexItem[];
  }): Promise<TextbookRecord>;
  listTextbooks(): Promise<TextbookRecord[]>;
  searchTextbooks(input: { query: string; limit?: number }): Promise<TextbookSearchResult[]>;
  generateLesson(topic: string): Promise<LessonGenerateResult>;
  exportLessonDocx(input: { id: string; title: string; lesson: LessonPlan }): Promise<string>;
  generateVideo(input: VideoGenerateInput): Promise<VideoRecord>;
  generateDemo(problem: string): Promise<DemoGenerateResult>;
  refreshVideo(videoId: string): Promise<VideoRecord>;
  listHistory(): Promise<HistoryListResult>;
};

declare global {
  interface Window {
    teacherHelper: TeacherHelperRendererApi;
  }
}

export function getApi(): TeacherHelperRendererApi {
  if (!window.teacherHelper) {
    throw new Error("TeacherHelper preload API is unavailable");
  }

  return window.teacherHelper;
}

export const api: TeacherHelperRendererApi = {
  loadSettings: async () => getApi().loadSettings(),
  saveSettings: async (settings) => getApi().saveSettings(settings),
  clearSettings: async () => getApi().clearSettings(),
  testKnowledgeConnections: async () => getApi().testKnowledgeConnections(),
  getQdrantStatus: async () => getApi().getQdrantStatus(),
  indexTextbook: async (input) => getApi().indexTextbook(input),
  listTextbooks: async () => getApi().listTextbooks(),
  searchTextbooks: async (input) => getApi().searchTextbooks(input),
  generateLesson: async (topic) => getApi().generateLesson(topic),
  exportLessonDocx: async (input) => getApi().exportLessonDocx(input),
  generateVideo: async (input) => getApi().generateVideo(input),
  generateDemo: async (problem) => getApi().generateDemo(problem),
  refreshVideo: async (videoId) => getApi().refreshVideo(videoId),
  listHistory: async () => getApi().listHistory()
};
