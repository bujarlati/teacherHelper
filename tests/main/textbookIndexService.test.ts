import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { indexTextbook, searchTextbookIndex } from "../../src/main/textbookIndexService";
import type { AppSettings, TextbookIndexItem } from "../../src/shared/types";

const settings: AppSettings = {
  textModel: { apiKey: "text-key", modelName: "text-model" },
  videoModel: { apiKey: "video-key", modelName: "video-model" },
  embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
  qdrant: { mode: "local", url: "http://127.0.0.1:6333", apiKey: "", collectionPrefix: "teacherhelper" }
};

const pngDataUrl = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("textbookIndexService", () => {
  it("saves textbook images, embeds them, upserts vectors, and records the textbook", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-index-"));
    const items: TextbookIndexItem[] = [
      { kind: "page", pageNumber: 1, imageDataUrl: pngDataUrl },
      { kind: "crop", pageNumber: 1, imageDataUrl: pngDataUrl, cropRect: { x: 0, y: 0, width: 500, height: 400 } }
    ];
    const embeddingClient = {
      createEmbedding: vi.fn()
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockResolvedValueOnce([0.4, 0.5, 0.6])
    };
    const qdrantClient = {
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsertPoints: vi.fn().mockResolvedValue(undefined)
    };
    const textbookStore = {
      upsert: vi.fn().mockResolvedValue(undefined)
    };

    const record = await indexTextbook({
      id: "book-1",
      title: "七年级数学",
      sourceName: "local.pdf",
      items,
      settings,
      embeddingClient,
      qdrantClient,
      textbookStore,
      dataDir: tempDir,
      now: () => "2026-06-15T03:04:05.000Z",
      createPointId: vi.fn()
        .mockReturnValueOnce("point-page-1")
        .mockReturnValueOnce("point-crop-1")
    });

    expect(record).toMatchObject({
      id: "book-1",
      title: "七年级数学",
      collectionName: "teacherhelper_textbook_visual",
      pageCount: 1,
      itemCount: 2,
      status: "indexed"
    });
    await expect(readFile(join(tempDir, "textbooks", "book-1", "pages", "page-001.png"))).resolves.toEqual(
      Buffer.from("png-bytes")
    );
    await expect(readFile(join(tempDir, "textbooks", "book-1", "crops", "page-001-crop-001.png"))).resolves.toEqual(
      Buffer.from("png-bytes")
    );
    expect(embeddingClient.createEmbedding).toHaveBeenCalledWith({
      apiKey: "embedding-key",
      modelName: "Qwen/Qwen3-VL-Embedding-8B",
      input: pngDataUrl
    });
    expect(qdrantClient.ensureCollection).toHaveBeenCalledWith({
      url: "http://127.0.0.1:6333",
      apiKey: "",
      collectionName: "teacherhelper_textbook_visual",
      vectorSize: 3
    });
    expect(qdrantClient.upsertPoints).toHaveBeenCalledWith({
      url: "http://127.0.0.1:6333",
      apiKey: "",
      collectionName: "teacherhelper_textbook_visual",
      points: expect.arrayContaining([
        expect.objectContaining({
          id: "point-page-1",
          vector: [0.1, 0.2, 0.3],
          payload: expect.objectContaining({
            textbookId: "book-1",
            title: "七年级数学",
            sourceName: "local.pdf",
            pageNumber: 1,
            kind: "page",
            imagePath: join(tempDir, "textbooks", "book-1", "pages", "page-001.png")
          })
        }),
        expect.objectContaining({
          id: "point-crop-1",
          vector: [0.4, 0.5, 0.6],
          payload: expect.objectContaining({
            kind: "crop",
            cropRect: { x: 0, y: 0, width: 500, height: 400 }
          })
        })
      ])
    });
    expect(textbookStore.upsert).toHaveBeenCalledWith(record);
  });

  it("searches textbook vectors from a Chinese question", async () => {
    const embeddingClient = {
      createEmbedding: vi.fn().mockResolvedValue([0.7, 0.8])
    };
    const qdrantClient = {
      searchPoints: vi.fn().mockResolvedValue([{
        id: "point-1",
        score: 0.91,
        payload: {
          textbookId: "book-1",
          title: "七年级数学",
          sourceName: "local.pdf",
          pageNumber: 3,
          kind: "page",
          imagePath: "D:\\teacherHelper-data\\textbooks\\book-1\\pages\\page-003.png"
        }
      }])
    };

    await expect(searchTextbookIndex({
      query: "一次函数图像怎么讲？",
      settings,
      embeddingClient,
      qdrantClient,
      limit: 4
    })).resolves.toEqual([{
      id: "point-1",
      score: 0.91,
      textbookId: "book-1",
      title: "七年级数学",
      sourceName: "local.pdf",
      pageNumber: 3,
      kind: "page",
      imagePath: "D:\\teacherHelper-data\\textbooks\\book-1\\pages\\page-003.png"
    }]);
  });
});
