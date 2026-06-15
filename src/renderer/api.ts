import type { DemoRecord, LessonRecord, VideoRecord } from "../main/historyStore";
import type { AppSettings, LessonPlan, ProblemDemoPlan, VideoTask } from "../shared/types";

export type LessonGenerateResult = {
  id: string;
  lesson: LessonPlan;
  videoTask?: VideoTask;
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
  generateLesson(topic: string): Promise<LessonGenerateResult>;
  exportLessonDocx(input: { id: string; title: string; lesson: LessonPlan }): Promise<string>;
  generateDemo(problem: string): Promise<DemoGenerateResult>;
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
  generateLesson: async (topic) => getApi().generateLesson(topic),
  exportLessonDocx: async (input) => getApi().exportLessonDocx(input),
  generateDemo: async (problem) => getApi().generateDemo(problem),
  listHistory: async () => getApi().listHistory()
};
