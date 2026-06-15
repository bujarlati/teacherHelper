import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, LessonPlan, ProblemDemoPlan, VideoTask } from "../src/shared/types.js";
import type { DemoRecord, LessonRecord, VideoRecord } from "../src/main/historyStore.js";

export type TeacherHelperApi = {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  clearSettings(): Promise<void>;
  generateLesson(topic: string): Promise<{ id: string; lesson: LessonPlan; videoTask?: VideoTask }>;
  exportLessonDocx(input: { id: string; title: string; lesson: LessonPlan }): Promise<string>;
  generateDemo(problem: string): Promise<{ id: string; plan: ProblemDemoPlan; url: string }>;
  listHistory(): Promise<{ lessons: LessonRecord[]; demos: DemoRecord[]; videos: VideoRecord[] }>;
};

const teacherHelperApi: TeacherHelperApi = {
  loadSettings: () => ipcRenderer.invoke("settings:load") as Promise<AppSettings>,
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings) as Promise<void>,
  clearSettings: () => ipcRenderer.invoke("settings:clear") as Promise<void>,
  generateLesson: (topic) => ipcRenderer.invoke("lesson:generate", topic) as Promise<{
    id: string;
    lesson: LessonPlan;
    videoTask?: VideoTask;
  }>,
  exportLessonDocx: (input) => ipcRenderer.invoke("lesson:exportDocx", input) as Promise<string>,
  generateDemo: (problem) => ipcRenderer.invoke("demo:generate", problem) as Promise<{
    id: string;
    plan: ProblemDemoPlan;
    url: string;
  }>,
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
