import { app } from "electron";
import { join } from "node:path";

export function getAppDataDir(): string {
  if (process.env.TEACHERHELPER_DATA_DIR) {
    return process.env.TEACHERHELPER_DATA_DIR;
  }

  return join(app.getPath("userData"), "teacherhelper-data");
}
