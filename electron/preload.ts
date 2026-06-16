import { contextBridge, ipcRenderer } from "electron";
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
} from "../src/shared/types.js";
import type { DemoRecord, LessonRecord, VideoRecord } from "../src/main/historyStore.js";

export type TeacherHelperApi = {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  clearSettings(): Promise<void>;
  testKnowledgeConnections(): Promise<KnowledgeConnectionTestResult>;
  getQdrantStatus(): Promise<LocalQdrantStatus>;
  indexTextbook(input: { title: string; sourceName: string; items: TextbookIndexItem[] }): Promise<TextbookRecord>;
  listTextbooks(): Promise<TextbookRecord[]>;
  searchTextbooks(input: { query: string; limit?: number }): Promise<TextbookSearchResult[]>;
  generateLesson(topic: string): Promise<{ id: string; lesson: LessonPlan; videoTask?: VideoTask; videoError?: string }>;
  exportLessonDocx(input: { id: string; title: string; lesson: LessonPlan }): Promise<string>;
  generateVideo(input: VideoGenerateInput): Promise<VideoRecord>;
  generateDemo(problem: string): Promise<{ id: string; plan: ProblemDemoPlan; url: string }>;
  refreshVideo(videoId: string): Promise<VideoRecord>;
  listHistory(): Promise<{ lessons: LessonRecord[]; demos: DemoRecord[]; videos: VideoRecord[] }>;
};

const teacherHelperApi: TeacherHelperApi = {
  loadSettings: () => ipcRenderer.invoke("settings:load") as Promise<AppSettings>,
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings) as Promise<void>,
  clearSettings: () => ipcRenderer.invoke("settings:clear") as Promise<void>,
  testKnowledgeConnections: () => ipcRenderer.invoke("knowledge:testConnections") as Promise<KnowledgeConnectionTestResult>,
  getQdrantStatus: () => ipcRenderer.invoke("knowledge:qdrantStatus") as Promise<LocalQdrantStatus>,
  indexTextbook: (input) => ipcRenderer.invoke("textbook:index", input) as Promise<TextbookRecord>,
  listTextbooks: () => ipcRenderer.invoke("textbook:list") as Promise<TextbookRecord[]>,
  searchTextbooks: (input) => ipcRenderer.invoke("textbook:search", input) as Promise<TextbookSearchResult[]>,
  generateLesson: (topic) => ipcRenderer.invoke("lesson:generate", topic) as Promise<{
    id: string;
    lesson: LessonPlan;
    videoTask?: VideoTask;
    videoError?: string;
  }>,
  exportLessonDocx: (input) => ipcRenderer.invoke("lesson:exportDocx", input) as Promise<string>,
  generateVideo: (input) => ipcRenderer.invoke("video:generate", input) as Promise<VideoRecord>,
  generateDemo: (problem) => ipcRenderer.invoke("demo:generate", problem) as Promise<{
    id: string;
    plan: ProblemDemoPlan;
    url: string;
  }>,
  refreshVideo: (videoId) => ipcRenderer.invoke("video:refresh", videoId) as Promise<VideoRecord>,
  listHistory: () => ipcRenderer.invoke("history:list") as Promise<{
    lessons: LessonRecord[];
    demos: DemoRecord[];
    videos: VideoRecord[];
  }>
};

contextBridge.exposeInMainWorld("teacherHelper", teacherHelperApi);

declare global {
  interface Window {
    teacherHelper: TeacherHelperApi;
  }
}
