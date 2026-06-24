import { app, ipcMain, shell } from "electron";
import { randomUUID } from "node:crypto";
import { createConfigStore } from "../src/main/configStore.js";
import { exportLessonDocx } from "../src/main/docxExporter.js";
import { chooseDemoRenderer, analyzeProblemForDemo } from "../src/main/demo/demoService.js";
import { startDemoServer } from "../src/main/demo/demoServer.js";
import { renderEquationDemoHtml } from "../src/main/demo/renderEquationDemo.js";
import { renderMotionDemoHtml } from "../src/main/demo/renderMotionDemo.js";
import { renderSimpleDemoHtml } from "../src/main/demo/renderSimpleDemo.js";
import { renderTeachingDemoHtml } from "../src/main/demo/renderTeachingDemo.js";
import { createHistoryStore } from "../src/main/historyStore.js";
import { testKnowledgeConnections } from "../src/main/knowledgeConnectionService.js";
import { generateLessonImages } from "../src/main/lessonImageService.js";
import { generateLessonPlan } from "../src/main/lessonService.js";
import { createLocalQdrantManager } from "../src/main/localQdrantManager.js";
import { getAppDataDir } from "../src/main/paths.js";
import { createQdrantClient } from "../src/main/qdrantClient.js";
import { createSiliconFlowClient } from "../src/main/siliconflowClient.js";
import { indexTextbook, searchTextbookIndex } from "../src/main/textbookIndexService.js";
import { createTextbookStore } from "../src/main/textbookStore.js";
import { downloadVideoFile } from "../src/main/videoDownloadService.js";
import { createStandaloneVideoTask, createVideoTaskFromLesson, refreshVideoTaskStatus } from "../src/main/videoWorkflow.js";
import { registerSettingsIpcHandlers } from "./settingsIpc.js";
import { registerWorkflowIpcHandlers } from "./workflowIpc.js";

export function registerIpcHandlers(): void {
  const dataDir = getAppDataDir();
  const configStore = createConfigStore(dataDir);
  const historyStore = createHistoryStore(dataDir);
  const textbookStore = createTextbookStore(dataDir);
  const client = createSiliconFlowClient();
  const qdrantClient = createQdrantClient();
  const localQdrantManager = createLocalQdrantManager({ dataDir });

  void configStore.load()
    .then((settings) => localQdrantManager.ensureRunning(settings))
    .catch((error: unknown) => {
      console.warn("Failed to start local Qdrant", error);
    });
  app.on("before-quit", () => {
    void localQdrantManager.stop();
  });

  registerSettingsIpcHandlers(ipcMain, configStore);
  registerWorkflowIpcHandlers(ipcMain, {
    configStore,
    historyStore,
    textbookStore,
    dataDir,
    client,
    qdrantClient,
    localQdrantManager,
    createId: randomUUID,
    now: () => new Date().toISOString(),
    testKnowledgeConnections,
    generateLessonPlan,
    generateLessonImages,
    createVideoTaskFromLesson,
    createStandaloneVideoTask,
    refreshVideoTaskStatus,
    downloadVideoFile,
    analyzeProblemForDemo,
    chooseDemoRenderer,
    renderMotionDemoHtml,
    renderEquationDemoHtml,
    renderSimpleDemoHtml,
    renderTeachingDemoHtml,
    startDemoServer,
    openExternal: (url) => shell.openExternal(url),
    exportLessonDocx,
    indexTextbook,
    searchTextbookIndex
  });
}
