import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";

const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    build: {
      outDir: "dist-electron/main",
      lib: {
        entry: resolve(configDir, "electron/main.ts")
      }
    }
  },
  preload: {
    build: {
      outDir: "dist-electron/preload",
      lib: {
        entry: resolve(configDir, "electron/preload.ts")
      }
    }
  }
});
