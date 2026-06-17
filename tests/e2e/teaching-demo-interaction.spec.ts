import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { renderTeachingDemoHtml } from "../../src/main/demo/renderTeachingDemo";
import { startDemoServer } from "../../src/main/demo/demoServer";

test("generated teaching courseware has working controls and no raw English prompt", async ({ page }) => {
  const rootDir = await mkdtemp(join(tmpdir(), "teacherhelper-courseware-"));
  const html = renderTeachingDemoHtml({
    title: "一次函数复习",
    prompt: "A classroom animation for y=kx+b with slope and intercept.",
    script: "观察 k 改变时图像如何转动。\n拖动 b 观察截距变化。\n判断斜率为正时图像的变化趋势。"
  });
  await writeFile(join(rootDir, "index.html"), html, "utf8");
  const server = await startDemoServer(rootDir);

  try {
    await page.goto(server.url);

    await expect(page.getByText("A classroom animation for y=kx+b with slope and intercept.")).toHaveCount(0);
    await expect(page.locator(".step-card.is-active")).toContainText("观察 k 改变时图像如何转动。");

    await page.locator("#next-step").click();
    await expect(page.locator(".step-card.is-active")).toContainText("拖动 b 观察截距变化。");

    const before = await page.locator("#function-line").evaluate((node) => node.getAttribute("y1"));
    await page.locator("#slope-slider").evaluate((node) => {
      const input = node as HTMLInputElement;
      input.value = "2";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const after = await page.locator("#function-line").evaluate((node) => node.getAttribute("y1"));
    expect(after).not.toBe(before);
  } finally {
    await server.close();
    await rm(rootDir, { recursive: true, force: true });
  }
});
