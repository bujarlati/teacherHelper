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
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ResponseFormat = {
  type: "json_object";
};

type ChatCompletionInput = {
  apiKey: string;
  modelName: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
  thinkingBudget?: number;
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
  const timeoutMs = options.timeoutMs ?? 120_000;

  async function requestJson(path: string, apiKey: string, init: RequestInit): Promise<unknown> {
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
        throw new Error("硅基流动请求超时，请检查网络、API Key、模型名或稍后重试。");
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
    }): Promise<string> {
      const data = await requestJson("/video/submit", input.apiKey, {
        method: "POST",
        body: JSON.stringify({
          model: input.modelName,
          prompt: input.prompt,
          image_size: input.imageSize ?? "1280x720"
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
