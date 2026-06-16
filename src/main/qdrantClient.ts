type FetchImpl = typeof fetch;

type ClientOptions = {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
};

type QdrantPoint = {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
};

type QdrantSearchResult = {
  id: string;
  score: number;
  payload: Record<string, unknown>;
};

export function createQdrantClient(options: ClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function request(input: {
    url: string;
    apiKey: string;
    path: string;
    init: RequestInit;
    allowNotFound?: boolean;
  }): Promise<Response> {
    const baseUrl = input.url.trim().replace(/\/$/, "");
    if (!baseUrl) {
      throw new Error("Qdrant 地址不能为空。");
    }

    const apiKey = input.apiKey.trim();
    const headers: Record<string, string> = {
      ...(input.init.body ? { "Content-Type": "application/json" } : {}),
      ...(apiKey ? { "api-key": apiKey } : {}),
      ...(input.init.headers as Record<string, string> | undefined)
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(`${baseUrl}${input.path}`, {
        ...input.init,
        signal: controller.signal,
        headers
      });

      if (input.allowNotFound && response.status === 404) {
        return response;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Qdrant request failed: ${response.status} ${text}`);
      }

      return response;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Qdrant 请求超时，请检查地址、网络或本地服务是否启动。");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function requestJson(input: {
    url: string;
    apiKey: string;
    path: string;
    init: RequestInit;
  }): Promise<unknown> {
    const response = await request(input);

    try {
      return await response.json();
    } catch {
      throw new Error("Qdrant returned invalid JSON");
    }
  }

  return {
    async testConnection(input: { url: string; apiKey: string }): Promise<void> {
      const data = await requestJson({
        ...input,
        path: "/collections",
        init: {
          method: "GET",
          headers: input.apiKey.trim() ? undefined : {}
        }
      });

      if (typeof data !== "object" || data === null) {
        throw new Error("Qdrant returned invalid JSON");
      }
    },

    async ensureCollection(input: {
      url: string;
      apiKey: string;
      collectionName: string;
      vectorSize: number;
    }): Promise<void> {
      const encodedCollectionName = encodeURIComponent(input.collectionName);
      const existing = await request({
        url: input.url,
        apiKey: input.apiKey,
        path: `/collections/${encodedCollectionName}`,
        init: { method: "GET" },
        allowNotFound: true
      });

      if (existing.ok) {
        return;
      }

      await requestJson({
        url: input.url,
        apiKey: input.apiKey,
        path: `/collections/${encodedCollectionName}`,
        init: {
          method: "PUT",
          body: JSON.stringify({
            vectors: { size: input.vectorSize, distance: "Cosine" }
          })
        }
      });
    },

    async upsertPoints(input: {
      url: string;
      apiKey: string;
      collectionName: string;
      points: QdrantPoint[];
    }): Promise<void> {
      await requestJson({
        url: input.url,
        apiKey: input.apiKey,
        path: `/collections/${encodeURIComponent(input.collectionName)}/points?wait=true`,
        init: {
          method: "PUT",
          body: JSON.stringify({ points: input.points })
        }
      });
    },

    async searchPoints(input: {
      url: string;
      apiKey: string;
      collectionName: string;
      vector: number[];
      limit: number;
    }): Promise<QdrantSearchResult[]> {
      const data = await requestJson({
        url: input.url,
        apiKey: input.apiKey,
        path: `/collections/${encodeURIComponent(input.collectionName)}/points/search`,
        init: {
          method: "POST",
          body: JSON.stringify({
            vector: input.vector,
            limit: input.limit,
            with_payload: true
          })
        }
      });

      if (!isRecord(data) || !Array.isArray(data.result)) {
        throw new Error("Qdrant returned invalid search response");
      }

      return data.result.map((item) => {
        if (!isRecord(item) || typeof item.id !== "string" || typeof item.score !== "number" || !isRecord(item.payload)) {
          throw new Error("Qdrant returned invalid search response");
        }

        return {
          id: item.id,
          score: item.score,
          payload: item.payload
        };
      });
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
