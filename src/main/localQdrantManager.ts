import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultQdrantUrl } from "../shared/schemas.js";
import type { AppSettings, LocalQdrantStatus } from "../shared/types.js";

type FetchImpl = typeof fetch;

type ChildProcessLike = {
  pid?: number;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: "exit" | "error", listener: (...args: unknown[]) => void): unknown;
  unref?(): void;
};

type SpawnImpl = (command: string, args: string[], options: SpawnOptions) => ChildProcessLike;

type ManagerOptions = {
  dataDir: string;
  fetchImpl?: FetchImpl;
  spawnImpl?: SpawnImpl;
  accessImpl?: (path: string) => Promise<void>;
  mkdirImpl?: (path: string, options: { recursive: true }) => Promise<unknown>;
  binaryPaths?: string[];
  startupTimeoutMs?: number;
  pollIntervalMs?: number;
};

export function createLocalQdrantManager(options: ManagerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const spawnImpl = options.spawnImpl ?? (spawn as SpawnImpl);
  const accessImpl = options.accessImpl ?? access;
  const mkdirImpl = options.mkdirImpl ?? mkdir;
  const binaryPaths = options.binaryPaths ?? getDefaultQdrantBinaryPaths();
  const startupTimeoutMs = options.startupTimeoutMs ?? 15_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const storagePath = join(options.dataDir, "qdrant", "storage");
  const snapshotsPath = join(options.dataDir, "qdrant", "snapshots");

  let managedProcess: ChildProcessLike | undefined;
  let startingPromise: Promise<LocalQdrantStatus> | undefined;
  let currentStatus: LocalQdrantStatus = {
    mode: "local",
    status: "stopped",
    url: defaultQdrantUrl,
    storagePath
  };

  async function ensureRunning(settings: AppSettings): Promise<LocalQdrantStatus> {
    const url = normalizeLocalUrl(settings.qdrant.url);
    if (settings.qdrant.mode === "remote") {
      currentStatus = {
        mode: "remote",
        status: "remote",
        url: settings.qdrant.url.trim()
      };
      return currentStatus;
    }

    if (await canConnect(fetchImpl, url)) {
      currentStatus = {
        mode: "local",
        status: "running",
        url,
        storagePath,
        managed: false
      };
      return currentStatus;
    }

    if (startingPromise) {
      return startingPromise;
    }

    startingPromise = startLocalProcess(url)
      .finally(() => {
        startingPromise = undefined;
      });

    return startingPromise;
  }

  async function startLocalProcess(url: string): Promise<LocalQdrantStatus> {
    const binaryPath = await findFirstExistingPath(binaryPaths, accessImpl);
    if (!binaryPath) {
      currentStatus = {
        mode: "local",
        status: "missing",
        url,
        storagePath,
        message: `未找到内置 Qdrant，请确认安装包包含 ${binaryPaths[0] ?? "qdrant.exe"}。`
      };
      return currentStatus;
    }

    await mkdirImpl(storagePath, { recursive: true });
    await mkdirImpl(snapshotsPath, { recursive: true });

    currentStatus = {
      mode: "local",
      status: "starting",
      url,
      storagePath,
      binaryPath,
      managed: true
    };

    const endpoint = parseEndpoint(url);

    try {
      const child = spawnImpl(binaryPath, [], {
        cwd: dirname(binaryPath),
        stdio: "ignore",
        windowsHide: true,
        env: {
          ...process.env,
          QDRANT__SERVICE__HOST: endpoint.host,
          QDRANT__SERVICE__HTTP_PORT: endpoint.port,
          QDRANT__STORAGE__STORAGE_PATH: storagePath,
          QDRANT__STORAGE__SNAPSHOTS_PATH: snapshotsPath
        }
      });
      managedProcess = child;
      child.unref?.();
      child.once("exit", () => {
        if (managedProcess === child) {
          currentStatus = { ...currentStatus, status: "stopped", managed: true };
          managedProcess = undefined;
        }
      });
      child.once("error", (error) => {
        if (managedProcess === child) {
          currentStatus = {
            ...currentStatus,
            status: "failed",
            managed: true,
            message: error instanceof Error ? error.message : "Qdrant 启动失败。"
          };
          managedProcess = undefined;
        }
      });
    } catch (error) {
      currentStatus = {
        mode: "local",
        status: "failed",
        url,
        storagePath,
        binaryPath,
        managed: true,
        message: error instanceof Error ? error.message : "Qdrant 启动失败。"
      };
      return currentStatus;
    }

    const started = await waitForConnection(fetchImpl, url, startupTimeoutMs, pollIntervalMs);
    if (!started) {
      currentStatus = {
        mode: "local",
        status: "failed",
        url,
        storagePath,
        binaryPath,
        pid: managedProcess?.pid,
        managed: true,
        message: "Qdrant 已启动但未在限定时间内响应。"
      };
      return currentStatus;
    }

    currentStatus = {
      mode: "local",
      status: "running",
      url,
      storagePath,
      binaryPath,
      pid: managedProcess?.pid,
      managed: true
    };
    return currentStatus;
  }

  async function stop(): Promise<void> {
    managedProcess?.kill();
    managedProcess = undefined;
    currentStatus = { ...currentStatus, status: "stopped" };
  }

  return {
    ensureRunning,
    getStatus: () => currentStatus,
    stop
  };
}

export function getDefaultQdrantBinaryPaths(): string[] {
  const executableName = process.platform === "win32" ? "qdrant.exe" : "qdrant";
  const processWithResources = process as NodeJS.Process & { resourcesPath?: string };
  const candidates: string[] = [];

  if (process.env.TEACHERHELPER_QDRANT_BINARY) {
    candidates.push(process.env.TEACHERHELPER_QDRANT_BINARY);
  }

  if (processWithResources.resourcesPath) {
    candidates.push(join(processWithResources.resourcesPath, "qdrant", executableName));
  }

  candidates.push(join(process.cwd(), "resources", "qdrant", executableName));
  candidates.push(join(process.cwd(), "vendor", "qdrant", executableName));

  return candidates;
}

async function findFirstExistingPath(
  paths: string[],
  accessImpl: (path: string) => Promise<void>
): Promise<string | undefined> {
  for (const path of paths) {
    try {
      await accessImpl(path);
      return path;
    } catch {
      // Keep checking other bundle locations.
    }
  }

  return undefined;
}

async function canConnect(fetchImpl: FetchImpl, url: string): Promise<boolean> {
  try {
    const response = await fetchImpl(`${url.replace(/\/$/, "")}/collections`, {
      method: "GET",
      headers: {}
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForConnection(
  fetchImpl: FetchImpl,
  url: string,
  timeoutMs: number,
  intervalMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await canConnect(fetchImpl, url)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

function normalizeLocalUrl(url: string): string {
  return url.trim() || defaultQdrantUrl;
}

function parseEndpoint(url: string): { host: string; port: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port || "6333"
    };
  } catch {
    return { host: "127.0.0.1", port: "6333" };
  }
}
