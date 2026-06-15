import type { AppSettings } from "../shared/types";

export type TeacherHelperRendererApi = {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  clearSettings(): Promise<void>;
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
  clearSettings: async () => getApi().clearSettings()
};
