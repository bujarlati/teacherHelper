import { videoStatusSchema } from "../shared/schemas.js";
import type { VideoTaskStatus } from "../shared/types.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

type FetchImpl = typeof fetch;

type ClientOptions = {
  fetchImpl?: FetchImpl;
  baseUrl?: string;
  timeoutMs?: number;
  retryDelayMs?: number;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ResponseFormat = {
  type: "json_object";
};

export type EmbeddingContent =
  | string
  | { text: string }
  | { image: string }
  | Array<string | { text: string } | { image: string }>;

export type RerankDocument =
  | string
  | { text?: string; image?: string; video?: string }
  | Array<{ text?: string; image?: string; video?: string }>;

type ChatCompletionInput = {
  apiKey: string;
  modelName: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
  thinkingBudget?: number;
};

type EmbeddingInput = {
  apiKey: string;
  modelName: string;
  input: EmbeddingContent;
  dimensions?: number;
};

type RerankInput = {
  apiKey: string;
  modelName: string;
  query: string;
  documents: RerankDocument[];
  topN: number;
  instruction?: string;
};

type VideoStatusResult = {
  status: VideoTaskStatus;
  reason?: string;
  videoUrl?: string;
  seed?: number;
  inferenceMs?: number;
};

export function createSiliconFlowClient(options: ClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? 300_000;
  const retryDelayMs = options.retryDelayMs ?? 750;
  const maxAttempts = 3;

  async function requestJson(path: string, apiKey: string, init: RequestInit): Promise<unknown> {
    let lastNetworkError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await requestJsonOnce(path, apiKey, init);
      } catch (error) {
        if (!isTransientNetworkError(error) || attempt === maxAttempts) {
          if (isTransientNetworkError(error)) {
            throw new Error(`SiliconFlow 网络请求中断，请稍后重试或检查网络/代理连接。原始错误：${getErrorMessage(error)}`);
          }

          throw error;
        }

        lastNetworkError = error;
        await delay(retryDelayMs * attempt);
      }
    }

    throw new Error(`SiliconFlow 网络请求中断，请稍后重试或检查网络/代理连接。原始错误：${getErrorMessage(lastNetworkError)}`);
  }

  async function requestJsonOnce(path: string, apiKey: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`SiliconFlow request failed: ${response.status} ${text}`);
      }

      try {
        return await response.json();
      } catch {
        throw new Error("SiliconFlow returned invalid JSON");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("硅基流动请求超时，请检查网络、API Key、模型名，或换用响应更快的文本模型后重试。");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async chatCompletion(input: ChatCompletionInput): Promise<string> {
      const body: Record<string, JsonValue | undefined> = {
        model: input.modelName,
        messages: input.messages,
        stream: false,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        response_format: input.responseFormat,
        thinking_budget: input.thinkingBudget
      };

      const data = await requestJson("/chat/completions", input.apiKey, {
        method: "POST",
        body: JSON.stringify(body)
      });
      const content = readString(data, ["choices", 0, "message", "content"]);
      if (!content) {
        throw new Error("SiliconFlow returned invalid chat completion response");
      }

      return content;
    },

    async createEmbedding(input: EmbeddingInput): Promise<number[]> {
      const body: Record<string, JsonValue | undefined> = {
        model: input.modelName,
        input: input.input,
        encoding_format: "float",
        dimensions: input.dimensions
      };

      const data = await requestJson("/embeddings", input.apiKey, {
        method: "POST",
        body: JSON.stringify(body)
      });
      const embedding = readNumberArray(data, ["data", 0, "embedding"]);
      if (!embedding || embedding.length === 0) {
        throw new Error("SiliconFlow returned invalid embedding response");
      }

      return embedding;
    },

    async rerank(input: RerankInput): Promise<Array<{ index: number; relevanceScore: number }>> {
      const body: Record<string, JsonValue | undefined> = {
        model: input.modelName,
        query: input.query,
        documents: input.documents as JsonValue[],
        instruction: input.instruction,
        top_n: input.topN,
        return_documents: false
      };

      const data = await requestJson("/rerank", input.apiKey, {
        method: "POST",
        body: JSON.stringify(body)
      });

      if (!isRecord(data) || !Array.isArray(data.results)) {
        throw new Error("SiliconFlow returned invalid rerank response");
      }

      const results: Array<{ index: number; relevanceScore: number }> = [];
      for (const item of data.results) {
        if (!isRecord(item) || typeof item.index !== "number" || typeof item.relevance_score !== "number") {
          throw new Error("SiliconFlow returned invalid rerank response");
        }
        results.push({ index: item.index, relevanceScore: item.relevance_score });
      }

      return results;
    },

    async listModels(input: { apiKey: string; type?: "text" | "video" }): Promise<Array<{ id: string }>> {
      const query = input.type ? `?type=${encodeURIComponent(input.type)}` : "";
      const data = await requestJson(`/models${query}`, input.apiKey, {
        method: "GET"
      });

      if (!isRecord(data) || !Array.isArray(data.data)) {
        throw new Error("SiliconFlow returned invalid models response");
      }

      const models: Array<{ id: string }> = [];
      for (const item of data.data) {
        if (!isRecord(item) || typeof item.id !== "string" || item.id.length === 0) {
          throw new Error("SiliconFlow returned invalid models response");
        }
        models.push({ id: item.id });
      }

      return models;
    },

    async submitVideo(input: {
      apiKey: string;
      modelName: string;
      prompt: string;
      imageSize?: string;
      image?: string;
      negativePrompt?: string;
    }): Promise<string> {
      const data = await requestJson("/video/submit", input.apiKey, {
        method: "POST",
        body: JSON.stringify({
          model: input.modelName,
          prompt: input.prompt,
          image_size: input.imageSize ?? "1280x720",
          image: input.image,
          negative_prompt: input.negativePrompt
        })
      });

      const requestId = readString(data, ["requestId"]);
      if (!requestId) {
        throw new Error("SiliconFlow returned invalid video submit response");
      }

      return requestId;
    },

    async getVideoStatus(input: { apiKey: string; requestId: string }): Promise<VideoStatusResult> {
      const data = await requestJson("/video/status", input.apiKey, {
        method: "POST",
        body: JSON.stringify({ requestId: input.requestId })
      });

      if (!isRecord(data)) {
        throw new Error("SiliconFlow returned invalid video status response");
      }

      const parsedStatus = videoStatusSchema.safeParse(data.status);
      if (!parsedStatus.success) {
        throw new Error("SiliconFlow returned invalid video status response");
      }

      const result: VideoStatusResult = { status: parsedStatus.data };

      if (data.reason !== undefined) {
        if (typeof data.reason !== "string") throw new Error("SiliconFlow returned invalid video status response");
        result.reason = data.reason;
      }

      const results = data.results;
      if (results !== undefined) {
        if (!isRecord(results)) throw new Error("SiliconFlow returned invalid video status response");

        if (results.videos !== undefined) {
          if (!Array.isArray(results.videos)) throw new Error("SiliconFlow returned invalid video status response");
          const firstVideo = results.videos[0];
          if (firstVideo !== undefined) {
            const videoUrl = readString(firstVideo, ["url"]);
            if (!videoUrl) throw new Error("SiliconFlow returned invalid video status response");
            result.videoUrl = videoUrl;
          }
        }

        if (results.seed !== undefined) {
          if (typeof results.seed !== "number") throw new Error("SiliconFlow returned invalid video status response");
          result.seed = results.seed;
        }

        const timings = results.timings;
        if (timings !== undefined) {
          if (!isRecord(timings)) throw new Error("SiliconFlow returned invalid video status response");
          if (timings.inference !== undefined) {
            if (typeof timings.inference !== "number") {
              throw new Error("SiliconFlow returned invalid video status response");
            }
            result.inferenceMs = timings.inference;
          }
        }
      }

      return result;
    }
  };
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, path: Array<string | number>): string | undefined {
  let current: unknown = value;

  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
      continue;
    }

    if (!isRecord(current)) return undefined;
    current = current[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function readNumberArray(value: unknown, path: Array<string | number>): number[] | undefined {
  let current: unknown = value;

  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
      continue;
    }

    if (!isRecord(current)) return undefined;
    current = current[segment];
  }

  return Array.isArray(current) && current.every((item) => typeof item === "number")
    ? current
    : undefined;
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode = typeof cause === "object" && cause !== null && "code" in cause
    ? String((cause as { code?: unknown }).code)
    : "";

  return error.message === "fetch failed"
    || causeCode === "ECONNRESET"
    || causeCode === "ECONNREFUSED"
    || causeCode === "ETIMEDOUT"
    || causeCode === "ENOTFOUND";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}
