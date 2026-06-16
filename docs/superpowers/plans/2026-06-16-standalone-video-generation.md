# Standalone Video Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone video generation workspace that submits text-to-video or image-to-video tasks through SiliconFlow and keeps the existing lesson video flow working with richer prompts.

**Architecture:** The renderer gets a new `VideoPage` and a new `generateVideo` preload/API method. The Electron workflow IPC layer validates standalone video requests, uses the existing SiliconFlow client and history store, and stores the resulting video task beside lesson-created video tasks. The video service accepts optional image data URLs, negative prompts, and image size while keeping status refresh unchanged.

**Tech Stack:** Electron IPC, React 19, TypeScript, Zod, Vitest, SiliconFlow `/v1/video/submit` and `/v1/video/status`.

---

### Task 1: Extend Video Submission Types and Service

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/videoService.ts`
- Modify: `src/main/videoWorkflow.ts`
- Modify: `src/main/siliconflowClient.ts`
- Test: `tests/main/videoService.test.ts`
- Test: `tests/main/videoWorkflow.test.ts`
- Test: `tests/main/siliconflowClient.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving `submitVideoTask` passes `image`, `imageSize`, and `negativePrompt` to the client, `buildVideoGenerationPrompt` combines script and prompt, and `createVideoTaskFromLesson` uses the combined prompt.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:run -- tests/main/videoService.test.ts tests/main/videoWorkflow.test.ts tests/main/siliconflowClient.test.ts`

Expected: FAIL because the new optional video fields and prompt builder do not exist yet.

- [ ] **Step 3: Implement minimal service changes**

Add optional `image`, `imageSize`, and `negativePrompt` to video submit inputs. Add `buildVideoGenerationPrompt(prompt, script)` in `videoWorkflow.ts`. Extend `createVideoTaskFromLesson` and a new `createStandaloneVideoTask` to call `submitVideoTask`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:run -- tests/main/videoService.test.ts tests/main/videoWorkflow.test.ts tests/main/siliconflowClient.test.ts`

Expected: PASS.

### Task 2: Add Standalone Video IPC and Preload API

**Files:**
- Modify: `electron/workflowIpc.ts`
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/renderer/api.ts`
- Test: `tests/electron/workflowIpc.test.ts`
- Test: `tests/electron/preloadConfig.test.ts`
- Test: `tests/electron/ipc.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving `video:generate` validates prompt, loads video settings, creates a standalone video task with optional image data, saves it to history, and returns it. Add preload/API exposure assertions.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:run -- tests/electron/workflowIpc.test.ts tests/electron/preloadConfig.test.ts tests/electron/ipc.test.ts`

Expected: FAIL because `video:generate` and `generateVideo` are not registered.

- [ ] **Step 3: Implement IPC**

Add a `video:generate` handler that accepts `{ prompt, script, imageDataUrl, imageSize, negativePrompt }`, calls `createStandaloneVideoTask`, stores it with `historyStore.upsertVideo`, and returns the saved task.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:run -- tests/electron/workflowIpc.test.ts tests/electron/preloadConfig.test.ts tests/electron/ipc.test.ts`

Expected: PASS.

### Task 3: Add Video Page UI

**Files:**
- Create: `src/renderer/pages/VideoPage.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/renderer/WorkflowPages.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

Add tests proving the navigation shows `视频生成`, the page submits prompt/script/size/negative prompt through `generateVideo`, accepts an optional image file as a data URL, displays request status, and refreshes status.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:run -- tests/renderer/WorkflowPages.test.tsx`

Expected: FAIL because the page and navigation do not exist.

- [ ] **Step 3: Implement renderer UI**

Add `VideoPage` with prompt, script, image upload, image size select, negative prompt, submit button, refresh status button, and result panel. Register it in `App.tsx` navigation.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:run -- tests/renderer/WorkflowPages.test.tsx`

Expected: PASS.

### Task 4: Verify and Publish

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full tests**

Run: `npm run test:run`

Expected: all Vitest tests pass.

- [ ] **Step 2: Run type check**

Run: `npm run lint`

Expected: TypeScript passes with no errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Electron main, preload, and renderer builds complete.

- [ ] **Step 4: Run e2e**

Run: `npm run test:e2e`

Expected: all Playwright tests pass.

- [ ] **Step 5: Commit, push, restart dev server**

Commit message: `feat: add standalone video generation`

Push: `git push origin HEAD:main`

Restart the local dev server with `TEACHERHELPER_DATA_DIR=D:\teacherHelper\teacherhelper-data` and confirm `http://localhost:5173/` returns HTTP 200.
