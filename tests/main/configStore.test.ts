import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createConfigStore } from "../../src/main/configStore";
import type { AppSettings } from "../../src/shared/types";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("createConfigStore", () => {
  it("saves and loads local model settings", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);

    await store.save({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" }
    });

    await expect(store.load()).resolves.toEqual({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" }
    });
  });

  it("returns empty settings when no config exists", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);

    await expect(store.load()).resolves.toEqual({
      textModel: { apiKey: "", modelName: "" },
      videoModel: { apiKey: "", modelName: "" }
    });
  });

  it("rejects malformed settings JSON without resetting it", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);
    await writeFile(join(tempDir, "settings.json"), "{ invalid json", "utf-8");

    await expect(store.load()).rejects.toThrow(SyntaxError);
  });

  it("rejects schema-invalid settings JSON without resetting it", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);
    await writeFile(
      join(tempDir, "settings.json"),
      JSON.stringify({ textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" } }),
      "utf-8"
    );

    await expect(store.load()).rejects.toThrow();
  });

  it("rejects invalid settings input when saving", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);

    await expect(
      store.save({
        textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" }
      } as unknown as AppSettings)
    ).rejects.toThrow();
  });

  it("clears saved settings and loads defaults afterward", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);

    await store.save({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" }
    });
    await store.clear();

    await expect(store.load()).resolves.toEqual({
      textModel: { apiKey: "", modelName: "" },
      videoModel: { apiKey: "", modelName: "" }
    });
  });

  it("returns fresh empty settings for each missing config load", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);

    const firstLoad = await store.load();
    firstLoad.textModel.apiKey = "mutated";

    await expect(store.load()).resolves.toEqual({
      textModel: { apiKey: "", modelName: "" },
      videoModel: { apiKey: "", modelName: "" }
    });
  });
});
