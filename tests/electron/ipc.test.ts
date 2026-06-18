import { describe, expect, it } from "vitest";
import { registerSettingsIpcHandlers } from "../../electron/settingsIpc";
import type { AppSettings } from "../../src/shared/types";

type Handler = (_event: unknown, ...args: unknown[]) => unknown;

function createFakeIpcMain() {
  const handlers = new Map<string, Handler>();

  return {
    handlers,
    handle(channel: string, handler: Handler) {
      handlers.set(channel, handler);
    }
  };
}

describe("registerSettingsIpcHandlers", () => {
  it("registers settings channels and delegates to the config store", async () => {
    const settings: AppSettings = {
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" },
      imageModel: { apiKey: "image-key", modelName: "Tongyi-MAI/Z-Image" },
      embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
      rerankerModel: { apiKey: "rerank-key", modelName: "Qwen/Qwen3-VL-Reranker-8B" },
      qdrant: {
        mode: "remote",
        url: "https://cluster.example.qdrant.io",
        apiKey: "qdrant-key",
        collectionPrefix: "teacherhelper"
      }
    };
    const calls: string[] = [];
    const fakeIpcMain = createFakeIpcMain();
    const fakeConfigStore = {
      async load() {
        calls.push("load");
        return settings;
      },
      async save(nextSettings: AppSettings) {
        calls.push(`save:${nextSettings.textModel.apiKey}`);
      },
      async clear() {
        calls.push("clear");
      }
    };

    registerSettingsIpcHandlers(fakeIpcMain, fakeConfigStore);

    expect([...fakeIpcMain.handlers.keys()]).toEqual([
      "settings:load",
      "settings:save",
      "settings:clear"
    ]);
    await expect(fakeIpcMain.handlers.get("settings:load")?.({})).resolves.toBe(settings);
    await expect(fakeIpcMain.handlers.get("settings:save")?.({}, settings)).resolves.toBeUndefined();
    await expect(fakeIpcMain.handlers.get("settings:clear")?.({})).resolves.toBeUndefined();
    expect(calls).toEqual(["load", "save:text-key", "clear"]);
  });

  it("rejects invalid settings without saving", async () => {
    const calls: string[] = [];
    const fakeIpcMain = createFakeIpcMain();
    const fakeConfigStore = {
      async load(): Promise<AppSettings> {
        throw new Error("not used");
      },
      async save(_nextSettings: AppSettings) {
        calls.push("save");
      },
      async clear() {
        throw new Error("not used");
      }
    };

    registerSettingsIpcHandlers(fakeIpcMain, fakeConfigStore);

    await expect(
      fakeIpcMain.handlers.get("settings:save")?.({}, { textModel: { apiKey: "text-key", modelName: "Qwen" } })
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
