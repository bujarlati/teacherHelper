import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTextbookResourceService } from "../../src/main/textbookResourceService";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = join(tmpdir(), `teacherhelper-textbook-resources-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("createTextbookResourceService", () => {
  it("lists user-downloaded and bundled PDF resources with a download URL", async () => {
    const dataDir = join(tmpDir, "data");
    const bundledDir = join(tmpDir, "resources", "textbooks");

    await mkdir(join(dataDir, "textbook-pdfs", "初中"), { recursive: true });
    await mkdir(join(bundledDir, "小学"), { recursive: true });
    await writeFile(join(dataDir, "textbook-pdfs", "初中", "七年级数学.pdf"), "PDF");
    await writeFile(join(dataDir, "textbook-pdfs", "notes.txt"), "ignore");
    await writeFile(join(bundledDir, "小学", "四年级数学.PDF"), "PDF");

    const service = createTextbookResourceService({ dataDir, resourceDirs: [bundledDir] });

    const catalog = await service.getCatalog();

    expect(catalog.downloadUrl).toBe("https://github.com/TapXWorld/ChinaTextbook");
    expect(catalog.libraryDir).toBe(join(dataDir, "textbook-pdfs"));
    expect(catalog.resources).toMatchObject([
      {
        title: "七年级数学",
        fileName: "七年级数学.pdf",
        relativePath: "初中/七年级数学.pdf",
        source: "library",
        sizeBytes: 3
      },
      {
        title: "四年级数学",
        fileName: "四年级数学.PDF",
        relativePath: "小学/四年级数学.PDF",
        source: "bundle",
        sizeBytes: 3
      }
    ]);
  });

  it("reads a listed PDF resource and rejects unknown resource IDs", async () => {
    const dataDir = join(tmpDir, "data");
    await mkdir(join(dataDir, "textbook-pdfs"), { recursive: true });
    await writeFile(join(dataDir, "textbook-pdfs", "八年级数学.pdf"), "%PDF-user");

    const service = createTextbookResourceService({ dataDir, resourceDirs: [] });
    const catalog = await service.getCatalog();

    const result = await service.readResource(catalog.resources[0].id);

    expect(result.resource).toMatchObject({
      title: "八年级数学",
      fileName: "八年级数学.pdf",
      source: "library"
    });
    expect(Buffer.from(result.dataBase64, "base64").toString("utf8")).toBe("%PDF-user");
    await expect(service.readResource("missing")).rejects.toThrow("未找到教材资源。");
  });
});
