import { readFile, realpath, stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { isAbsolute, relative, resolve } from "node:path";

type DemoServer = {
  url: string;
  close(): Promise<void>;
};

export async function startDemoServer(rootDir: string): Promise<DemoServer> {
  const root = await realpath(rootDir);
  const close = createCloseHandler();
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const filePath = resolveRequestedPath(root, requestUrl.pathname);

      if (!filePath) {
        sendText(response, 403, "Forbidden");
        return;
      }

      const file = await resolveServableFile(root, filePath);
      if (file.status === "forbidden") {
        sendText(response, 403, "Forbidden");
        return;
      }
      if (file.status === "not-found") {
        sendText(response, 404, "Not Found");
        return;
      }

      const content = await readFile(file.path);
      response.writeHead(200, {
        "Content-Type": contentTypeFor(file.path),
        "Content-Length": content.byteLength
      });
      response.end(content);
    } catch (error) {
      if (isNotFound(error)) {
        sendText(response, 404, "Not Found");
        return;
      }

      sendText(response, 400, "Bad Request");
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("demo server did not bind to a TCP port");
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => close(server)
  };
}

function resolveRequestedPath(root: string, pathname: string): string | null {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPathname.includes("\0")) {
    return null;
  }

  const requestedPath = decodedPathname === "/" ? "index.html" : decodedPathname.replace(/^\/+/, "");
  if (requestedPath.split(/[\\/]+/).includes("..")) {
    return null;
  }

  const filePath = resolve(root, requestedPath);
  const rootRelativePath = relative(root, filePath);
  if (rootRelativePath.startsWith("..") || isAbsolute(rootRelativePath)) {
    return null;
  }

  return filePath;
}

async function resolveServableFile(
  root: string,
  filePath: string
): Promise<{ status: "ok"; path: string } | { status: "forbidden" } | { status: "not-found" }> {
  let fileStats: Awaited<ReturnType<typeof stat>>;
  let realFilePath: string;
  try {
    fileStats = await stat(filePath);
    realFilePath = await realpath(filePath);
  } catch (error) {
    if (isNotFound(error)) {
      return { status: "not-found" };
    }

    throw error;
  }

  if (!isPathInside(root, realFilePath)) {
    return { status: "forbidden" };
  }

  if (!fileStats.isFile()) {
    return { status: "not-found" };
  }

  return { status: "ok", path: realFilePath };
}

function isPathInside(root: string, candidate: string): boolean {
  const rootRelativePath = relative(root, candidate);
  return rootRelativePath === "" || (!rootRelativePath.startsWith("..") && !isAbsolute(rootRelativePath));
}

function contentTypeFor(filePath: string): string {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith(".html")) return "text/html; charset=utf-8";
  if (lowerPath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (lowerPath.endsWith(".css")) return "text/css; charset=utf-8";

  return "application/octet-stream";
}

function sendText(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function createCloseHandler(): (server: ReturnType<typeof createServer>) => Promise<void> {
  let closePromise: Promise<void> | undefined;

  return (server) => {
    closePromise ??= closeServer(server);
    return closePromise;
  };
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (isServerNotRunning(error)) {
        resolveClose();
        return;
      }
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });
}

function isServerNotRunning(error: Error | undefined): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ERR_SERVER_NOT_RUNNING"
  );
}
