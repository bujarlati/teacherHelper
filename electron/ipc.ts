import { ipcMain, shell } from "electron";
import { randomUUID } from "node:crypto";
import { createConfigStore } from "../src/main/configStore.js";
import { exportLessonDocx } from "../src/main/docxExporter.js";
import { chooseDemoRenderer, analyzeProblemForDemo } from "../src/main/demo/demoService.js";
import { startDemoServer } from "../src/main/demo/demoServer.js";
import { renderEquationDemoHtml } from "../src/main/demo/renderEquationDemo.js";
import { renderMotionDemoHtml } from "../src/main/demo/renderMotionDemo.js";
import { renderSimpleDemoHtml } from "../src/main/demo/renderSimpleDemo.js";
import { createHistoryStore } from "../src/main/historyStore.js";
import { testKnowledgeConnections } from "../src/main/knowledgeConnectionService.js";
import { generateLessonPlan } from "../src/main/lessonService.js";
import { getAppDataDir } from "../src/main/paths.js";
import { createQdrantClient } from "../src/main/qdrantClient.js";
import { createSiliconFlowClient } from "../src/main/siliconflowClient.js";
import { createStandaloneVideoTask, createVideoTaskFromLesson, refreshVideoTaskStatus } from "../src/main/videoWorkflow.js";
import { registerSettingsIpcHandlers } from "./settingsIpc.js";
import { registerWorkflowIpcHandlers } from "./workflowIpc.js";

export function registerIpcHandlers(): void {
  const dataDir = getAppDataDir();
  const configStore = createConfigStore(dataDir);
  const historyStore = createHistoryStore(dataDir);
  const client = createSiliconFlowClient();
  const qdrantClient = createQdrantClient();

  registerSettingsIpcHandlers(ipcMain, configStore);
  registerWorkflowIpcHandlers(ipcMain, {
    configStore,
    historyStore,
    dataDir,
    client,
    qdrantClient,
    createId: randomUUID,
    now: () => new Date().toISOString(),
    testKnowledgeConnections,
    generateLessonPlan,
    createVideoTaskFromLesson,
    createStandaloneVideoTask,
    refreshVideoTaskStatus,
    analyzeProblemForDemo,
    chooseDemoRenderer,
    renderMotionDemoHtml,
    renderEquationDemoHtml,
    renderSimpleDemoHtml,
    startDemoServer,
    openExternal: (url) => shell.openExternal(url),
    exportLessonDocx
  });
}
