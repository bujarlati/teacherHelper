import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { indexTextbook, searchTextbookIndex } from "../../src/main/textbookIndexService";
import type { AppSettings, TextbookIndexItem } from "../../src/shared/types";

const settings: AppSettings = {
  textModel: { apiKey: "text-key", modelName: "text-model" },
  videoModel: { apiKey: "video-key", modelName: "video-model" },
  embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
  rerankerModel: { apiKey: "rerank-key", modelName: "Qwen/Qwen3-VL-Reranker-8B" },
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
      input: { image: pngDataUrl }
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

  it("records one textbook library with multiple PDF sources", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-index-"));
    const items: TextbookIndexItem[] = [
      { kind: "page", pageNumber: 1, sourceName: "algebra.pdf", sourcePageNumber: 1, imageDataUrl: pngDataUrl },
      { kind: "page", pageNumber: 2, sourceName: "geometry.pdf", sourcePageNumber: 1, imageDataUrl: pngDataUrl },
      {
        kind: "crop",
        pageNumber: 2,
        sourceName: "geometry.pdf",
        sourcePageNumber: 1,
        imageDataUrl: pngDataUrl,
        cropRect: { x: 0, y: 0, width: 320, height: 240 }
      }
    ];
    const embeddingClient = {
      createEmbedding: vi.fn()
        .mockResolvedValueOnce([0.1, 0.2])
        .mockResolvedValueOnce([0.3, 0.4])
        .mockResolvedValueOnce([0.5, 0.6])
    };
    const qdrantClient = {
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsertPoints: vi.fn().mockResolvedValue(undefined)
    };
    const textbookStore = {
      upsert: vi.fn().mockResolvedValue(undefined)
    };

    const record = await indexTextbook({
      id: "library-1",
      title: "Grade 7 library",
      sourceNames: ["algebra.pdf", "geometry.pdf"],
      items,
      settings,
      embeddingClient,
      qdrantClient,
      textbookStore,
      dataDir: tempDir,
      now: () => "2026-06-15T03:04:05.000Z",
      createPointId: vi.fn()
        .mockReturnValueOnce("point-algebra-page")
        .mockReturnValueOnce("point-geometry-page")
        .mockReturnValueOnce("point-geometry-crop")
    });

    expect(record).toMatchObject({
      id: "library-1",
      title: "Grade 7 library",
      sourceName: "algebra.pdf, geometry.pdf",
      sourceNames: ["algebra.pdf", "geometry.pdf"],
      sources: [
        { name: "algebra.pdf", pageCount: 1, itemCount: 1 },
        { name: "geometry.pdf", pageCount: 1, itemCount: 2 }
      ],
      pageCount: 2,
      itemCount: 3,
      status: "indexed"
    });
    expect(qdrantClient.upsertPoints).toHaveBeenCalledWith(expect.objectContaining({
      points: expect.arrayContaining([
        expect.objectContaining({
          id: "point-geometry-page",
          payload: expect.objectContaining({
            textbookId: "library-1",
            sourceName: "geometry.pdf",
            sourcePageNumber: 1,
            pageNumber: 2
          })
        })
      ])
    }));
    await expect(readFile(join(tempDir, "textbooks", "library-1", "sources", "geometry_pdf", "pages", "page-001.png"))).resolves.toEqual(
      Buffer.from("png-bytes")
    );
  });

  it("upserts large textbook indexes in batches", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-index-"));
    const items: TextbookIndexItem[] = Array.from({ length: 25 }, (_, index) => ({
      kind: "page",
      pageNumber: index + 1,
      imageDataUrl: pngDataUrl
    }));
    const embeddingClient = {
      createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };
    const qdrantClient = {
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsertPoints: vi.fn().mockResolvedValue(undefined)
    };
    const textbookStore = {
      upsert: vi.fn().mockResolvedValue(undefined)
    };
    let pointIndex = 0;
    const createPointId = vi.fn(() => `point-${++pointIndex}`);

    await indexTextbook({
      id: "large-book",
      title: "Large textbook",
      sourceName: "large.pdf",
      items,
      settings,
      embeddingClient,
      qdrantClient,
      textbookStore,
      dataDir: tempDir,
      now: () => "2026-06-15T03:04:05.000Z",
      createPointId
    });

    expect(qdrantClient.upsertPoints).toHaveBeenCalledTimes(2);
    expect(qdrantClient.upsertPoints).toHaveBeenNthCalledWith(1, expect.objectContaining({
      points: expect.arrayContaining([
        expect.objectContaining({ id: "point-1" }),
        expect.objectContaining({ id: "point-24" })
      ])
    }));
    expect(qdrantClient.upsertPoints).toHaveBeenNthCalledWith(2, expect.objectContaining({
      points: [expect.objectContaining({ id: "point-25" })]
    }));
  });

  it("adds source and page context when image embedding fails", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-index-"));
    const items: TextbookIndexItem[] = [{
      kind: "crop",
      pageNumber: 7,
      sourceName: "math-volume.pdf",
      sourcePageNumber: 3,
      imageDataUrl: pngDataUrl,
      cropRect: { x: 0, y: 0, width: 320, height: 240 }
    }];
    const embeddingClient = {
      createEmbedding: vi.fn().mockRejectedValue(new Error("SiliconFlow request failed: 500 {\"data\":null}"))
    };
    const qdrantClient = {
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsertPoints: vi.fn().mockResolvedValue(undefined)
    };
    const textbookStore = {
      upsert: vi.fn().mockResolvedValue(undefined)
    };

    await expect(indexTextbook({
      id: "book-1",
      title: "七年级数学",
      sourceNames: ["math-volume.pdf"],
      items,
      settings,
      embeddingClient,
      qdrantClient,
      textbookStore,
      dataDir: tempDir,
      now: () => "2026-06-15T03:04:05.000Z",
      createPointId: vi.fn()
    })).rejects.toThrow("教材图片向量化失败：math-volume.pdf 第 3 页，局部切块。SiliconFlow request failed: 500 {\"data\":null}");
    expect(qdrantClient.ensureCollection).not.toHaveBeenCalled();
    expect(textbookStore.upsert).not.toHaveBeenCalled();
  });

  it("searches textbook vectors from a Chinese question", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-search-"));
    const imagePath = join(tempDir, "page-003.png");
    await writeFile(imagePath, Buffer.from("result-image"));
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
          imagePath
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
      rankingSource: "qdrant",
      textbookId: "book-1",
      title: "七年级数学",
      sourceName: "local.pdf",
      pageNumber: 3,
      kind: "page",
      imagePath,
      imageDataUrl: `data:image/png;base64,${Buffer.from("result-image").toString("base64")}`
    }]);
    expect(qdrantClient.searchPoints).toHaveBeenCalledWith(expect.objectContaining({
      limit: 12
    }));
  });

  it("reranks expanded textbook candidates with the configured reranker model", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-search-"));
    const firstImagePath = join(tempDir, "page-001.png");
    const secondImagePath = join(tempDir, "page-002.png");
    await writeFile(firstImagePath, Buffer.from("first-image"));
    await writeFile(secondImagePath, Buffer.from("second-image"));
    const embeddingClient = {
      createEmbedding: vi.fn().mockResolvedValue([0.7, 0.8]),
      rerank: vi.fn().mockResolvedValue([
        { index: 1, relevanceScore: 0.97 },
        { index: 0, relevanceScore: 0.54 }
      ])
    };
    const qdrantClient = {
      searchPoints: vi.fn().mockResolvedValue([
        {
          id: "point-1",
          score: 0.62,
          payload: {
            textbookId: "book-1",
            title: "七年级数学",
            sourceName: "local.pdf",
            pageNumber: 1,
            kind: "page",
            imagePath: firstImagePath
          }
        },
        {
          id: "point-2",
          score: 0.61,
          payload: {
            textbookId: "book-1",
            title: "七年级数学",
            sourceName: "local.pdf",
            pageNumber: 2,
            kind: "page",
            imagePath: secondImagePath
          }
        }
      ])
    };

    const results = await searchTextbookIndex({
      query: "一次函数图像怎么讲？",
      settings,
      embeddingClient,
      qdrantClient,
      limit: 2
    });

    expect(embeddingClient.rerank).toHaveBeenCalledWith({
      apiKey: "rerank-key",
      modelName: "Qwen/Qwen3-VL-Reranker-8B",
      query: "一次函数图像怎么讲？",
      topN: 2,
      instruction: expect.stringContaining("教材"),
      documents: [
        {
          text: expect.stringContaining("第 1 页"),
          image: `data:image/png;base64,${Buffer.from("first-image").toString("base64")}`
        },
        {
          text: expect.stringContaining("第 2 页"),
          image: `data:image/png;base64,${Buffer.from("second-image").toString("base64")}`
        }
      ]
    });
    expect(results.map((item) => item.id)).toEqual(["point-2", "point-1"]);
    expect(results[0]).toMatchObject({
      rerankScore: 0.97,
      rankingSource: "reranker",
      imageDataUrl: `data:image/png;base64,${Buffer.from("second-image").toString("base64")}`
    });
  });

  it("falls back to qdrant order when reranking fails", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-search-"));
    const imagePath = join(tempDir, "page-001.png");
    await writeFile(imagePath, Buffer.from("first-image"));
    const embeddingClient = {
      createEmbedding: vi.fn().mockResolvedValue([0.7, 0.8]),
      rerank: vi.fn().mockRejectedValue(new Error("rerank unavailable"))
    };
    const qdrantClient = {
      searchPoints: vi.fn().mockResolvedValue([{
        id: "point-1",
        score: 0.62,
        payload: {
          textbookId: "book-1",
          title: "七年级数学",
          sourceName: "local.pdf",
          pageNumber: 1,
          kind: "page",
          imagePath
        }
      }])
    };

    await expect(searchTextbookIndex({
      query: "一次函数",
      settings,
      embeddingClient,
      qdrantClient,
      limit: 1
    })).resolves.toEqual([expect.objectContaining({
      id: "point-1",
      rankingSource: "qdrant",
      rankingMessage: "重排序失败：rerank unavailable，已使用向量排序结果。",
      imageDataUrl: `data:image/png;base64,${Buffer.from("first-image").toString("base64")}`
    })]);
  });
});
