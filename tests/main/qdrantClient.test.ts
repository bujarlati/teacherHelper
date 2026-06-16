import { describe, expect, it, vi } from "vitest";
import { createQdrantClient } from "../../src/main/qdrantClient";

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data
  } as Response;
}

function errorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body
  } as Response;
}

describe("createQdrantClient", () => {
  it("tests the collections endpoint with optional api key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: { collections: [] } }));
    const client = createQdrantClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(
      client.testConnection({ url: "http://localhost:6333/", apiKey: "qdrant-key" })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections",
      expect.objectContaining({
        method: "GET",
        headers: { "api-key": "qdrant-key" }
      })
    );
  });

  it("omits the api key header when qdrant is local without auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: { collections: [] } }));
    const client = createQdrantClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await client.testConnection({ url: "http://localhost:6333", apiKey: " " });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections",
      expect.objectContaining({
        headers: {}
      })
    );
  });

  it("throws a readable error on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401, "unauthorized"));
    const client = createQdrantClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.testConnection({ url: "http://localhost:6333", apiKey: "bad" })).rejects.toThrow(
      "Qdrant request failed: 401 unauthorized"
    );
  });
});
