import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { startDemoServer } from "../../src/main/demo/demoServer";

test.describe("startDemoServer", () => {
  test("serves a generated index page from the root URL", async ({ page }) => {
    const rootDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-"));
    await writeFile(
      join(rootDir, "index.html"),
      "<!doctype html><html><body><button>开始</button></body></html>",
      "utf8"
    );
    const server = await startDemoServer(rootDir);

    try {
      const response = await page.goto(server.url);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("returns not found for missing files", async ({ page }) => {
    const rootDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-"));
    await writeFile(join(rootDir, "index.html"), "<!doctype html><html></html>", "utf8");
    const server = await startDemoServer(rootDir);

    try {
      const response = await page.goto(new URL("missing.css", server.url).toString());

      expect(response?.status()).toBe(404);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("returns not found for directory requests", async ({ page }) => {
    const rootDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-"));
    await mkdir(join(rootDir, "assets"));
    await writeFile(join(rootDir, "index.html"), "<!doctype html><html></html>", "utf8");
    const server = await startDemoServer(rootDir);

    try {
      const response = await page.goto(new URL("assets", server.url).toString());

      expect(response?.status()).toBe(404);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("blocks encoded path traversal outside the demo root", async ({ page }) => {
    const parentDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-parent-"));
    const rootDir = join(parentDir, "root");
    const sentinelName = "sentinel-package.json";
    const sentinelContent = "teacherhelper traversal sentinel";
    await mkdir(rootDir);
    await writeFile(join(rootDir, "index.html"), "<!doctype html><html></html>", "utf8");
    await writeFile(join(parentDir, sentinelName), sentinelContent, "utf8");
    const server = await startDemoServer(rootDir);

    try {
      const slashResponse = await page.goto(`${server.url}%2e%2e%2f${sentinelName}`);
      const slashBody = await page.textContent("body");
      const backslashResponse = await page.goto(`${server.url}%2e%2e%5c${sentinelName}`);
      const backslashBody = await page.textContent("body");

      expect(slashResponse?.status()).toBe(403);
      expect(slashBody).not.toContain(sentinelContent);
      expect(backslashResponse?.status()).toBe(403);
      expect(backslashBody).not.toContain(sentinelContent);
    } finally {
      await server.close();
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  test("blocks Windows absolute paths outside the demo root", async ({ page }) => {
    const rootDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-"));
    await writeFile(join(rootDir, "index.html"), "<!doctype html><html></html>", "utf8");
    const server = await startDemoServer(rootDir);

    try {
      const encodedDriveResponse = await page.goto(`${server.url}%43%3a/Windows/win.ini`);
      const driveResponse = await page.goto(`${server.url}C:/Windows/win.ini`);

      expect([403, 404]).toContain(encodedDriveResponse?.status());
      expect([403, 404]).toContain(driveResponse?.status());
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("blocks symlink escapes outside the demo root", async ({ page }) => {
    const parentDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-parent-"));
    const rootDir = join(parentDir, "root");
    const outsideDir = join(parentDir, "outside");
    const sentinelContent = "teacherhelper symlink sentinel";
    await mkdir(rootDir);
    await mkdir(outsideDir);
    await writeFile(join(rootDir, "index.html"), "<!doctype html><html></html>", "utf8");
    await writeFile(join(outsideDir, "secret.html"), sentinelContent, "utf8");

    try {
      await symlink(outsideDir, join(rootDir, "linked"), "junction");
    } catch (error) {
      await rm(parentDir, { recursive: true, force: true });
      test.skip(true, `Unable to create symlink or junction: ${String(error)}`);
    }

    const server = await startDemoServer(rootDir);

    try {
      const response = await page.goto(new URL("linked/secret.html", server.url).toString());
      const body = await page.textContent("body");

      expect(response?.status()).toBe(403);
      expect(body).not.toContain(sentinelContent);
    } finally {
      await server.close();
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  test("allows close to be called more than once", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-"));
    await writeFile(join(rootDir, "index.html"), "<!doctype html><html></html>", "utf8");
    const server = await startDemoServer(rootDir);

    try {
      await server.close();
      await expect(server.close()).resolves.toBeUndefined();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
