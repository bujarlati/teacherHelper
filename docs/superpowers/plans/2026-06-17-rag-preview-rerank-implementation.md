# RAG Preview Rerank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image previews to textbook search results and rerank Qdrant candidates with `Qwen/Qwen3-VL-Reranker-8B`.

**Architecture:** Keep PDF indexing unchanged. Add reranker settings and a SiliconFlow `/rerank` client method, then enhance textbook search to read local result images as data URLs, rerank expanded Qdrant candidates, and return renderer-safe preview data. The renderer displays thumbnails and an in-page large preview from `imageDataUrl`.

**Tech Stack:** Electron main process, React renderer, TypeScript, Vitest, Qdrant, SiliconFlow API.

---

## File Structure

- Modify `src/shared/types.ts`: add reranker settings and search result preview/ranking fields.
- Modify `src/shared/schemas.ts`: add default reranker model name and settings schema default.
- Modify `src/renderer/pages/SettingsPage.tsx`: add reranker model form controls.
- Modify `src/main/siliconflowClient.ts`: add `rerank` method and response parsing.
- Modify `src/main/textbookIndexService.ts`: read image previews, call reranker, attach ranking metadata.
- Modify `src/renderer/pages/TextbookPage.tsx`: show result thumbnail cards and large selected preview.
- Modify tests in `tests/main`, `tests/renderer`, and `tests/shared` to drive each behavior first.

## Task 1: Reranker Settings

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/schemas.ts`
- Modify: `src/renderer/pages/SettingsPage.tsx`
- Test: `tests/shared/schemas.test.ts`
- Test: `tests/renderer/SettingsPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests proving `appSettingsSchema.parse(...)` defaults `rerankerModel.modelName` to `Qwen/Qwen3-VL-Reranker-8B`, and `SettingsPage` renders `重排序 API Key` and `重排序模型名` fields.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/shared/schemas.test.ts tests/renderer/SettingsPage.test.tsx
```

Expected: failures because `rerankerModel` defaults and fields do not exist.

- [ ] **Step 3: Implement minimal settings support**

Add:

```ts
export const defaultRerankerModelName = "Qwen/Qwen3-VL-Reranker-8B";
```

Extend `AppSettings` and `appSettingsSchema` with `rerankerModel`. Add a `重排序模型` fieldset in `SettingsPage`.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm run test:run -- tests/shared/schemas.test.ts tests/renderer/SettingsPage.test.tsx
```

Expected: all selected tests pass.

## Task 2: SiliconFlow Rerank Client

**Files:**
- Modify: `src/main/siliconflowClient.ts`
- Test: `tests/main/siliconflowClient.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that call `client.rerank(...)`, assert it posts to `/rerank` with `model`, `query`, `documents`, `instruction`, `top_n`, and `return_documents: false`, and parses `results[].index` plus `results[].relevance_score`.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/main/siliconflowClient.test.ts
```

Expected: failure because `client.rerank` is not defined.

- [ ] **Step 3: Implement minimal rerank method**

Add a `RerankDocument` type, send `POST /rerank`, parse `results`, and throw `SiliconFlow returned invalid rerank response` for malformed responses.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm run test:run -- tests/main/siliconflowClient.test.ts
```

Expected: all selected tests pass.

## Task 3: Textbook Search Reranking And Image Data URLs

**Files:**
- Modify: `src/main/textbookIndexService.ts`
- Test: `tests/main/textbookIndexService.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that:

- Qdrant receives `limit * 3` candidates capped at 24.
- search reads local PNG files and returns `imageDataUrl`.
- reranker can reorder candidates and attach `rerankScore` plus `rankingSource: "reranker"`.
- reranker failure returns Qdrant order with `rankingSource: "qdrant"` and a fallback `rankingMessage`.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/main/textbookIndexService.test.ts
```

Expected: failures because the service has no reranker dependency or image data URL field.

- [ ] **Step 3: Implement minimal search enhancement**

Extend `searchTextbookIndex` input with an optional reranker-capable client. Convert image paths to `data:image/png;base64,...`, build multimodal documents from metadata and images, call rerank when configured, and keep vector fallback on rerank failure.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm run test:run -- tests/main/textbookIndexService.test.ts
```

Expected: all selected tests pass.

## Task 4: Renderer Search Preview

**Files:**
- Modify: `src/renderer/pages/TextbookPage.tsx`
- Modify: `src/renderer/styles.css`
- Test: `tests/renderer/WorkflowPages.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that search results render an image with alt text, clicking a result opens a larger preview, and fallback text appears when `imageDataUrl` is missing.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm run test:run -- tests/renderer/WorkflowPages.test.tsx
```

Expected: failure because results only render paths.

- [ ] **Step 3: Implement preview UI**

Render thumbnails in result cards, keep path text, store a selected result, and add a large preview section. Add responsive CSS for fixed thumbnail and preview dimensions.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm run test:run -- tests/renderer/WorkflowPages.test.tsx
```

Expected: all selected tests pass.

## Task 5: Full Verification And Commit

**Files:**
- All changed files.

- [ ] **Step 1: Run full tests**

```bash
npm run test:run
npm run lint
npm run build
npm run test:e2e
```

Expected: all commands exit 0.

- [ ] **Step 2: Inspect git diff**

```bash
git status -sb
git diff --stat
```

Expected: only planned code, tests, and docs are changed.

- [ ] **Step 3: Commit implementation**

```bash
git add docs/superpowers/plans/2026-06-17-rag-preview-rerank-implementation.md src tests electron
git commit -m "feat: add textbook result previews and reranking"
```

Expected: commit succeeds on `codex/textbook-library`.
