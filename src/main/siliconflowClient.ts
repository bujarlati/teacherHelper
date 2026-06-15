import { videoStatusSchema } from "../shared/schemas.js";
import type { VideoTaskStatus } from "../shared/types.js";

type FetchImpl = typeof fetch;

type ClientOptions = {
  fetchImpl?: FetchImpl;
  baseUrl?: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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

  async function requestJson<T>(path: string, apiKey: string, init: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SiliconFlow request failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    async chatCompletion(input: { apiKey: string; modelName: string; messages: ChatMessage[] }): Promise<string> {
      const data = await requestJson<{ choices: Array<{ message: { content: string } }> }>(
        "/chat/completions",
        input.apiKey,
        {
          method: "POST",
          body: JSON.stringify({ model: input.modelName, messages: input.messages })
        }
      );

      return data.choices[0]?.message.content ?? "";
    },

    async listModels(input: { apiKey: string; type?: "text" | "video" }): Promise<Array<{ id: string }>> {
      const query = input.type ? `?type=${encodeURIComponent(input.type)}` : "";
      const data = await requestJson<{ data: Array<{ id: string }> }>(`/models${query}`, input.apiKey, {
        method: "GET"
      });

      return data.data;
    },

    async submitVideo(input: {
      apiKey: string;
      modelName: string;
      prompt: string;
      imageSize?: string;
    }): Promise<string> {
      const data = await requestJson<{ requestId: string }>("/video/submit", input.apiKey, {
        method: "POST",
        body: JSON.stringify({
          model: input.modelName,
          prompt: input.prompt,
          image_size: input.imageSize ?? "1280x720"
        })
      });

      return data.requestId;
    },

    async getVideoStatus(input: { apiKey: string; requestId: string }): Promise<VideoStatusResult> {
      const data = await requestJson<{
        status: string;
        reason?: string;
        results?: { videos?: Array<{ url: string }>; seed?: number; timings?: { inference?: number } };
      }>("/video/status", input.apiKey, {
        method: "POST",
        body: JSON.stringify({ requestId: input.requestId })
      });

      const result: VideoStatusResult = {
        status: videoStatusSchema.parse(data.status)
      };

      if (data.reason !== undefined) result.reason = data.reason;
      if (data.results?.videos?.[0]?.url !== undefined) result.videoUrl = data.results.videos[0].url;
      if (data.results?.seed !== undefined) result.seed = data.results.seed;
      if (data.results?.timings?.inference !== undefined) result.inferenceMs = data.results.timings.inference;

      return result;
    }
  };
}
