import { describe, expect, it, vi } from "vitest";
import { createSiliconFlowClient } from "../../src/main/siliconflowClient";

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data
  } as Response;
}

function invalidJsonResponse(): Response {
  return {
    ok: true,
    json: async () => {
      throw new SyntaxError("Unexpected token");
    }
  } as unknown as Response;
}

function errorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body
  } as Response;
}

function fetchResetError(): TypeError {
  return Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" })
  });
}

describe("createSiliconFlowClient", () => {
  it("calls chat completions with POST JSON bearer auth and optional generation controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "{\"title\":\"ok\"}" } }]
      })
    );
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    const content = await client.chatCompletion({
      apiKey: "key",
      modelName: "Qwen/Qwen3-32B",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 4096,
      temperature: 0.4,
      responseFormat: { type: "json_object" },
      thinkingBudget: 64
    });

    expect(content).toBe("{\"title\":\"ok\"}");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.siliconflow.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer key"
        }),
        body: JSON.stringify({
          model: "Qwen/Qwen3-32B",
          messages: [{ role: "user", content: "hello" }],
          stream: false,
          max_tokens: 4096,
          temperature: 0.4,
          response_format: { type: "json_object" },
          thinking_budget: 64
        })
      })
    );
  });

  it("submits video and returns request id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-1" }));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(
      client.submitVideo({
        apiKey: "key",
        modelName: "Wan-AI/Wan2.2-T2V-A14B",
        prompt: "math animation",
        imageSize: "1024x576"
      })
    ).resolves.toBe("req-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.siliconflow.cn/v1/video/submit",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
        body: JSON.stringify({
          model: "Wan-AI/Wan2.2-T2V-A14B",
          prompt: "math animation",
          image_size: "1024x576"
        })
      })
    );
  });

  it("submits image-to-video options when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-image-1" }));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(
      client.submitVideo({
        apiKey: "key",
        modelName: "Wan-AI/Wan2.2-I2V-A14B",
        prompt: "animate this textbook diagram",
        imageSize: "960x960",
        image: "data:image/png;base64,AAA",
        negativePrompt: "blurry"
      })
    ).resolves.toBe("req-image-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.siliconflow.cn/v1/video/submit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "Wan-AI/Wan2.2-I2V-A14B",
          prompt: "animate this textbook diagram",
          image_size: "960x960",
          image: "data:image/png;base64,AAA",
          negative_prompt: "blurry"
        })
      })
    );
  });

  it("creates embeddings with POST JSON bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ embedding: [0.1, -0.2, 0.3] }]
      })
    );
    const client = createSiliconFlowClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "https://example.test/v1"
    });

    await expect(
      client.createEmbedding({
        apiKey: "key",
        modelName: "Qwen/Qwen3-VL-Embedding-8B",
        input: "一次函数"
      })
    ).resolves.toEqual([0.1, -0.2, 0.3]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer key"
        }),
        body: JSON.stringify({
          model: "Qwen/Qwen3-VL-Embedding-8B",
          input: "一次函数",
          encoding_format: "float"
        })
      })
    );
  });

  it("creates image embeddings with VL image content objects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ embedding: [0.4, 0.5, 0.6] }]
      })
    );
    const client = createSiliconFlowClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "https://example.test/v1"
    });

    await expect(
      client.createEmbedding({
        apiKey: "key",
        modelName: "Qwen/Qwen3-VL-Embedding-8B",
        input: { image: "data:image/png;base64,AAA" }
      })
    ).resolves.toEqual([0.4, 0.5, 0.6]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "Qwen/Qwen3-VL-Embedding-8B",
          input: { image: "data:image/png;base64,AAA" },
          encoding_format: "float"
        })
      })
    );
  });

  it("rejects invalid embedding responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ embedding: [] }] }));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(
      client.createEmbedding({ apiKey: "key", modelName: "Qwen/Qwen3-VL-Embedding-8B", input: "hello" })
    ).rejects.toThrow("SiliconFlow returned invalid embedding response");
  });

  it("creates rerank requests with multimodal documents", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          { index: 1, relevance_score: 0.93 },
          { index: 0, relevance_score: 0.81 }
        ]
      })
    );
    const client = createSiliconFlowClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "https://example.test/v1"
    });
    const documents = [
      [{ text: "七年级数学 第 1 页" }, { image: "data:image/png;base64,AAA" }],
      [{ text: "七年级数学 第 2 页" }, { image: "data:image/png;base64,BBB" }]
    ];

    await expect(client.rerank({
      apiKey: "key",
      modelName: "Qwen/Qwen3-VL-Reranker-8B",
      query: "一次函数图像怎么讲？",
      documents,
      topN: 2,
      instruction: "请根据老师的问题，将最相关的教材页面排在前面。"
    })).resolves.toEqual([
      { index: 1, relevanceScore: 0.93 },
      { index: 0, relevanceScore: 0.81 }
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/rerank",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer key"
        }),
        body: JSON.stringify({
          model: "Qwen/Qwen3-VL-Reranker-8B",
          query: "一次函数图像怎么讲？",
          documents,
          instruction: "请根据老师的问题，将最相关的教材页面排在前面。",
          top_n: 2,
          return_documents: false
        })
      })
    );
  });

  it("rejects invalid rerank responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [{ index: 0 }] }));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.rerank({
      apiKey: "key",
      modelName: "Qwen/Qwen3-VL-Reranker-8B",
      query: "一次函数",
      documents: ["page"],
      topN: 1
    })).rejects.toThrow("SiliconFlow returned invalid rerank response");
  });

  it("retries transient network resets before returning an embedding", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(fetchResetError())
      .mockResolvedValueOnce(jsonResponse({ data: [{ embedding: [0.1, 0.2] }] }));
    const client = createSiliconFlowClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      retryDelayMs: 0
    });

    await expect(
      client.createEmbedding({ apiKey: "key", modelName: "Qwen/Qwen3-VL-Embedding-8B", input: { image: "data:image/png;base64,AAA" } })
    ).resolves.toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a readable message after repeated transient network failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(fetchResetError());
    const client = createSiliconFlowClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      retryDelayMs: 0
    });

    await expect(
      client.createEmbedding({ apiKey: "key", modelName: "Qwen/Qwen3-VL-Embedding-8B", input: { image: "data:image/png;base64,AAA" } })
    ).rejects.toThrow("SiliconFlow 网络请求中断");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws a readable error on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401, "unauthorized"));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.listModels({ apiKey: "bad", type: "text" })).rejects.toThrow(
      "SiliconFlow request failed: 401 unauthorized"
    );
  });

  it("throws a readable error when a successful response has invalid JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(invalidJsonResponse());
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.chatCompletion({ apiKey: "key", modelName: "model", messages: [] })).rejects.toThrow(
      "SiliconFlow returned invalid JSON"
    );
  });

  it("aborts slow requests and returns a clear timeout error", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;

      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const client = createSiliconFlowClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 50
    });

    const request = client.chatCompletion({
      apiKey: "key",
      modelName: "model",
      messages: [{ role: "user", content: "hello" }]
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(50);
    const error = await request;

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("硅基流动请求超时，请检查网络、API Key、模型名，或换用响应更快的文本模型后重试。");
    expect(observedSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("keeps the default chat request alive beyond two minutes for slow reasoning models", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;

      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    const request = client.chatCompletion({
      apiKey: "key",
      modelName: "Pro/zai-org/GLM-5.1",
      messages: [{ role: "user", content: "hello" }]
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(120_000);

    expect(observedSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(180_000);
    const error = await request;

    expect(error).toBeInstanceOf(Error);
    expect(observedSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("rejects chat responses without first choice content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [] }));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.chatCompletion({ apiKey: "key", modelName: "model", messages: [] })).rejects.toThrow(
      "SiliconFlow returned invalid chat completion response"
    );
  });

  it("adds a text type query when listing models and returns model data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: "Qwen/Qwen3-32B" }]
      })
    );
    const client = createSiliconFlowClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "https://example.test/v1"
    });

    await expect(client.listModels({ apiKey: "key", type: "text" })).resolves.toEqual([
      { id: "Qwen/Qwen3-32B" }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/models?type=text",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer key" })
      })
    );
  });

  it("rejects model list responses without model data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: "not-an-array" }));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.listModels({ apiKey: "key", type: "text" })).rejects.toThrow(
      "SiliconFlow returned invalid models response"
    );
  });

  it("rejects video submit responses without a request id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(
      client.submitVideo({ apiKey: "key", modelName: "Wan-AI/Wan2.2-T2V-A14B", prompt: "math animation" })
    ).rejects.toThrow("SiliconFlow returned invalid video submit response");
  });

  it("parses a valid video status and first video URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "Succeed",
        results: {
          videos: [{ url: "https://cdn.example.test/video.mp4" }],
          seed: 42,
          timings: { inference: 1200 }
        }
      })
    );
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.getVideoStatus({ apiKey: "key", requestId: "req-1" })).resolves.toEqual({
      status: "Succeed",
      videoUrl: "https://cdn.example.test/video.mp4",
      seed: 42,
      inferenceMs: 1200
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.siliconflow.cn/v1/video/status",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ requestId: "req-1" })
      })
    );
  });

  it("rejects invalid video status through schema validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "Cancelled" }));
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.getVideoStatus({ apiKey: "key", requestId: "req-1" })).rejects.toThrow();
  });

  it("rejects video status responses with invalid video URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "Succeed",
        results: { videos: [{ url: "" }] }
      })
    );
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.getVideoStatus({ apiKey: "key", requestId: "req-1" })).rejects.toThrow(
      "SiliconFlow returned invalid video status response"
    );
  });

  it("rejects video status responses with non-number timing data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "Succeed",
        results: { timings: { inference: "slow" } }
      })
    );
    const client = createSiliconFlowClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.getVideoStatus({ apiKey: "key", requestId: "req-1" })).rejects.toThrow(
      "SiliconFlow returned invalid video status response"
    );
  });
});
