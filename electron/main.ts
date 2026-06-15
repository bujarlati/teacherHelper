import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers } from "./ipc.js";

export async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    webPreferences: {
      preload: fileURLToPath(new URL("preload.js", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(fileURLToPath(new URL("../dist/index.html", import.meta.url)));
  }

  return window;
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
