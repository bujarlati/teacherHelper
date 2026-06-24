import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadVideoFile } from "../../src/main/videoDownloadService";

let tmpDirs: string[] = [];

describe("downloadVideoFile", () => {
  afterEach(async () => {
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tmpDirs = [];
  });

  it("downloads a generated video into the local videos directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "teacherhelper-video-"));
    tmpDirs.push(dataDir);
    const bytes = Buffer.from("video-bytes");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "video/mp4" }),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    });

    const filePath = await downloadVideoFile({
      dataDir,
      videoId: "video 1",
      videoUrl: "https://cdn.example.test/generated.mp4?token=abc",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(filePath).toBe(join(dataDir, "videos", "video 1.mp4"));
    await expect(readFile(filePath, "utf8")).resolves.toBe("video-bytes");
    expect(fetchImpl).toHaveBeenCalledWith("https://cdn.example.test/generated.mp4?token=abc");
  });

  it("uses a safe mp4 filename when the video id contains path separators", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "teacherhelper-video-"));
    tmpDirs.push(dataDir);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/octet-stream" }),
      arrayBuffer: async () => new ArrayBuffer(0)
    });

    const filePath = await downloadVideoFile({
      dataDir,
      videoId: "lesson/video:1",
      videoUrl: "https://cdn.example.test/generated",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(filePath).toBe(join(dataDir, "videos", "lesson_video_1.mp4"));
  });

  it("downloads into a configured video output directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "teacherhelper-video-data-"));
    const outputDir = await mkdtemp(join(tmpdir(), "teacherhelper-video-output-"));
    tmpDirs.push(dataDir, outputDir);
    const bytes = Buffer.from("custom-video-bytes");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "video/mp4" }),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    });

    const filePath = await downloadVideoFile({
      dataDir,
      outputDir,
      videoId: "video custom",
      videoUrl: "https://cdn.example.test/custom.mp4",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(filePath).toBe(join(outputDir, "video custom.mp4"));
    await expect(readFile(filePath, "utf8")).resolves.toBe("custom-video-bytes");
  });
});
