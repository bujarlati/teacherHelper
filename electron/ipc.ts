import { ipcMain } from "electron";
import { createConfigStore } from "../src/main/configStore.js";
import { getAppDataDir } from "../src/main/paths.js";
import type { AppSettings } from "../src/shared/types.js";

type SettingsConfigStore = {
  load(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
  clear(): Promise<void>;
};

type IpcMainLike = {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
};

export function registerSettingsIpcHandlers(ipcMainLike: IpcMainLike, configStore: SettingsConfigStore): void {
  ipcMainLike.handle("settings:load", () => configStore.load());
  ipcMainLike.handle("settings:save", (_event, settings) => configStore.save(settings as AppSettings));
  ipcMainLike.handle("settings:clear", () => configStore.clear());
}

export function registerIpcHandlers(): void {
  const configStore = createConfigStore(getAppDataDir());
  registerSettingsIpcHandlers(ipcMain, configStore);
}
