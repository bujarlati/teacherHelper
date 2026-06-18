import { EventEmitter } from "node:events";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createLocalQdrantManager } from "../../src/main/localQdrantManager";
import type { AppSettings } from "../../src/shared/types";

class FakeChildProcess extends EventEmitter {
  pid = 4321;
  kill = vi.fn().mockReturnValue(true);
  unref = vi.fn();
}

function responseOk(): Response {
  return {
    ok: true,
    json: async () => ({ result: { collections: [] } })
  } as Response;
}

const settings: AppSettings = {
  textModel: { apiKey: "text-key", modelName: "text-model" },
  videoModel: { apiKey: "video-key", modelName: "video-model" },
  imageModel: { apiKey: "image-key", modelName: "Tongyi-MAI/Z-Image" },
  embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
  rerankerModel: { apiKey: "rerank-key", modelName: "Qwen/Qwen3-VL-Reranker-8B" },
  qdrant: { mode: "local", url: "http://127.0.0.1:6333", apiKey: "", collectionPrefix: "teacherhelper" }
};

describe("createLocalQdrantManager", () => {
  it("returns remote status and does not probe or spawn when qdrant mode is remote", async () => {
    const fetchMock = vi.fn();
    const spawnMock = vi.fn();
    const manager = createLocalQdrantManager({
      dataDir: "D:\\teacherHelper-data",
      fetchImpl: fetchMock as unknown as typeof fetch,
      spawnImpl: spawnMock,
      accessImpl: vi.fn(),
      mkdirImpl: vi.fn(),
      binaryPaths: ["D:\\app\\resources\\qdrant\\qdrant.exe"]
    });

    await expect(
      manager.ensureRunning({
        ...settings,
        qdrant: {
          mode: "remote",
          url: "https://cluster.example.qdrant.io",
          apiKey: "qdrant-key",
          collectionPrefix: "teacherhelper"
        }
      })
    ).resolves.toMatchObject({
      mode: "remote",
      status: "remote",
      url: "https://cluster.example.qdrant.io"
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("uses an already-running local qdrant without spawning another process", async () => {
    const fetchMock = vi.fn().mockResolvedValue(responseOk());
    const spawnMock = vi.fn();
    const manager = createLocalQdrantManager({
      dataDir: "D:\\teacherHelper-data",
      fetchImpl: fetchMock as unknown as typeof fetch,
      spawnImpl: spawnMock,
      accessImpl: vi.fn(),
      mkdirImpl: vi.fn(),
      binaryPaths: ["D:\\app\\resources\\qdrant\\qdrant.exe"]
    });

    await expect(manager.ensureRunning(settings)).resolves.toMatchObject({
      mode: "local",
      status: "running",
      url: "http://127.0.0.1:6333",
      managed: false
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:6333/collections",
      expect.objectContaining({ method: "GET" })
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports a missing bundled binary when local qdrant is not running and no candidate exists", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    const manager = createLocalQdrantManager({
      dataDir: "D:\\teacherHelper-data",
      fetchImpl: fetchMock as unknown as typeof fetch,
      spawnImpl: vi.fn(),
      accessImpl: vi.fn().mockRejectedValue(new Error("missing")),
      mkdirImpl: vi.fn(),
      binaryPaths: ["D:\\app\\resources\\qdrant\\qdrant.exe"]
    });

    await expect(manager.ensureRunning(settings)).resolves.toMatchObject({
      mode: "local",
      status: "missing",
      url: "http://127.0.0.1:6333",
      message: expect.stringContaining("未找到内置 Qdrant")
    });
  });

  it("starts the bundled qdrant binary with local storage paths and waits until it responds", async () => {
    const child = new FakeChildProcess();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("starting"))
      .mockResolvedValue(responseOk());
    const spawnMock = vi.fn().mockReturnValue(child);
    const mkdirMock = vi.fn().mockResolvedValue(undefined);
    const dataDir = "D:\\teacherHelper-data";
    const binaryPath = "D:\\teacherHelper\\resources\\qdrant\\qdrant.exe";
    const manager = createLocalQdrantManager({
      dataDir,
      fetchImpl: fetchMock as unknown as typeof fetch,
      spawnImpl: spawnMock,
      accessImpl: vi.fn().mockResolvedValue(undefined),
      mkdirImpl: mkdirMock,
      binaryPaths: [binaryPath],
      pollIntervalMs: 1,
      startupTimeoutMs: 50
    });

    await expect(manager.ensureRunning(settings)).resolves.toMatchObject({
      mode: "local",
      status: "running",
      url: "http://127.0.0.1:6333",
      binaryPath,
      pid: 4321,
      managed: true,
      storagePath: join(dataDir, "qdrant", "storage")
    });
    expect(mkdirMock).toHaveBeenCalledWith(join(dataDir, "qdrant", "storage"), { recursive: true });
    expect(mkdirMock).toHaveBeenCalledWith(join(dataDir, "qdrant", "snapshots"), { recursive: true });
    expect(spawnMock).toHaveBeenCalledWith(
      binaryPath,
      [],
      expect.objectContaining({
        windowsHide: true,
        env: expect.objectContaining({
          QDRANT__SERVICE__HOST: "127.0.0.1",
          QDRANT__SERVICE__HTTP_PORT: "6333",
          QDRANT__STORAGE__STORAGE_PATH: join(dataDir, "qdrant", "storage"),
          QDRANT__STORAGE__SNAPSHOTS_PATH: join(dataDir, "qdrant", "snapshots")
        })
      })
    );
    expect(child.unref).toHaveBeenCalledTimes(1);
  });
});
