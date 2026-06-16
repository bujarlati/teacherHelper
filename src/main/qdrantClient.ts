type FetchImpl = typeof fetch;

type ClientOptions = {
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
};

export function createQdrantClient(options: ClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  return {
    async testConnection(input: { url: string; apiKey: string }): Promise<void> {
      const baseUrl = input.url.trim().replace(/\/$/, "");
      if (!baseUrl) {
        throw new Error("Qdrant 地址不能为空。");
      }

      const apiKey = input.apiKey.trim();
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetchImpl(`${baseUrl}/collections`, {
          method: "GET",
          signal: controller.signal,
          headers: apiKey ? { "api-key": apiKey } : {}
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Qdrant request failed: ${response.status} ${text}`);
        }

        try {
          const data = await response.json();
          if (typeof data !== "object" || data === null) {
            throw new Error("Qdrant returned invalid JSON");
          }
        } catch (error) {
          if (error instanceof Error && error.message === "Qdrant returned invalid JSON") {
            throw error;
          }
          throw new Error("Qdrant returned invalid JSON");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("Qdrant 请求超时，请检查地址、网络或本地服务是否启动。");
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
