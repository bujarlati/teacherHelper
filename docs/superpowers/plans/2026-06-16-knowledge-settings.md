# Knowledge Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add phase-two knowledge base settings for the embedding model and Qdrant connection, including a local connection test.

**Architecture:** Extend the shared app settings schema with `embeddingModel` and `qdrant`, with defaults for old settings files. Add SiliconFlow embedding and Qdrant connection clients in the main process. Expose a `knowledge:testConnections` IPC route through preload and renderer API, and add settings form controls plus a test button.

**Tech Stack:** Electron IPC, React 19, TypeScript, Zod, Vitest, SiliconFlow `/v1/embeddings`, Qdrant REST `/collections`.

---

### Task 1: Extend Settings Schema and Store Defaults

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/schemas.ts`
- Modify: `src/main/configStore.ts`
- Test: `tests/shared/schemas.test.ts`
- Test: `tests/main/configStore.test.ts`

- [x] **Step 1: Write failing tests**

Add tests proving `appSettingsSchema` accepts `embeddingModel` and `qdrant`, and that `createConfigStore.load()` migrates older settings JSON by filling `embeddingModel.modelName` with `Qwen/Qwen3-VL-Embedding-8B` and `qdrant.url` with `http://localhost:6333`.

- [x] **Step 2: Run tests to verify failure**

Run: `npm run test:run -- tests/shared/schemas.test.ts tests/main/configStore.test.ts`

Expected: FAIL because the new settings fields do not exist yet.

- [x] **Step 3: Implement schema and defaults**

Add `QdrantConfig`, `embeddingModel`, and `qdrant` fields. Keep old settings files loadable.

- [x] **Step 4: Run tests to verify pass**

Run: `npm run test:run -- tests/shared/schemas.test.ts tests/main/configStore.test.ts`

Expected: PASS.

### Task 2: Add Connection Test Services and IPC

**Files:**
- Create: `src/main/qdrantClient.ts`
- Create: `src/main/knowledgeConnectionService.ts`
- Modify: `src/main/siliconflowClient.ts`
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/workflowIpc.ts`
- Modify: `src/renderer/api.ts`
- Test: `tests/main/siliconflowClient.test.ts`
- Test: `tests/electron/workflowIpc.test.ts`

- [x] **Step 1: Write failing tests**

Add tests for SiliconFlow `createEmbedding`, Qdrant `/collections` connection, and `knowledge:testConnections` IPC.

- [x] **Step 2: Run tests to verify failure**

Run: `npm run test:run -- tests/main/siliconflowClient.test.ts tests/electron/workflowIpc.test.ts`

Expected: FAIL because the new methods and IPC route do not exist yet.

- [x] **Step 3: Implement clients and IPC**

Implement `createEmbedding`, `createQdrantClient.testConnection`, `testKnowledgeConnections`, and preload/API exposure.

- [x] **Step 4: Run tests to verify pass**

Run: `npm run test:run -- tests/main/siliconflowClient.test.ts tests/electron/workflowIpc.test.ts`

Expected: PASS.

### Task 3: Add Settings UI Controls

**Files:**
- Modify: `src/renderer/pages/SettingsPage.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/renderer/SettingsPage.test.tsx`

- [x] **Step 1: Write failing renderer tests**

Add tests proving the settings page loads embedding/Qdrant fields, saves them, clears them, and calls the connection test button.

- [x] **Step 2: Run test to verify failure**

Run: `npm run test:run -- tests/renderer/SettingsPage.test.tsx`

Expected: FAIL because controls and API call do not exist yet.

- [x] **Step 3: Implement settings UI**

Add two fieldsets, save/clear behavior for the new fields, and a `测试知识库连接` button.

- [x] **Step 4: Run test to verify pass**

Run: `npm run test:run -- tests/renderer/SettingsPage.test.tsx`

Expected: PASS.

### Task 4: Verify and Publish

**Files:**
- Verify all changed files.

- [x] **Step 1: Run full tests**

Run: `npm run test:run`

Expected: all Vitest tests pass.

- [x] **Step 2: Run type check**

Run: `npm run lint`

Expected: TypeScript passes with no errors.

- [x] **Step 3: Run production build**

Run: `npm run build`

Expected: Electron main, preload, and renderer builds complete.

- [x] **Step 4: Run e2e**

Run: `npm run test:e2e`

Expected: all Playwright tests pass.

- [ ] **Step 5: Commit, push, restart dev server**

Commit message: `feat: add knowledge base settings`

Push: `git push origin HEAD:main`

Restart the local dev server with `TEACHERHELPER_DATA_DIR=D:\teacherHelper\teacherhelper-data` and confirm `http://localhost:5173/` returns HTTP 200.
