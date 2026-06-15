import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

  test("blocks encoded path traversal outside the demo root", async ({ page }) => {
    const rootDir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-"));
    await writeFile(join(rootDir, "index.html"), "<!doctype html><html></html>", "utf8");
    const server = await startDemoServer(rootDir);

    try {
      const slashResponse = await page.goto(`${server.url}%2e%2e%2fpackage.json`);
      const backslashResponse = await page.goto(`${server.url}%2e%2e%5cpackage.json`);

      expect([403, 404]).toContain(slashResponse?.status());
      expect([403, 404]).toContain(backslashResponse?.status());
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
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
});
