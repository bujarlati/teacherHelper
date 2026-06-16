import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AppSettings,
  TextbookCropRect,
  TextbookImageKind,
  TextbookIndexItem,
  TextbookRecord,
  TextbookSearchResult,
  TextbookSource
} from "../shared/types.js";
import type { EmbeddingContent } from "./siliconflowClient.js";

type EmbeddingClientLike = {
  createEmbedding(input: { apiKey: string; modelName: string; input: EmbeddingContent }): Promise<number[]>;
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
  sourceName?: string;
  sourceNames?: string[];
  items: TextbookIndexItem[];
  settings: AppSettings;
  embeddingClient: EmbeddingClientLike;
  qdrantClient: QdrantClientLike;
  textbookStore: TextbookStoreLike;
  dataDir: string;
  now(): string;
  createPointId(): string;
};

type SourceStat = {
  name: string;
  pages: Set<number>;
  itemCount: number;
};

const upsertBatchSize = 24;

export async function indexTextbook(input: IndexTextbookInput): Promise<TextbookRecord> {
  if (input.items.length === 0) {
    throw new Error("Textbook index requires at least one page image.");
  }

  const collectionName = createTextbookCollectionName(input.settings.qdrant.collectionPrefix);
  const createdAt = input.now();
  const sourceDirectories = shouldUseSourceDirectories(input);
  const sourceStats = createInitialSourceStats(input);
  const savedItems: Array<{
    item: TextbookIndexItem;
    sourceName: string;
    sourcePageNumber: number;
    imagePath: string;
    vector: number[];
  }> = [];
  let cropIndex = 0;

  for (const item of input.items) {
    const sourceName = resolveItemSourceName(item, input);
    const sourcePageNumber = item.sourcePageNumber ?? item.pageNumber;
    const imagePath = createImagePath({
      dataDir: input.dataDir,
      textbookId: input.id,
      item,
      sourceName,
      sourcePageNumber,
      cropIndex: item.kind === "crop" ? ++cropIndex : cropIndex,
      sourceDirectories
    });
    await writeDataUrlImage(imagePath, item.imageDataUrl);
    const vector = await input.embeddingClient.createEmbedding({
      apiKey: input.settings.embeddingModel.apiKey,
      modelName: input.settings.embeddingModel.modelName,
      input: { image: item.imageDataUrl }
    });
    addSourceStat(sourceStats, sourceName, sourcePageNumber, item);
    savedItems.push({ item, sourceName, sourcePageNumber, imagePath, vector });
  }

  const vectorSize = savedItems[0]?.vector.length ?? 0;
  if (vectorSize === 0) {
    throw new Error("Embedding model returned an empty vector.");
  }

  await input.qdrantClient.ensureCollection({
    url: input.settings.qdrant.url,
    apiKey: input.settings.qdrant.apiKey,
    collectionName,
    vectorSize
  });
  const points = savedItems.map(({ item, sourceName, sourcePageNumber, imagePath, vector }) => ({
      id: input.createPointId(),
      vector,
      payload: {
        textbookId: input.id,
        title: input.title,
        sourceName,
        pageNumber: item.pageNumber,
        sourcePageNumber,
        kind: item.kind,
        imagePath,
        ...(item.cropRect ? { cropRect: item.cropRect } : {})
      }
    }));

  for (const batch of chunk(points, upsertBatchSize)) {
    await input.qdrantClient.upsertPoints({
      url: input.settings.qdrant.url,
      apiKey: input.settings.qdrant.apiKey,
      collectionName,
      points: batch
    });
  }

  const sources = sourceStatsToSources(sourceStats);
  const record: TextbookRecord = {
    id: input.id,
    title: input.title,
    sourceName: sources.map((source) => source.name).join(", "),
    sourceNames: sources.map((source) => source.name),
    sources,
    collectionName,
    pageCount: sources.reduce((total, source) => total + source.pageCount, 0),
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
      ...(typeof payload.sourcePageNumber === "number" ? { sourcePageNumber: payload.sourcePageNumber } : {}),
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
    throw new Error("Textbook image must be a PNG data URL.");
  }

  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, Buffer.from(match[1], "base64"));
}

function formatPageNumber(value: number): string {
  return String(value).padStart(3, "0");
}

function shouldUseSourceDirectories(input: IndexTextbookInput): boolean {
  return (input.sourceNames?.length ?? 0) > 1 || input.items.some((item) => !!item.sourceName);
}

function createImagePath(input: {
  dataDir: string;
  textbookId: string;
  item: TextbookIndexItem;
  sourceName: string;
  sourcePageNumber: number;
  cropIndex: number;
  sourceDirectories: boolean;
}): string {
  const root = input.sourceDirectories
    ? join(input.dataDir, "textbooks", input.textbookId, "sources", safePathSegment(input.sourceName))
    : join(input.dataDir, "textbooks", input.textbookId);

  return input.item.kind === "page"
    ? join(root, "pages", `page-${formatPageNumber(input.sourcePageNumber)}.png`)
    : join(
      root,
      "crops",
      `page-${formatPageNumber(input.sourcePageNumber)}-crop-${formatPageNumber(input.cropIndex)}.png`
    );
}

function resolveItemSourceName(item: TextbookIndexItem, input: IndexTextbookInput): string {
  const sourceName = item.sourceName ?? input.sourceName ?? input.sourceNames?.[0];
  if (!sourceName) {
    throw new Error("Textbook index requires a PDF source name.");
  }

  return sourceName;
}

function createInitialSourceStats(input: IndexTextbookInput): Map<string, SourceStat> {
  const stats = new Map<string, SourceStat>();
  for (const sourceName of input.sourceNames ?? (input.sourceName ? [input.sourceName] : [])) {
    ensureSourceStat(stats, sourceName);
  }

  return stats;
}

function addSourceStat(
  stats: Map<string, SourceStat>,
  sourceName: string,
  sourcePageNumber: number,
  item: TextbookIndexItem
): void {
  const stat = ensureSourceStat(stats, sourceName);
  stat.itemCount += 1;
  if (item.kind === "page") {
    stat.pages.add(sourcePageNumber);
  }
}

function ensureSourceStat(stats: Map<string, SourceStat>, sourceName: string): SourceStat {
  const existing = stats.get(sourceName);
  if (existing) {
    return existing;
  }

  const stat = { name: sourceName, pages: new Set<number>(), itemCount: 0 };
  stats.set(sourceName, stat);
  return stat;
}

function sourceStatsToSources(stats: Map<string, SourceStat>): TextbookSource[] {
  return Array.from(stats.values()).map((source) => ({
    name: source.name,
    pageCount: source.pages.size,
    itemCount: source.itemCount
  }));
}

function safePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "source";
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Qdrant search result is missing ${field}.`);
  }

  return value;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== "number") {
    throw new Error(`Qdrant search result is missing ${field}.`);
  }

  return value;
}

function readKind(value: unknown): TextbookImageKind {
  if (value !== "page" && value !== "crop") {
    throw new Error("Qdrant search result is missing kind.");
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
