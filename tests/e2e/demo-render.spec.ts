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
      const response = await page.goto(new URL("%2e%2e/package.json", server.url).toString());

      expect([403, 404]).toContain(response?.status());
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
