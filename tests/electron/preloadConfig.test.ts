import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import electronViteConfig from "../../electron.vite.config";

describe("Electron preload build configuration", () => {
  it("builds preload as CommonJS for Electron sandbox compatibility", () => {
    const output = electronViteConfig.preload?.build?.rollupOptions?.output;

    expect(output).toMatchObject({
      format: "cjs",
      entryFileNames: "[name].cjs"
    });
  });

  it("loads the CommonJS preload bundle from BrowserWindow", async () => {
    const mainSource = await readFile(join(process.cwd(), "electron", "main.ts"), "utf8");

    expect(mainSource).toContain("../preload/preload.cjs");
  });
});
