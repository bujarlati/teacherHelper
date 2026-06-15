import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings } from "../src/shared/types.js";

export type TeacherHelperApi = {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  clearSettings(): Promise<void>;
};

const teacherHelperApi: TeacherHelperApi = {
  loadSettings: () => ipcRenderer.invoke("settings:load") as Promise<AppSettings>,
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings) as Promise<void>,
  clearSettings: () => ipcRenderer.invoke("settings:clear") as Promise<void>
};

contextBridge.exposeInMainWorld("teacherHelper", teacherHelperApi);

declare global {
  interface Window {
    teacherHelper: TeacherHelperApi;
  }
}
