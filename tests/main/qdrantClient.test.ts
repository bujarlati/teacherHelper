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

function fetchResetError(): TypeError {
  return Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" })
  });
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

  it("throws a readable error when the local qdrant connection resets", async () => {
    const fetchMock = vi.fn().mockRejectedValue(fetchResetError());
    const client = createQdrantClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.upsertPoints({
      url: "http://localhost:6333",
      apiKey: "",
      collectionName: "teacherhelper_pages",
      points: [{ id: "point-1", vector: [0.1, 0.2], payload: { textbookId: "book-1" } }]
    })).rejects.toThrow("Qdrant 网络连接中断");
  });

  it("creates a collection when it does not exist", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(errorResponse(404, "not found"))
      .mockResolvedValueOnce(jsonResponse({ result: true }));
    const client = createQdrantClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(
      client.ensureCollection({
        url: "http://localhost:6333",
        apiKey: "",
        collectionName: "teacherhelper_pages",
        vectorSize: 4096
      })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:6333/collections/teacherhelper_pages",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:6333/collections/teacherhelper_pages",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          vectors: { size: 4096, distance: "Cosine" }
        })
      })
    );
  });

  it("upserts textbook vectors with payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: { operation_id: 1 } }));
    const client = createQdrantClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await client.upsertPoints({
      url: "http://localhost:6333",
      apiKey: "qdrant-key",
      collectionName: "teacherhelper_pages",
      points: [{
        id: "point-1",
        vector: [0.1, 0.2],
        payload: { textbookId: "book-1", pageNumber: 1, kind: "page" }
      }]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:6333/collections/teacherhelper_pages/points?wait=true",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "api-key": "qdrant-key" }),
        body: JSON.stringify({
          points: [{
            id: "point-1",
            vector: [0.1, 0.2],
            payload: { textbookId: "book-1", pageNumber: 1, kind: "page" }
          }]
        })
      })
    );
  });

  it("searches vectors and returns scored payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      result: [{
        id: "point-1",
        score: 0.92,
        payload: { textbookId: "book-1", pageNumber: 2, kind: "crop" }
      }]
    }));
    const client = createQdrantClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(client.searchPoints({
      url: "http://localhost:6333",
      apiKey: "",
      collectionName: "teacherhelper_pages",
      vector: [0.1, 0.2],
      limit: 5
    })).resolves.toEqual([{
      id: "point-1",
      score: 0.92,
      payload: { textbookId: "book-1", pageNumber: 2, kind: "crop" }
    }]);
  });
});
