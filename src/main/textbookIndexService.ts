import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AppSettings,
  TextbookCropRect,
  TextbookImageKind,
  TextbookIndexItem,
  TextbookRecord,
  TextbookSearchResult
} from "../shared/types.js";

type EmbeddingClientLike = {
  createEmbedding(input: { apiKey: string; modelName: string; input: string }): Promise<number[]>;
};

type QdrantClientLike = {
  ensureCollection(input: {
    url: string;
    apiKey: string;
    collectionName: string;
    vectorSize: number;
  }): Promise<void>;
  upsertPoints(input: {
    url: string;
    apiKey: string;
    collectionName: string;
    points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>;
  }): Promise<void>;
};

type QdrantSearchClientLike = {
  searchPoints(input: {
    url: string;
    apiKey: string;
    collectionName: string;
    vector: number[];
    limit: number;
  }): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>>;
};

type TextbookStoreLike = {
  upsert(record: TextbookRecord): Promise<void>;
};

type IndexTextbookInput = {
  id: string;
  title: string;
  sourceName: string;
  items: TextbookIndexItem[];
  settings: AppSettings;
  embeddingClient: EmbeddingClientLike;
  qdrantClient: QdrantClientLike;
  textbookStore: TextbookStoreLike;
  dataDir: string;
  now(): string;
  createPointId(): string;
};

export async function indexTextbook(input: IndexTextbookInput): Promise<TextbookRecord> {
  if (input.items.length === 0) {
    throw new Error("教材索引至少需要一页图片。");
  }

  const collectionName = createTextbookCollectionName(input.settings.qdrant.collectionPrefix);
  const createdAt = input.now();
  const pageNumbers = new Set(input.items.map((item) => item.pageNumber));
  const savedItems: Array<{
    item: TextbookIndexItem;
    imagePath: string;
    vector: number[];
  }> = [];
  let cropIndex = 0;

  for (const item of input.items) {
    const imagePath = item.kind === "page"
      ? join(input.dataDir, "textbooks", input.id, "pages", `page-${formatPageNumber(item.pageNumber)}.png`)
      : join(input.dataDir, "textbooks", input.id, "crops", `page-${formatPageNumber(item.pageNumber)}-crop-${formatPageNumber(++cropIndex)}.png`);
    await writeDataUrlImage(imagePath, item.imageDataUrl);
    const vector = await input.embeddingClient.createEmbedding({
      apiKey: input.settings.embeddingModel.apiKey,
      modelName: input.settings.embeddingModel.modelName,
      input: item.imageDataUrl
    });
    savedItems.push({ item, imagePath, vector });
  }

  const vectorSize = savedItems[0]?.vector.length ?? 0;
  if (vectorSize === 0) {
    throw new Error("嵌入模型返回了空向量。");
  }

  await input.qdrantClient.ensureCollection({
    url: input.settings.qdrant.url,
    apiKey: input.settings.qdrant.apiKey,
    collectionName,
    vectorSize
  });
  await input.qdrantClient.upsertPoints({
    url: input.settings.qdrant.url,
    apiKey: input.settings.qdrant.apiKey,
    collectionName,
    points: savedItems.map(({ item, imagePath, vector }) => ({
      id: input.createPointId(),
      vector,
      payload: {
        textbookId: input.id,
        title: input.title,
        sourceName: input.sourceName,
        pageNumber: item.pageNumber,
        kind: item.kind,
        imagePath,
        ...(item.cropRect ? { cropRect: item.cropRect } : {})
      }
    }))
  });

  const record: TextbookRecord = {
    id: input.id,
    title: input.title,
    sourceName: input.sourceName,
    collectionName,
    pageCount: pageNumbers.size,
    itemCount: input.items.length,
    status: "indexed",
    createdAt,
    updatedAt: createdAt
  };
  await input.textbookStore.upsert(record);

  return record;
}

export async function searchTextbookIndex(input: {
  query: string;
  settings: AppSettings;
  embeddingClient: EmbeddingClientLike;
  qdrantClient: QdrantSearchClientLike;
  limit: number;
}): Promise<TextbookSearchResult[]> {
  const vector = await input.embeddingClient.createEmbedding({
    apiKey: input.settings.embeddingModel.apiKey,
    modelName: input.settings.embeddingModel.modelName,
    input: input.query
  });
  const results = await input.qdrantClient.searchPoints({
    url: input.settings.qdrant.url,
    apiKey: input.settings.qdrant.apiKey,
    collectionName: createTextbookCollectionName(input.settings.qdrant.collectionPrefix),
    vector,
    limit: input.limit
  });

  return results.map((result) => {
    const payload = result.payload;
    return {
      id: result.id,
      score: result.score,
      textbookId: readString(payload.textbookId, "textbookId"),
      title: readString(payload.title, "title"),
      sourceName: readString(payload.sourceName, "sourceName"),
      pageNumber: readNumber(payload.pageNumber, "pageNumber"),
      kind: readKind(payload.kind),
      imagePath: readString(payload.imagePath, "imagePath"),
      ...(isCropRect(payload.cropRect) ? { cropRect: payload.cropRect } : {})
    };
  });
}

export function createTextbookCollectionName(prefix: string): string {
  const safePrefix = prefix.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "teacherhelper";
  return `${safePrefix}_textbook_visual`;
}

async function writeDataUrlImage(filePath: string, dataUrl: string): Promise<void> {
  const match = /^data:image\/png;base64,(.+)$/u.exec(dataUrl);
  if (!match) {
    throw new Error("教材图片必须是 PNG data URL。");
  }

  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, Buffer.from(match[1], "base64"));
}

function formatPageNumber(value: number): string {
  return String(value).padStart(3, "0");
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Qdrant 搜索结果缺少 ${field}。`);
  }

  return value;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== "number") {
    throw new Error(`Qdrant 搜索结果缺少 ${field}。`);
  }

  return value;
}

function readKind(value: unknown): TextbookImageKind {
  if (value !== "page" && value !== "crop") {
    throw new Error("Qdrant 搜索结果缺少 kind。");
  }

  return value;
}

function isCropRect(value: unknown): value is TextbookCropRect {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const rect = value as Partial<TextbookCropRect>;
  return typeof rect.x === "number"
    && typeof rect.y === "number"
    && typeof rect.width === "number"
    && typeof rect.height === "number";
}
