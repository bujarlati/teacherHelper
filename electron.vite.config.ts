import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

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
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs"
        }
      },
      lib: {
        entry: resolve(configDir, "electron/preload.ts")
      }
    }
  },
  renderer: {
    root: resolve(configDir, "src/renderer"),
    plugins: [react()],
    build: {
      outDir: resolve(configDir, "dist"),
      emptyOutDir: true
    },
    server: {
      port: 5173
    }
  }
});
