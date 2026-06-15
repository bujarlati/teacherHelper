import { appSettingsSchema } from "../src/shared/schemas.js";
import type { AppSettings } from "../src/shared/types.js";

export type SettingsConfigStore = {
  load(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
  clear(): Promise<void>;
};

export type IpcMainLike = {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
};

export function registerSettingsIpcHandlers(ipcMainLike: IpcMainLike, configStore: SettingsConfigStore): void {
  ipcMainLike.handle("settings:load", () => configStore.load());
  ipcMainLike.handle("settings:save", async (_event, settings) => configStore.save(appSettingsSchema.parse(settings)));
  ipcMainLike.handle("settings:clear", () => configStore.clear());
}
