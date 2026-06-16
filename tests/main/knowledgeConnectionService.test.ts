import { describe, expect, it, vi } from "vitest";
import { testKnowledgeConnections } from "../../src/main/knowledgeConnectionService";
import type { AppSettings } from "../../src/shared/types";

const settings: AppSettings = {
  textModel: { apiKey: "text-key", modelName: "text-model" },
  videoModel: { apiKey: "video-key", modelName: "video-model" },
  embeddingModel: { apiKey: "embedding-key", modelName: "Qwen/Qwen3-VL-Embedding-8B" },
  qdrant: { mode: "remote", url: "https://cluster.example.qdrant.io", apiKey: "qdrant-key", collectionPrefix: "teacherhelper" }
};

describe("testKnowledgeConnections", () => {
  it("tests embedding and qdrant connections from settings", async () => {
    const embeddingClient = {
      createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2])
    };
    const qdrantClient = {
      testConnection: vi.fn().mockResolvedValue(undefined)
    };

    await expect(testKnowledgeConnections({ settings, embeddingClient, qdrantClient })).resolves.toEqual({
      embedding: "ok",
      qdrant: "ok"
    });

    expect(embeddingClient.createEmbedding).toHaveBeenCalledWith({
      apiKey: "embedding-key",
      modelName: "Qwen/Qwen3-VL-Embedding-8B",
      input: "teacherHelper knowledge connection test"
    });
    expect(qdrantClient.testConnection).toHaveBeenCalledWith({
      url: "https://cluster.example.qdrant.io",
      apiKey: "qdrant-key"
    });
  });

  it("rejects missing embedding model api key before network calls", async () => {
    const embeddingClient = { createEmbedding: vi.fn() };
    const qdrantClient = { testConnection: vi.fn() };

    await expect(
      testKnowledgeConnections({
        settings: { ...settings, embeddingModel: { ...settings.embeddingModel, apiKey: " " } },
        embeddingClient,
        qdrantClient
      })
    ).rejects.toThrow("请先配置嵌入模型 API Key。");

    expect(embeddingClient.createEmbedding).not.toHaveBeenCalled();
    expect(qdrantClient.testConnection).not.toHaveBeenCalled();
  });
});
