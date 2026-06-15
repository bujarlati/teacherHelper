import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appSettingsSchema } from "../shared/schemas";
import type { AppSettings } from "../shared/types";

const emptySettings: AppSettings = {
  textModel: { apiKey: "", modelName: "" },
  videoModel: { apiKey: "", modelName: "" }
};

export function createConfigStore(baseDir: string) {
  const filePath = join(baseDir, "settings.json");

  return {
    async load(): Promise<AppSettings> {
      try {
        const raw = await readFile(filePath, "utf-8");
        return appSettingsSchema.parse(JSON.parse(raw));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return emptySettings;
        }

        throw error;
      }
    },

    async save(settings: AppSettings): Promise<void> {
      const parsed = appSettingsSchema.parse(settings);
      await mkdir(baseDir, { recursive: true });
      await writeFile(filePath, JSON.stringify(parsed, null, 2), "utf-8");
    },

    async clear(): Promise<void> {
      await rm(filePath, { force: true });
    }
  };
}
