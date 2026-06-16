import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type {
  TextbookResource,
  TextbookResourceCatalog,
  TextbookResourceFile,
  TextbookResourceSource
} from "../shared/types.js";

export const textbookDownloadUrl = "https://github.com/TapXWorld/ChinaTextbook";

type TextbookResourceServiceOptions = {
  dataDir: string;
  libraryDir?: string;
  resourceDirs?: string[];
  downloadUrl?: string;
};

export function createTextbookResourceService(options: TextbookResourceServiceOptions) {
  const libraryDir = options.libraryDir ?? join(options.dataDir, "textbook-pdfs");
  const resourceDirs = options.resourceDirs ?? getDefaultTextbookResourceDirs();
  const downloadUrl = options.downloadUrl ?? textbookDownloadUrl;

  async function getCatalog(): Promise<TextbookResourceCatalog> {
    await mkdir(libraryDir, { recursive: true });

    const resources = await listAllResources(libraryDir, resourceDirs);
    return {
      downloadUrl,
      libraryDir,
      resources
    };
  }

  async function readResource(id: string): Promise<TextbookResourceFile> {
    const catalog = await getCatalog();
    const resource = catalog.resources.find((item) => item.id === id.trim());
    if (!resource) {
      throw new Error("未找到教材资源。");
    }

    const data = await readFile(resource.absolutePath);
    return {
      resource,
      dataBase64: data.toString("base64")
    };
  }

  return {
    getCatalog,
    readResource
  };
}

export function getDefaultTextbookResourceDirs(): string[] {
  const processWithResources = process as NodeJS.Process & { resourcesPath?: string };
  const candidates: string[] = [];

  if (process.env.TEACHERHELPER_TEXTBOOKS_DIR) {
    candidates.push(process.env.TEACHERHELPER_TEXTBOOKS_DIR);
  }

  if (processWithResources.resourcesPath) {
    candidates.push(join(processWithResources.resourcesPath, "textbooks"));
  }

  candidates.push(join(process.cwd(), "resources", "textbooks"));

  return dedupePaths(candidates);
}

async function listAllResources(libraryDir: string, resourceDirs: string[]): Promise<TextbookResource[]> {
  const seen = new Set<string>();
  const libraryResources = await listDirectoryResources(libraryDir, "library", seen);
  const bundledResources: TextbookResource[] = [];

  for (const dir of resourceDirs) {
    bundledResources.push(...await listDirectoryResources(dir, "bundle", seen));
  }

  return [...libraryResources, ...bundledResources];
}

async function listDirectoryResources(
  rootDir: string,
  source: TextbookResourceSource,
  seen: Set<string>
): Promise<TextbookResource[]> {
  const filePaths = await collectPdfFiles(rootDir);
  const resources: TextbookResource[] = [];

  for (const filePath of filePaths) {
    const seenKey = normalizeKey(filePath);
    if (seen.has(seenKey)) {
      continue;
    }
    seen.add(seenKey);

    const fileStat = await stat(filePath);
    const relativePath = toPosixPath(relative(rootDir, filePath));
    resources.push({
      id: createResourceId(source, relativePath),
      title: titleFromFileName(filePath),
      fileName: basename(filePath),
      relativePath,
      absolutePath: filePath,
      source,
      sizeBytes: fileStat.size
    });
  }

  return resources.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-Hans-CN"));
}

async function collectPdfFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectPdfFiles(entryPath));
    } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function createResourceId(source: TextbookResourceSource, relativePath: string): string {
  return `${source}:${Buffer.from(relativePath, "utf8").toString("base64url")}`;
}

function titleFromFileName(filePath: string): string {
  const fileName = basename(filePath);
  const extension = extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function normalizeKey(path: string): string {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const path of paths) {
    const key = normalizeKey(path);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(path);
    }
  }

  return result;
}
