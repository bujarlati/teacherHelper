import type { AppSettings, KnowledgeConnectionTestResult } from "../shared/types.js";

export type EmbeddingClientLike = {
  createEmbedding(input: { apiKey: string; modelName: string; input: string }): Promise<number[]>;
};

export type QdrantClientLike = {
  testConnection(input: { url: string; apiKey: string }): Promise<void>;
};

export async function testKnowledgeConnections(input: {
  settings: AppSettings;
  embeddingClient: EmbeddingClientLike;
  qdrantClient: QdrantClientLike;
}): Promise<KnowledgeConnectionTestResult> {
  const embeddingApiKey = input.settings.embeddingModel.apiKey.trim();
  const embeddingModelName = input.settings.embeddingModel.modelName.trim();
  const qdrantUrl = input.settings.qdrant.url.trim();

  if (!embeddingApiKey) {
    throw new Error("请先配置嵌入模型 API Key。");
  }

  if (!embeddingModelName) {
    throw new Error("请先配置嵌入模型名称。");
  }

  if (!qdrantUrl) {
    throw new Error("请先配置 Qdrant 地址。");
  }

  await input.embeddingClient.createEmbedding({
    apiKey: embeddingApiKey,
    modelName: embeddingModelName,
    input: "teacherHelper knowledge connection test"
  });
  await input.qdrantClient.testConnection({
    url: qdrantUrl,
    apiKey: input.settings.qdrant.apiKey
  });

  return { embedding: "ok", qdrant: "ok" };
}
