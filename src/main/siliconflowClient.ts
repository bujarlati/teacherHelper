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
  | { text?: string; image?: string; video?: string };

type ChatCompletionInput = {
  apiKey: string;
  modelName: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
  thinkingBudget?: number;
  reasoningEffort?: "high" | "max";
  timeoutMs?: number;
  stream?: boolean;
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

type ImageGenerationInput = {
  apiKey: string;
  modelName: string;
  prompt: string;
  imageSize?: string;
  negativePrompt?: string;
  seed?: number;
  batchSize?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
};

type ImageGenerationResult = {
  imageUrl: string;
  seed?: number;
  inferenceMs?: number;
};

type VideoStatusResult = {
  status: VideoTaskStatus;
  reason?: string;
  videoUrl?: string;
  seed?: number;
  inferenceMs?: number;
};

class SiliconFlowHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly retryAfterMs?: number,
    readonly traceId?: string
  ) {
    super(createHttpErrorMessage(status, body, traceId));
    this.name = "SiliconFlowHttpError";
  }
}

export function createSiliconFlowClient(options: ClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? "https://api.siliconflow.cn/v1").replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? 300_000;
  const retryDelayMs = options.retryDelayMs ?? 750;
  const maxAttempts = 3;
  const arkVideoBaseUrl = "https://ark.cn-beijing.volces.com/api/v3";

  async function requestJson(path: string, apiKey: string, init: RequestInit, requestTimeoutMs = timeoutMs): Promise<unknown> {
    let lastTransientError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await requestJsonOnce(path, apiKey, init, requestTimeoutMs);
      } catch (error) {
        const transientNetworkError = isTransientNetworkError(error);
        const transientHttpError = isTransientHttpError(error);
        if ((!transientNetworkError && !transientHttpError) || attempt === maxAttempts) {
          if (isTransientNetworkError(error)) {
            throw new Error(`SiliconFlow 网络请求中断，请稍后重试或检查网络/代理连接。原始错误：${getErrorMessage(error)}`);
          }
          if (isTransientHttpError(error)) {
            throw new Error(
              `硅基流动服务暂时不可用（HTTP ${error.status}），已重试 ${maxAttempts} 次。请稍后重试，或检查该模型当前是否可用。原始错误：${getErrorMessage(error)}`
            );
          }

          throw error;
        }

        lastTransientError = error;
        await delay(getRetryDelay(error, retryDelayMs * attempt));
      }
    }

    throw new Error(`SiliconFlow 网络请求中断，请稍后重试或检查网络/代理连接。原始错误：${getErrorMessage(lastTransientError)}`);
  }

  async function requestTextStream(path: string, apiKey: string, init: RequestInit, requestTimeoutMs = timeoutMs): Promise<string> {
    let lastTransientError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await requestTextStreamOnce(path, apiKey, init, requestTimeoutMs);
      } catch (error) {
        const transientNetworkError = isTransientNetworkError(error);
        const transientHttpError = isTransientHttpError(error);
        if ((!transientNetworkError && !transientHttpError) || attempt === maxAttempts) {
          if (isTransientNetworkError(error)) {
            throw new Error(`SiliconFlow 网络请求中断，请稍后重试或检查网络/代理连接。原始错误：${getErrorMessage(error)}`);
          }
          if (isTransientHttpError(error)) {
            throw new Error(
              `硅基流动服务暂时不可用（HTTP ${error.status}），已重试 ${maxAttempts} 次。请稍后重试，或检查该模型当前是否可用。原始错误：${getErrorMessage(error)}`
            );
          }

          throw error;
        }

        lastTransientError = error;
        await delay(getRetryDelay(error, retryDelayMs * attempt));
      }
    }

    throw new Error(`SiliconFlow 网络请求中断，请稍后重试或检查网络/代理连接。原始错误：${getErrorMessage(lastTransientError)}`);
  }

  async function requestJsonOnce(path: string, apiKey: string, init: RequestInit, requestTimeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, requestTimeoutMs);

    try {
      const requestUrl = createRequestUrl(baseUrl, path);
      const response = await fetchImpl(requestUrl, {
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
        throw new SiliconFlowHttpError(
          response.status,
          text,
          parseRetryAfterMs(response.headers.get("retry-after")),
          response.headers.get("x-siliconcloud-trace-id") ?? undefined
        );
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

  async function requestTextStreamOnce(path: string, apiKey: string, init: RequestInit, requestTimeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, requestTimeoutMs);

    try {
      const requestUrl = createRequestUrl(baseUrl, path);
      const response = await fetchImpl(requestUrl, {
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
        throw new SiliconFlowHttpError(
          response.status,
          text,
          parseRetryAfterMs(response.headers.get("retry-after")),
          response.headers.get("x-siliconcloud-trace-id") ?? undefined
        );
      }

      if (!response.body) {
        throw new Error("SiliconFlow returned invalid chat completion response");
      }

      return await readChatCompletionStream(response.body);
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
        stream: input.stream ?? false,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        response_format: input.responseFormat,
        thinking_budget: input.thinkingBudget,
        reasoning_effort: input.reasoningEffort ?? getDefaultReasoningEffort(input.modelName)
      };

      if (input.stream) {
        return requestTextStream("/chat/completions", input.apiKey, {
          method: "POST",
          body: JSON.stringify(body)
        }, input.timeoutMs);
      }

      const data = await requestJson("/chat/completions", input.apiKey, {
        method: "POST",
        body: JSON.stringify(body)
      }, input.timeoutMs);
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

    async createImage(input: ImageGenerationInput): Promise<ImageGenerationResult> {
      const body: Record<string, JsonValue | undefined> = {
        model: input.modelName,
        prompt: input.prompt,
        image_size: input.imageSize ?? "1024x1024",
        negative_prompt: input.negativePrompt,
        seed: input.seed,
        batch_size: input.batchSize,
        num_inference_steps: input.numInferenceSteps,
        guidance_scale: input.guidanceScale
      };

      const data = await requestJson("/images/generations", input.apiKey, {
        method: "POST",
        body: JSON.stringify(body)
      });

      const imageUrl = readString(data, ["images", 0, "url"]);
      if (!imageUrl) {
        throw new Error("SiliconFlow returned invalid image generation response");
      }

      const result: ImageGenerationResult = { imageUrl };
      const seed = readNumber(data, ["seed"]);
      const inferenceMs = readNumber(data, ["timings", "inference"]);
      if (seed !== undefined) result.seed = seed;
      if (inferenceMs !== undefined) result.inferenceMs = inferenceMs;

      return result;
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
      referenceVideo?: string;
      duration?: number;
    }): Promise<string> {
      if (isSeedanceModel(input.modelName)) {
        const data = await requestJson(`${arkVideoBaseUrl}/contents/generations/tasks`, input.apiKey, {
          method: "POST",
          body: JSON.stringify(createSeedanceSubmitBody(input))
        });
        const taskId = readString(data, ["id"]) ?? readString(data, ["task_id"]);
        if (!taskId) {
          throw new Error("Volcengine Ark returned invalid Seedance submit response");
        }

        return `ark:${taskId}`;
      }

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
      if (input.requestId.startsWith("ark:")) {
        const taskId = input.requestId.slice("ark:".length);
        const data = await requestJson(`${arkVideoBaseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`, input.apiKey, {
          method: "GET"
        });

        return parseSeedanceTaskStatus(data);
      }

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
      if (results !== undefined && results !== null) {
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

function getDefaultReasoningEffort(modelName: string): "max" | undefined {
  return /(?:^|\/)glm-5\.2(?:$|[-_/])/i.test(modelName) ? "max" : undefined;
}

function createRequestUrl(baseUrl: string, path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${baseUrl}${path}`;
}

function isSeedanceModel(modelName: string): boolean {
  return /(?:^|\/)doubao-seedance-|(?:^|\/)seedance-/i.test(modelName);
}

function createSeedanceSubmitBody(input: {
  modelName: string;
  prompt: string;
  imageSize?: string;
  image?: string;
  negativePrompt?: string;
  referenceVideo?: string;
  duration?: number;
}): Record<string, JsonValue | undefined> {
  const content: JsonValue[] = [{
    type: "text",
    text: input.negativePrompt?.trim()
      ? `${input.prompt}\n避免出现：${input.negativePrompt.trim()}`
      : input.prompt
  }];

  if (input.image?.trim()) {
    content.push({
      type: "image_url",
      image_url: { url: input.image.trim() },
      role: "reference_image"
    });
  }

  if (input.referenceVideo?.trim()) {
    content.push({
      type: "video_url",
      video_url: { url: input.referenceVideo.trim() },
      role: "reference_video"
    });
  }

  return {
    model: input.modelName,
    content,
    generate_audio: true,
    ratio: getSeedanceRatio(input.imageSize),
    duration: input.duration ?? 15,
    watermark: false
  };
}

function getSeedanceRatio(imageSize: string | undefined): string {
  if (!imageSize) return "16:9";

  const [widthText, heightText] = imageSize.split("x");
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return "16:9";
  }

  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.02) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.02) return "9:16";
  if (Math.abs(ratio - 1) < 0.02) return "1:1";
  if (Math.abs(ratio - 4 / 3) < 0.02) return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.02) return "3:4";
  if (Math.abs(ratio - 21 / 9) < 0.02) return "21:9";

  return "16:9";
}

function parseSeedanceTaskStatus(data: unknown): VideoStatusResult {
  if (!isRecord(data)) {
    throw new Error("Volcengine Ark returned invalid Seedance status response");
  }

  const rawStatus = typeof data.status === "string" ? data.status.toLowerCase() : undefined;
  if (!rawStatus) {
    throw new Error("Volcengine Ark returned invalid Seedance status response");
  }

  const status = mapSeedanceStatus(rawStatus);
  const result: VideoStatusResult = { status };
  const videoUrl = readString(data, ["content", "video_url"])
    ?? readString(data, ["data", "content", "video_url"])
    ?? readString(data, ["result_url"]);
  if (videoUrl) {
    result.videoUrl = videoUrl;
  }

  const reason = readString(data, ["error", "message"])
    ?? readString(data, ["message"])
    ?? (status === "Failed" ? `Seedance task ended with status: ${rawStatus}` : undefined);
  if (reason) {
    result.reason = reason;
  }

  return result;
}

function mapSeedanceStatus(status: string): VideoTaskStatus {
  if (status === "queued") return "InQueue";
  if (status === "running") return "InProgress";
  if (status === "succeeded") return "Succeed";
  if (status === "failed" || status === "expired" || status === "cancelled") return "Failed";

  throw new Error("Volcengine Ark returned invalid Seedance status response");
}

async function readChatCompletionStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const result = readChatCompletionStreamLine(line);
      if (result.done) {
        return content;
      }
      content += result.content;
    }
  }

  if (buffer.trim()) {
    const result = readChatCompletionStreamLine(buffer);
    content += result.content;
  }

  if (!content) {
    throw new Error("SiliconFlow returned invalid chat completion response");
  }

  return content;
}

function readChatCompletionStreamLine(line: string): { done: boolean; content: string } {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data:")) {
    return { done: false, content: "" };
  }

  const payload = trimmed.slice("data:".length).trim();
  if (payload === "[DONE]") {
    return { done: true, content: "" };
  }

  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    throw new Error("SiliconFlow returned invalid chat completion response");
  }

  const deltaContent = readString(data, ["choices", 0, "delta", "content"]);
  const messageContent = readString(data, ["choices", 0, "message", "content"]);

  return { done: false, content: deltaContent ?? messageContent ?? "" };
}

function createHttpErrorMessage(status: number, body: string, traceId?: string): string {
  const traceSuffix = traceId ? ` traceId=${traceId}` : "";
  return `SiliconFlow request failed: ${status} ${body}${traceSuffix}`;
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

function readNumber(value: unknown, path: Array<string | number>): number | undefined {
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

  return typeof current === "number" ? current : undefined;
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

function isTransientHttpError(error: unknown): error is SiliconFlowHttpError {
  return error instanceof SiliconFlowHttpError
    && (error.status === 429 || error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504);
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) {
    return undefined;
  }

  return Math.max(0, dateMs - Date.now());
}

function getRetryDelay(error: unknown, fallbackMs: number): number {
  if (error instanceof SiliconFlowHttpError && typeof error.retryAfterMs === "number") {
    return Math.max(error.retryAfterMs, fallbackMs);
  }

  return fallbackMs;
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
