import { ipcMain } from "electron";
import { createConfigStore } from "../src/main/configStore.js";
import { getAppDataDir } from "../src/main/paths.js";
import { registerSettingsIpcHandlers } from "./settingsIpc.js";

export function registerIpcHandlers(): void {
  const configStore = createConfigStore(getAppDataDir());
  registerSettingsIpcHandlers(ipcMain, configStore);
}
