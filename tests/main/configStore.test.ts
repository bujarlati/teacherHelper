import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createConfigStore } from "../../src/main/configStore";

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
});
