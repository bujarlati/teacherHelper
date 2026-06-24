import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

type DownloadVideoFileInput = {
  dataDir: string;
  outputDir?: string;
  videoId: string;
  videoUrl: string;
  fetchImpl?: typeof fetch;
};

const knownVideoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);

export async function downloadVideoFile(input: DownloadVideoFileInput): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(input.videoUrl);

  if (!response.ok) {
    throw new Error(`视频下载失败：HTTP ${response.status}`);
  }

  const videosDir = input.outputDir?.trim() || join(input.dataDir, "videos");
  await mkdir(videosDir, { recursive: true });

  const extension = inferVideoExtension(input.videoUrl, response.headers.get("content-type"));
  const filePath = join(videosDir, `${safeFileName(input.videoId)}${extension}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);

  return filePath;
}

function inferVideoExtension(videoUrl: string, contentType: string | null): string {
  try {
    const extension = extname(new URL(videoUrl).pathname).toLowerCase();
    if (knownVideoExtensions.has(extension)) {
      return extension;
    }
  } catch {
    // Fall through to content-type based inference.
  }

  if (contentType?.includes("webm")) return ".webm";
  if (contentType?.includes("quicktime")) return ".mov";
  if (contentType?.includes("mp4")) return ".mp4";

  return ".mp4";
}

function safeFileName(value: string): string {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .slice(0, 120);

  return safe || "video";
}
