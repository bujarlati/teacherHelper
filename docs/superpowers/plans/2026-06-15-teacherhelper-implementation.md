# teacherHelper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Windows desktop version of teacherHelper: a local Electron app for lesson-plan generation, SiliconFlow video tasks, Word/Markdown export, and high-quality interactive math demos for motion and equation problems.

**Architecture:** Electron owns the desktop shell, local filesystem access, and secure IPC. React renders the teacher workspace. Node services call SiliconFlow, validate structured JSON, persist local data, export Word files, generate demo HTML/JS/CSS, and serve demos through localhost.

**Tech Stack:** Electron, React, Vite, TypeScript, Vitest, Zod, docx, Electron Store, Node `http`, Playwright for browser-level demo checks.

---

## File Structure

- Create `package.json`: npm scripts, dependencies, dev dependencies.
- Create `tsconfig.json`: shared TypeScript compiler options.
- Create `tsconfig.node.json`: Electron and Node service compiler options.
- Create `vite.config.ts`: renderer build config.
- Create `vitest.config.ts`: unit test config.
- Create `playwright.config.ts`: demo rendering checks.
- Create `electron/main.ts`: Electron app entry and window creation.
- Create `electron/preload.ts`: safe renderer API bridge.
- Create `electron/ipc.ts`: IPC handler registration.
- Create `src/shared/types.ts`: shared domain types.
- Create `src/shared/schemas.ts`: Zod schemas for model output and persisted data.
- Create `src/main/paths.ts`: app data path helpers.
- Create `src/main/configStore.ts`: local model config storage.
- Create `src/main/jsonStore.ts`: JSON file persistence helper.
- Create `src/main/siliconflowClient.ts`: SiliconFlow HTTP client.
- Create `src/main/lessonPrompt.ts`: prompt builder for lesson JSON.
- Create `src/main/lessonService.ts`: lesson generation and Markdown rendering.
- Create `src/main/docxExporter.ts`: Word export.
- Create `src/main/videoService.ts`: video submit and status polling.
- Create `src/main/videoWorkflow.ts`: creates video tasks from generated lessons.
- Create `src/main/demo/analyzePrompt.ts`: prompt builder for problem demo plans.
- Create `src/main/demo/demoService.ts`: demo analysis and renderer selection.
- Create `src/main/demo/renderMotionDemo.ts`: high-quality motion demo static app.
- Create `src/main/demo/renderEquationDemo.ts`: high-quality equation demo static app.
- Create `src/main/demo/renderSimpleDemo.ts`: simple engineering/geometry fallback demo.
- Create `src/main/demo/demoServer.ts`: localhost static demo server.
- Create `src/main/historyStore.ts`: local history records.
- Create `src/renderer/main.tsx`: React entry.
- Create `src/renderer/App.tsx`: shell layout and navigation.
- Create `src/renderer/api.ts`: typed wrapper around preload API.
- Create `src/renderer/styles.css`: application styling.
- Create `src/renderer/pages/SettingsPage.tsx`: model settings.
- Create `src/renderer/pages/LessonPage.tsx`: lesson generation.
- Create `src/renderer/pages/DemoPage.tsx`: problem demo generation.
- Create `src/renderer/pages/HistoryPage.tsx`: history view.
- Create `tests/shared/schemas.test.ts`: schema tests.
- Create `tests/main/configStore.test.ts`: local config tests.
- Create `tests/main/siliconflowClient.test.ts`: API client tests.
- Create `tests/main/lessonService.test.ts`: lesson generation tests.
- Create `tests/main/docxExporter.test.ts`: Word export tests.
- Create `tests/main/videoService.test.ts`: video task tests.
- Create `tests/main/videoWorkflow.test.ts`: lesson-to-video workflow tests.
- Create `tests/main/demoService.test.ts`: problem classification tests.
- Create `tests/main/renderMotionDemo.test.ts`: motion demo output tests.
- Create `tests/main/renderEquationDemo.test.ts`: equation demo output tests.
- Create `tests/main/historyStore.test.ts`: history tests.
- Create `tests/e2e/demo-render.spec.ts`: Playwright checks for generated demo pages.

## Task 0: Initialize Repository and Tooling

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Initialize git repository**

Run:

```powershell
git init
```

Expected: repository initialized in `D:\teacherHelper`.

- [ ] **Step 2: Write base configuration files**

Create `.gitignore`:

```gitignore
node_modules/
dist/
dist-electron/
out/
coverage/
.env
.superpowers/
teacherhelper-data/
```

Create `package.json`:

```json
{
  "name": "teacherhelper",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "tsc -p tsconfig.node.json && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "lint": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "docx": "^9.5.1",
    "electron-store": "^10.0.1",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "electron": "^33.2.1",
    "electron-vite": "^3.0.0",
    "jsdom": "^25.0.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "electron", "tests", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist-electron",
    "noEmit": false,
    "types": ["node"]
  },
  "include": ["electron", "src/main", "src/shared"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  build: {
    outDir: "../../dist",
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    headless: true
  }
});
```

- [ ] **Step 3: Install dependencies**

Run:

```powershell
npm install
```

Expected: `node_modules` and `package-lock.json` are created.

- [ ] **Step 4: Verify empty test suite**

Run:

```powershell
npm run test:run
```

Expected: Vitest starts successfully and reports no tests or exits cleanly once the first test files are added. If Vitest exits non-zero because no tests exist, continue to Task 1 before judging baseline.

- [ ] **Step 5: Commit tooling**

Run:

```powershell
git add .gitignore package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts playwright.config.ts docs/superpowers/specs/2026-06-15-teacherhelper-design.md docs/superpowers/plans/2026-06-15-teacherhelper-implementation.md
git commit -m "chore: initialize teacherhelper tooling"
```

Expected: initial commit is created.

## Task 1: Shared Types and Schemas

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/schemas.ts`
- Test: `tests/shared/schemas.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `tests/shared/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lessonPlanSchema, problemDemoPlanSchema } from "../../src/shared/schemas";

describe("lessonPlanSchema", () => {
  it("accepts a complete lesson plan", () => {
    const parsed = lessonPlanSchema.parse({
      title: "一元一次方程",
      grade_suggestion: "七年级",
      teaching_goals: ["理解方程的意义"],
      key_points: ["列方程"],
      difficult_points: ["找等量关系"],
      common_confusions: ["把未知量和已知量混淆"],
      lesson_flow: [{ title: "导入", minutes: 5, activities: ["情境提问"] }],
      board_design: ["设未知数", "列方程", "解方程"],
      example_questions: [{ question: "小明买笔...", answer: "x=3" }],
      worked_solutions: [{ question: "小明买笔...", steps: ["设 x", "列式"], answer: "3 支" }],
      classroom_questions: ["为什么两边相等？"],
      homework_suggestions: ["完成 3 道同类题"],
      video_script: "展示天平两边保持平衡。",
      video_prompt: "A classroom animation showing equation balance.",
      markdown: "# 一元一次方程"
    });

    expect(parsed.title).toBe("一元一次方程");
  });
});

describe("problemDemoPlanSchema", () => {
  it("accepts a high-quality equation demo plan", () => {
    const parsed = problemDemoPlanSchema.parse({
      kind: "equation",
      title: "买笔问题",
      originalProblem: "每支笔 2 元，买了 x 支共 10 元。",
      knownValues: [{ label: "单价", value: 2, unit: "元" }],
      target: "求购买数量",
      steps: ["设购买 x 支", "列方程 2x=10", "解得 x=5"],
      equation: {
        variable: "x",
        relationship: "总价 = 单价 × 数量",
        expression: "2x = 10",
        solution: "x = 5",
        verification: "2 × 5 = 10"
      }
    });

    expect(parsed.kind).toBe("equation");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/shared/schemas.test.ts
```

Expected: FAIL because `src/shared/schemas.ts` does not exist.

- [ ] **Step 3: Implement shared types**

Create `src/shared/types.ts`:

```ts
export type ModelConfig = {
  apiKey: string;
  modelName: string;
};

export type AppSettings = {
  textModel: ModelConfig;
  videoModel: ModelConfig;
};

export type LessonPlan = {
  title: string;
  grade_suggestion: string;
  teaching_goals: string[];
  key_points: string[];
  difficult_points: string[];
  common_confusions: string[];
  lesson_flow: Array<{ title: string; minutes: number; activities: string[] }>;
  board_design: string[];
  example_questions: Array<{ question: string; answer: string }>;
  worked_solutions: Array<{ question: string; steps: string[]; answer: string }>;
  classroom_questions: string[];
  homework_suggestions: string[];
  video_script: string;
  video_prompt: string;
  markdown: string;
};

export type DemoKind = "motion" | "equation" | "engineering" | "geometry" | "simple";

export type ProblemDemoPlan = {
  kind: DemoKind;
  title: string;
  originalProblem: string;
  knownValues: Array<{ label: string; value: number | string; unit?: string }>;
  target: string;
  steps: string[];
  motion?: {
    startLabel: string;
    endLabel: string;
    distance: number;
    distanceUnit: string;
    speed: number;
    speedUnit: string;
    answerSeconds: number;
  };
  equation?: {
    variable: string;
    relationship: string;
    expression: string;
    solution: string;
    verification: string;
  };
};

export type VideoTaskStatus = "Succeed" | "InQueue" | "InProgress" | "Failed";

export type VideoTask = {
  id: string;
  requestId: string;
  status: VideoTaskStatus;
  prompt: string;
  script: string;
  videoUrl?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 4: Implement schemas**

Create `src/shared/schemas.ts`:

```ts
import { z } from "zod";

export const modelConfigSchema = z.object({
  apiKey: z.string(),
  modelName: z.string()
});

export const appSettingsSchema = z.object({
  textModel: modelConfigSchema,
  videoModel: modelConfigSchema
});

export const lessonPlanSchema = z.object({
  title: z.string().min(1),
  grade_suggestion: z.string().min(1),
  teaching_goals: z.array(z.string().min(1)),
  key_points: z.array(z.string().min(1)),
  difficult_points: z.array(z.string().min(1)),
  common_confusions: z.array(z.string().min(1)),
  lesson_flow: z.array(z.object({
    title: z.string().min(1),
    minutes: z.number().nonnegative(),
    activities: z.array(z.string().min(1))
  })),
  board_design: z.array(z.string().min(1)),
  example_questions: z.array(z.object({
    question: z.string().min(1),
    answer: z.string().min(1)
  })),
  worked_solutions: z.array(z.object({
    question: z.string().min(1),
    steps: z.array(z.string().min(1)),
    answer: z.string().min(1)
  })),
  classroom_questions: z.array(z.string().min(1)),
  homework_suggestions: z.array(z.string().min(1)),
  video_script: z.string().min(1),
  video_prompt: z.string().min(1),
  markdown: z.string().min(1)
});

export const problemDemoPlanSchema = z.object({
  kind: z.enum(["motion", "equation", "engineering", "geometry", "simple"]),
  title: z.string().min(1),
  originalProblem: z.string().min(1),
  knownValues: z.array(z.object({
    label: z.string().min(1),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional()
  })),
  target: z.string().min(1),
  steps: z.array(z.string().min(1)),
  motion: z.object({
    startLabel: z.string().min(1),
    endLabel: z.string().min(1),
    distance: z.number().positive(),
    distanceUnit: z.string().min(1),
    speed: z.number().positive(),
    speedUnit: z.string().min(1),
    answerSeconds: z.number().positive()
  }).optional(),
  equation: z.object({
    variable: z.string().min(1),
    relationship: z.string().min(1),
    expression: z.string().min(1),
    solution: z.string().min(1),
    verification: z.string().min(1)
  }).optional()
}).superRefine((value, ctx) => {
  if (value.kind === "motion" && !value.motion) {
    ctx.addIssue({ code: "custom", message: "motion plan requires motion data", path: ["motion"] });
  }
  if (value.kind === "equation" && !value.equation) {
    ctx.addIssue({ code: "custom", message: "equation plan requires equation data", path: ["equation"] });
  }
});

export const videoStatusSchema = z.enum(["Succeed", "InQueue", "InProgress", "Failed"]);
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/shared/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/shared/types.ts src/shared/schemas.ts tests/shared/schemas.test.ts
git commit -m "feat: add shared teacherhelper schemas"
```

Expected: commit created.

## Task 2: Local Settings Store

**Files:**
- Create: `src/main/paths.ts`
- Create: `src/main/configStore.ts`
- Test: `tests/main/configStore.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/main/configStore.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createConfigStore } from "../../src/main/configStore";

let tempDir = "";

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe("createConfigStore", () => {
  it("saves and loads local model settings", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);

    await store.save({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" }
    });

    await expect(store.load()).resolves.toEqual({
      textModel: { apiKey: "text-key", modelName: "Qwen/Qwen3-32B" },
      videoModel: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" }
    });
  });

  it("returns empty settings when no config exists", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-config-"));
    const store = createConfigStore(tempDir);

    await expect(store.load()).resolves.toEqual({
      textModel: { apiKey: "", modelName: "" },
      videoModel: { apiKey: "", modelName: "" }
    });
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/configStore.test.ts
```

Expected: FAIL because `src/main/configStore.ts` does not exist.

- [ ] **Step 3: Implement path helpers**

Create `src/main/paths.ts`:

```ts
import { app } from "electron";
import { join } from "node:path";

export function getAppDataDir(): string {
  if (process.env.TEACHERHELPER_DATA_DIR) {
    return process.env.TEACHERHELPER_DATA_DIR;
  }
  return join(app.getPath("userData"), "teacherhelper-data");
}
```

- [ ] **Step 4: Implement config store**

Create `src/main/configStore.ts`:

```ts
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
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptySettings;
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
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/configStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/main/paths.ts src/main/configStore.ts tests/main/configStore.test.ts
git commit -m "feat: persist local model settings"
```

Expected: commit created.

## Task 3: SiliconFlow Client

**Files:**
- Create: `src/main/siliconflowClient.ts`
- Test: `tests/main/siliconflowClient.test.ts`

- [ ] **Step 1: Write failing client tests**

Create `tests/main/siliconflowClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createSiliconFlowClient } from "../../src/main/siliconflowClient";

describe("createSiliconFlowClient", () => {
  it("calls chat completions with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"title\":\"ok\"}" } }]
      })
    });
    const client = createSiliconFlowClient({ fetchImpl: fetchMock });

    const content = await client.chatCompletion({
      apiKey: "key",
      modelName: "Qwen/Qwen3-32B",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(content).toBe("{\"title\":\"ok\"}");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.siliconflow.cn/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" })
      })
    );
  });

  it("submits video and returns request id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ requestId: "req-1" })
    });
    const client = createSiliconFlowClient({ fetchImpl: fetchMock });

    await expect(client.submitVideo({
      apiKey: "key",
      modelName: "Wan-AI/Wan2.2-T2V-A14B",
      prompt: "math animation"
    })).resolves.toBe("req-1");
  });

  it("throws a readable error on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized"
    });
    const client = createSiliconFlowClient({ fetchImpl: fetchMock });

    await expect(client.listModels({ apiKey: "bad", type: "text" })).rejects.toThrow("SiliconFlow request failed: 401 unauthorized");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/siliconflowClient.test.ts
```

Expected: FAIL because `src/main/siliconflowClient.ts` does not exist.

- [ ] **Step 3: Implement client**

Create `src/main/siliconflowClient.ts`:

```ts
import { videoStatusSchema } from "../shared/schemas";
import type { VideoTaskStatus } from "../shared/types";

type FetchImpl = typeof fetch;

type ClientOptions = {
  fetchImpl?: FetchImpl;
  baseUrl?: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function createSiliconFlowClient(options: ClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.siliconflow.cn/v1";

  async function requestJson<T>(path: string, apiKey: string, init: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SiliconFlow request failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    async chatCompletion(input: { apiKey: string; modelName: string; messages: ChatMessage[] }): Promise<string> {
      const data = await requestJson<{ choices: Array<{ message: { content: string } }> }>(
        "/chat/completions",
        input.apiKey,
        {
          method: "POST",
          body: JSON.stringify({ model: input.modelName, messages: input.messages })
        }
      );
      return data.choices[0]?.message.content ?? "";
    },

    async listModels(input: { apiKey: string; type?: "text" | "video" }): Promise<Array<{ id: string }>> {
      const query = input.type ? `?type=${encodeURIComponent(input.type)}` : "";
      const data = await requestJson<{ data: Array<{ id: string }> }>(`/models${query}`, input.apiKey, { method: "GET" });
      return data.data;
    },

    async submitVideo(input: { apiKey: string; modelName: string; prompt: string; imageSize?: string }): Promise<string> {
      const data = await requestJson<{ requestId: string }>("/video/submit", input.apiKey, {
        method: "POST",
        body: JSON.stringify({
          model: input.modelName,
          prompt: input.prompt,
          image_size: input.imageSize ?? "1280x720"
        })
      });
      return data.requestId;
    },

    async getVideoStatus(input: { apiKey: string; requestId: string }): Promise<{
      status: VideoTaskStatus;
      reason?: string;
      videoUrl?: string;
      seed?: number;
      inferenceMs?: number;
    }> {
      const data = await requestJson<{
        status: VideoTaskStatus;
        reason?: string;
        results?: { videos?: Array<{ url: string }>; seed?: number; timings?: { inference?: number } };
      }>("/video/status", input.apiKey, {
        method: "POST",
        body: JSON.stringify({ requestId: input.requestId })
      });

      return {
        status: videoStatusSchema.parse(data.status),
        reason: data.reason,
        videoUrl: data.results?.videos?.[0]?.url,
        seed: data.results?.seed,
        inferenceMs: data.results?.timings?.inference
      };
    }
  };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/siliconflowClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/main/siliconflowClient.ts tests/main/siliconflowClient.test.ts
git commit -m "feat: add siliconflow api client"
```

Expected: commit created.

## Task 4: Lesson Generation Service

**Files:**
- Create: `src/main/lessonPrompt.ts`
- Create: `src/main/lessonService.ts`
- Test: `tests/main/lessonService.test.ts`

- [ ] **Step 1: Write failing lesson service tests**

Create `tests/main/lessonService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLessonPrompt, generateLessonPlan, renderLessonMarkdown } from "../../src/main/lessonService";

describe("buildLessonPrompt", () => {
  it("requires structured lesson JSON and video fields", () => {
    const messages = buildLessonPrompt("一元一次方程");
    const combined = messages.map((message) => message.content).join("\n");

    expect(combined).toContain("video_script");
    expect(combined).toContain("video_prompt");
    expect(combined).toContain("只返回 JSON");
  });
});

describe("generateLessonPlan", () => {
  it("parses model JSON into a lesson plan", async () => {
    const fakeClient = {
      chatCompletion: async () => JSON.stringify({
        title: "路程问题",
        grade_suggestion: "六年级",
        teaching_goals: ["理解速度、时间、路程关系"],
        key_points: ["路程 = 速度 × 时间"],
        difficult_points: ["单位统一"],
        common_confusions: ["米和千米混用"],
        lesson_flow: [{ title: "导入", minutes: 5, activities: ["动画情境"] }],
        board_design: ["s=vt"],
        example_questions: [{ question: "A/B 两地相距 1000m...", answer: "500 秒" }],
        worked_solutions: [{ question: "A/B 两地相距 1000m...", steps: ["1000 ÷ 2"], answer: "500 秒" }],
        classroom_questions: ["速度变为 4m/s 呢？"],
        homework_suggestions: ["完成 2 道路程题"],
        video_script: "展示小明从 A 到 B。",
        video_prompt: "An animated boy walking from A to B.",
        markdown: "# 路程问题"
      })
    };

    const plan = await generateLessonPlan({
      topic: "路程问题",
      config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
      client: fakeClient
    });

    expect(plan.title).toBe("路程问题");
  });
});

describe("renderLessonMarkdown", () => {
  it("renders important lesson sections", () => {
    const markdown = renderLessonMarkdown({
      title: "路程问题",
      grade_suggestion: "六年级",
      teaching_goals: ["理解关系"],
      key_points: ["路程 = 速度 × 时间"],
      difficult_points: ["单位统一"],
      common_confusions: ["单位混用"],
      lesson_flow: [{ title: "导入", minutes: 5, activities: ["提问"] }],
      board_design: ["s=vt"],
      example_questions: [{ question: "题目", answer: "答案" }],
      worked_solutions: [{ question: "题目", steps: ["第一步"], answer: "答案" }],
      classroom_questions: ["为什么？"],
      homework_suggestions: ["练习"],
      video_script: "脚本",
      video_prompt: "提示词",
      markdown: "# old"
    });

    expect(markdown).toContain("## 教学重点");
    expect(markdown).toContain("## 视频脚本");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/lessonService.test.ts
```

Expected: FAIL because `src/main/lessonService.ts` does not exist.

- [ ] **Step 3: Implement lesson prompt**

Create `src/main/lessonPrompt.ts`:

```ts
export function buildLessonPrompt(topic: string) {
  return [
    {
      role: "system" as const,
      content: [
        "你是一个经验丰富的中国中小学数学老师。",
        "请根据用户输入的知识点生成完整教案。",
        "只返回 JSON，不要使用 Markdown 代码块。",
        "JSON 必须包含：title, grade_suggestion, teaching_goals, key_points, difficult_points, common_confusions, lesson_flow, board_design, example_questions, worked_solutions, classroom_questions, homework_suggestions, video_script, video_prompt, markdown。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: `知识点：${topic}`
    }
  ];
}
```

- [ ] **Step 4: Implement lesson service**

Create `src/main/lessonService.ts`:

```ts
import { lessonPlanSchema } from "../shared/schemas";
import type { LessonPlan, ModelConfig } from "../shared/types";
import { buildLessonPrompt } from "./lessonPrompt";

type LessonClient = {
  chatCompletion(input: { apiKey: string; modelName: string; messages: ReturnType<typeof buildLessonPrompt> }): Promise<string>;
};

export { buildLessonPrompt };

export async function generateLessonPlan(input: {
  topic: string;
  config: ModelConfig;
  client: LessonClient;
}): Promise<LessonPlan> {
  if (!input.config.apiKey || !input.config.modelName) {
    throw new Error("文本模型配置不完整，请先在设置页填写 API Key 和模型名。");
  }

  const raw = await input.client.chatCompletion({
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    messages: buildLessonPrompt(input.topic)
  });
  const parsed = lessonPlanSchema.parse(JSON.parse(stripCodeFence(raw)));
  return { ...parsed, markdown: renderLessonMarkdown(parsed) };
}

export function renderLessonMarkdown(plan: LessonPlan): string {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
  const flow = plan.lesson_flow
    .map((item) => `- ${item.title}（${item.minutes} 分钟）：${item.activities.join("；")}`)
    .join("\n");
  const worked = plan.worked_solutions
    .map((item) => [`### ${item.question}`, ...item.steps.map((step, index) => `${index + 1}. ${step}`), `答案：${item.answer}`].join("\n"))
    .join("\n\n");

  return [
    `# ${plan.title}`,
    `建议年级：${plan.grade_suggestion}`,
    "## 教学目标",
    list(plan.teaching_goals),
    "## 教学重点",
    list(plan.key_points),
    "## 教学难点",
    list(plan.difficult_points),
    "## 易混疑点",
    list(plan.common_confusions),
    "## 教学流程",
    flow,
    "## 板书设计",
    list(plan.board_design),
    "## 示例题目",
    plan.example_questions.map((item) => `- ${item.question} 答：${item.answer}`).join("\n"),
    "## 示例解法",
    worked,
    "## 课堂提问",
    list(plan.classroom_questions),
    "## 作业建议",
    list(plan.homework_suggestions),
    "## 视频脚本",
    plan.video_script,
    "## 视频提示词",
    plan.video_prompt
  ].join("\n\n");
}

function stripCodeFence(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/lessonService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/main/lessonPrompt.ts src/main/lessonService.ts tests/main/lessonService.test.ts
git commit -m "feat: generate structured lesson plans"
```

Expected: commit created.

## Task 5: Word Export

**Files:**
- Create: `src/main/docxExporter.ts`
- Test: `tests/main/docxExporter.test.ts`

- [ ] **Step 1: Write failing Word export test**

Create `tests/main/docxExporter.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportLessonDocx } from "../../src/main/docxExporter";

let tempDir = "";

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe("exportLessonDocx", () => {
  it("writes a non-empty docx file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-docx-"));
    const filePath = join(tempDir, "lesson.docx");

    await exportLessonDocx({
      filePath,
      lesson: {
        title: "方程题",
        grade_suggestion: "七年级",
        teaching_goals: ["会列方程"],
        key_points: ["找等量关系"],
        difficult_points: ["设未知量"],
        common_confusions: ["漏写单位"],
        lesson_flow: [{ title: "导入", minutes: 5, activities: ["提问"] }],
        board_design: ["x"],
        example_questions: [{ question: "题", answer: "答" }],
        worked_solutions: [{ question: "题", steps: ["设 x"], answer: "答" }],
        classroom_questions: ["为什么？"],
        homework_suggestions: ["练习"],
        video_script: "脚本",
        video_prompt: "prompt",
        markdown: "# 方程题"
      }
    });

    const buffer = await readFile(filePath);
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/docxExporter.test.ts
```

Expected: FAIL because `src/main/docxExporter.ts` does not exist.

- [ ] **Step 3: Implement Word exporter**

Create `src/main/docxExporter.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { LessonPlan } from "../shared/types";

export async function exportLessonDocx(input: { filePath: string; lesson: LessonPlan }): Promise<void> {
  const doc = new Document({
    sections: [{
      children: [
        heading(input.lesson.title, 32),
        paragraph(`建议年级：${input.lesson.grade_suggestion}`),
        heading("教学目标", 24),
        ...bullets(input.lesson.teaching_goals),
        heading("教学重点", 24),
        ...bullets(input.lesson.key_points),
        heading("教学难点", 24),
        ...bullets(input.lesson.difficult_points),
        heading("易混疑点", 24),
        ...bullets(input.lesson.common_confusions),
        heading("教学流程", 24),
        ...bullets(input.lesson.lesson_flow.map((item) => `${item.title}（${item.minutes} 分钟）：${item.activities.join("；")}`)),
        heading("板书设计", 24),
        ...bullets(input.lesson.board_design),
        heading("示例解法", 24),
        ...input.lesson.worked_solutions.flatMap((item) => [
          paragraph(item.question),
          ...item.steps.map((step, index) => paragraph(`${index + 1}. ${step}`)),
          paragraph(`答案：${item.answer}`)
        ]),
        heading("课堂提问", 24),
        ...bullets(input.lesson.classroom_questions),
        heading("作业建议", 24),
        ...bullets(input.lesson.homework_suggestions),
        heading("视频脚本", 24),
        paragraph(input.lesson.video_script),
        heading("视频提示词", 24),
        paragraph(input.lesson.video_prompt)
      ]
    }]
  });

  await writeFile(input.filePath, await Packer.toBuffer(doc));
}

function heading(text: string, size: number): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size })] });
}

function paragraph(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, size: 22 })] });
}

function bullets(items: string[]): Paragraph[] {
  return items.map((item) => new Paragraph({ text: item, bullet: { level: 0 } }));
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/docxExporter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/main/docxExporter.ts tests/main/docxExporter.test.ts
git commit -m "feat: export lesson plans to word"
```

Expected: commit created.

## Task 6: Video Task Service

**Files:**
- Create: `src/main/videoService.ts`
- Test: `tests/main/videoService.test.ts`

- [ ] **Step 1: Write failing video service tests**

Create `tests/main/videoService.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { pollVideoUntilDone, submitVideoTask } from "../../src/main/videoService";

describe("submitVideoTask", () => {
  it("submits video prompt and creates local task", async () => {
    const client = { submitVideo: vi.fn().mockResolvedValue("req-1") };
    const task = await submitVideoTask({
      client,
      config: { apiKey: "key", modelName: "Wan-AI/Wan2.2-T2V-A14B" },
      prompt: "math video",
      script: "show equation"
    });

    expect(task.requestId).toBe("req-1");
    expect(task.status).toBe("InQueue");
  });
});

describe("pollVideoUntilDone", () => {
  it("returns succeed status with video url", async () => {
    const client = {
      getVideoStatus: vi.fn()
        .mockResolvedValueOnce({ status: "InProgress" })
        .mockResolvedValueOnce({ status: "Succeed", videoUrl: "https://video.example/a.mp4" })
    };

    const result = await pollVideoUntilDone({
      client,
      apiKey: "key",
      requestId: "req-1",
      intervalMs: 1,
      maxAttempts: 2
    });

    expect(result.status).toBe("Succeed");
    expect(result.videoUrl).toBe("https://video.example/a.mp4");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/videoService.test.ts
```

Expected: FAIL because `src/main/videoService.ts` does not exist.

- [ ] **Step 3: Implement video service**

Create `src/main/videoService.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { ModelConfig, VideoTask, VideoTaskStatus } from "../shared/types";

type VideoClient = {
  submitVideo(input: { apiKey: string; modelName: string; prompt: string }): Promise<string>;
  getVideoStatus(input: { apiKey: string; requestId: string }): Promise<{ status: VideoTaskStatus; reason?: string; videoUrl?: string }>;
};

export async function submitVideoTask(input: {
  client: Pick<VideoClient, "submitVideo">;
  config: ModelConfig;
  prompt: string;
  script: string;
}): Promise<VideoTask> {
  if (!input.config.apiKey || !input.config.modelName) {
    throw new Error("视频模型配置不完整，请先在设置页填写 API Key 和模型名。");
  }
  const now = new Date().toISOString();
  const requestId = await input.client.submitVideo({
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    prompt: input.prompt
  });

  return {
    id: randomUUID(),
    requestId,
    status: "InQueue",
    prompt: input.prompt,
    script: input.script,
    createdAt: now,
    updatedAt: now
  };
}

export async function pollVideoUntilDone(input: {
  client: Pick<VideoClient, "getVideoStatus">;
  apiKey: string;
  requestId: string;
  intervalMs: number;
  maxAttempts: number;
}): Promise<{ status: VideoTaskStatus; reason?: string; videoUrl?: string }> {
  for (let attempt = 0; attempt < input.maxAttempts; attempt += 1) {
    const status = await input.client.getVideoStatus({ apiKey: input.apiKey, requestId: input.requestId });
    if (status.status === "Succeed" || status.status === "Failed") return status;
    await delay(input.intervalMs);
  }
  return { status: "Failed", reason: "视频生成轮询超时，请稍后重新检查任务状态。" };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/videoService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/main/videoService.ts tests/main/videoService.test.ts
git commit -m "feat: track siliconflow video tasks"
```

Expected: commit created.

## Task 7: Demo Plan Analysis Service

**Files:**
- Create: `src/main/demo/analyzePrompt.ts`
- Create: `src/main/demo/demoService.ts`
- Test: `tests/main/demoService.test.ts`

- [ ] **Step 1: Write failing demo service tests**

Create `tests/main/demoService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeProblemForDemo, chooseDemoRenderer } from "../../src/main/demo/demoService";

describe("analyzeProblemForDemo", () => {
  it("parses equation demo plans", async () => {
    const client = {
      chatCompletion: async () => JSON.stringify({
        kind: "equation",
        title: "买笔问题",
        originalProblem: "每支笔 2 元，共 10 元，买了几支？",
        knownValues: [{ label: "单价", value: 2, unit: "元" }, { label: "总价", value: 10, unit: "元" }],
        target: "购买数量",
        steps: ["设买了 x 支", "2x=10", "x=5"],
        equation: {
          variable: "x",
          relationship: "总价 = 单价 × 数量",
          expression: "2x = 10",
          solution: "x = 5",
          verification: "2 × 5 = 10"
        }
      })
    };

    const plan = await analyzeProblemForDemo({
      problem: "每支笔 2 元，共 10 元，买了几支？",
      config: { apiKey: "key", modelName: "Qwen/Qwen3-32B" },
      client
    });

    expect(plan.kind).toBe("equation");
  });
});

describe("chooseDemoRenderer", () => {
  it("chooses high quality renderers for motion and equation", () => {
    expect(chooseDemoRenderer({ kind: "motion" })).toBe("motion");
    expect(chooseDemoRenderer({ kind: "equation" })).toBe("equation");
    expect(chooseDemoRenderer({ kind: "geometry" })).toBe("simple");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/demoService.test.ts
```

Expected: FAIL because `src/main/demo/demoService.ts` does not exist.

- [ ] **Step 3: Implement demo analysis prompt**

Create `src/main/demo/analyzePrompt.ts`:

```ts
export function buildAnalyzeProblemPrompt(problem: string) {
  return [
    {
      role: "system" as const,
      content: [
        "你是一个数学题可视化教学设计助手。",
        "请把题目解析成用于本地互动网页的 JSON。",
        "kind 只能是 motion, equation, engineering, geometry, simple。",
        "路程/速度/时间题使用 motion。方程应用题使用 equation。",
        "只返回 JSON，不要使用 Markdown 代码块。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: `题目：${problem}`
    }
  ];
}
```

- [ ] **Step 4: Implement demo service**

Create `src/main/demo/demoService.ts`:

```ts
import { problemDemoPlanSchema } from "../../shared/schemas";
import type { ModelConfig, ProblemDemoPlan } from "../../shared/types";
import { buildAnalyzeProblemPrompt } from "./analyzePrompt";

type DemoClient = {
  chatCompletion(input: { apiKey: string; modelName: string; messages: ReturnType<typeof buildAnalyzeProblemPrompt> }): Promise<string>;
};

export async function analyzeProblemForDemo(input: {
  problem: string;
  config: ModelConfig;
  client: DemoClient;
}): Promise<ProblemDemoPlan> {
  if (!input.config.apiKey || !input.config.modelName) {
    throw new Error("文本模型配置不完整，请先在设置页填写 API Key 和模型名。");
  }

  const raw = await input.client.chatCompletion({
    apiKey: input.config.apiKey,
    modelName: input.config.modelName,
    messages: buildAnalyzeProblemPrompt(input.problem)
  });

  return problemDemoPlanSchema.parse(JSON.parse(stripCodeFence(raw)));
}

export function chooseDemoRenderer(plan: Pick<ProblemDemoPlan, "kind">): "motion" | "equation" | "simple" {
  if (plan.kind === "motion") return "motion";
  if (plan.kind === "equation") return "equation";
  return "simple";
}

function stripCodeFence(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/demoService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/main/demo/analyzePrompt.ts src/main/demo/demoService.ts tests/main/demoService.test.ts
git commit -m "feat: analyze math problems for demos"
```

Expected: commit created.

## Task 8: High-Quality Motion Demo Renderer

**Files:**
- Create: `src/main/demo/renderMotionDemo.ts`
- Test: `tests/main/renderMotionDemo.test.ts`

- [ ] **Step 1: Write failing motion renderer test**

Create `tests/main/renderMotionDemo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderMotionDemoHtml } from "../../src/main/demo/renderMotionDemo";

describe("renderMotionDemoHtml", () => {
  it("renders distance, speed, timer, and playback controls", () => {
    const html = renderMotionDemoHtml({
      kind: "motion",
      title: "小明走完全程",
      originalProblem: "A/B 两地相距 1000m，小明速度 2m/s。",
      knownValues: [],
      target: "求时间",
      steps: ["1000 ÷ 2 = 500"],
      motion: {
        startLabel: "A 地",
        endLabel: "B 地",
        distance: 1000,
        distanceUnit: "m",
        speed: 2,
        speedUnit: "m/s",
        answerSeconds: 500
      }
    });

    expect(html).toContain("1000m");
    expect(html).toContain("2m/s");
    expect(html).toContain("开始");
    expect(html).toContain("重播");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/renderMotionDemo.test.ts
```

Expected: FAIL because `src/main/demo/renderMotionDemo.ts` does not exist.

- [ ] **Step 3: Implement motion renderer**

Create `src/main/demo/renderMotionDemo.ts`:

```ts
import type { ProblemDemoPlan } from "../../shared/types";

export function renderMotionDemoHtml(plan: ProblemDemoPlan): string {
  if (!plan.motion) throw new Error("motion demo requires motion data");
  const motion = plan.motion;
  const escapedTitle = escapeHtml(plan.title);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f7fafc; color: #172033; }
    main { max-width: 1000px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 10px; font-size: 30px; }
    .problem { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; }
    .track { position: relative; margin: 44px 0 18px; height: 120px; border-bottom: 6px solid #2f6fed; }
    .point { position: absolute; bottom: -32px; font-weight: 700; }
    .point.end { right: 0; }
    .walker { position: absolute; left: 0; bottom: 4px; width: 44px; height: 44px; border-radius: 50%; background: #f59e0b; display: grid; place-items: center; transition: left 120ms linear; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .stat { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 12px; }
    button { height: 40px; padding: 0 16px; border: 0; border-radius: 6px; background: #1f7a5a; color: white; font-weight: 700; cursor: pointer; }
    .steps { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin-top: 14px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapedTitle}</h1>
    <div class="problem">${escapeHtml(plan.originalProblem)}</div>
    <section class="track" aria-label="运动轨迹">
      <div class="walker" id="walker">小明</div>
      <div class="point">${escapeHtml(motion.startLabel)}</div>
      <div class="point end">${escapeHtml(motion.endLabel)}</div>
    </section>
    <section class="stats">
      <div class="stat">距离：<strong>${motion.distance}${escapeHtml(motion.distanceUnit)}</strong></div>
      <div class="stat">速度：<strong>${motion.speed}${escapeHtml(motion.speedUnit)}</strong></div>
      <div class="stat">计时：<strong id="timer">0</strong>s</div>
      <div class="stat">答案：<strong>${motion.answerSeconds}s</strong></div>
    </section>
    <p>
      <button id="start">开始</button>
      <button id="pause">暂停</button>
      <button id="replay">重播</button>
    </p>
    <section class="steps">
      <h2>计算过程</h2>
      <ol>${plan.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    </section>
  </main>
  <script>
    const total = ${motion.answerSeconds};
    let elapsed = 0;
    let timerId = null;
    const walker = document.getElementById("walker");
    const timer = document.getElementById("timer");
    function render() {
      const progress = Math.min(elapsed / total, 1);
      walker.style.left = "calc(" + (progress * 100) + "% - " + (progress * 44) + "px)";
      timer.textContent = Math.round(elapsed).toString();
    }
    function tick() {
      elapsed = Math.min(total, elapsed + total / 200);
      render();
      if (elapsed >= total && timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }
    document.getElementById("start").onclick = () => { if (!timerId) timerId = setInterval(tick, 50); };
    document.getElementById("pause").onclick = () => { if (timerId) clearInterval(timerId); timerId = null; };
    document.getElementById("replay").onclick = () => { elapsed = 0; render(); };
    render();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/renderMotionDemo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/main/demo/renderMotionDemo.ts tests/main/renderMotionDemo.test.ts
git commit -m "feat: render motion problem demos"
```

Expected: commit created.

## Task 9: High-Quality Equation Demo Renderer

**Files:**
- Create: `src/main/demo/renderEquationDemo.ts`
- Test: `tests/main/renderEquationDemo.test.ts`

- [ ] **Step 1: Write failing equation renderer test**

Create `tests/main/renderEquationDemo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderEquationDemoHtml } from "../../src/main/demo/renderEquationDemo";

describe("renderEquationDemoHtml", () => {
  it("renders variable, relationship, equation, solution, and next-step control", () => {
    const html = renderEquationDemoHtml({
      kind: "equation",
      title: "买笔问题",
      originalProblem: "每支笔 2 元，共 10 元，买了几支？",
      knownValues: [],
      target: "求数量",
      steps: ["设买了 x 支", "2x = 10", "x = 5"],
      equation: {
        variable: "x",
        relationship: "总价 = 单价 × 数量",
        expression: "2x = 10",
        solution: "x = 5",
        verification: "2 × 5 = 10"
      }
    });

    expect(html).toContain("设未知量");
    expect(html).toContain("总价 = 单价 × 数量");
    expect(html).toContain("下一步");
    expect(html).toContain("检验");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/renderEquationDemo.test.ts
```

Expected: FAIL because `src/main/demo/renderEquationDemo.ts` does not exist.

- [ ] **Step 3: Implement equation renderer**

Create `src/main/demo/renderEquationDemo.ts`:

```ts
import type { ProblemDemoPlan } from "../../shared/types";

export function renderEquationDemoHtml(plan: ProblemDemoPlan): string {
  if (!plan.equation) throw new Error("equation demo requires equation data");
  const equation = plan.equation;
  const cards = [
    { title: "设未知量", body: `设 ${escapeHtml(equation.variable)} 表示题目要求的未知量。` },
    { title: "找等量关系", body: escapeHtml(equation.relationship) },
    { title: "列方程", body: escapeHtml(equation.expression) },
    { title: "求解", body: escapeHtml(equation.solution) },
    { title: "检验", body: escapeHtml(equation.verification) }
  ];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(plan.title)}</title>
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #fbf7ef; color: #1f2937; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 10px; font-size: 30px; }
    .problem { background: white; border: 1px solid #e3d7c4; border-radius: 8px; padding: 14px; }
    .balance { display: grid; grid-template-columns: 1fr 80px 1fr; align-items: end; gap: 12px; margin: 28px 0; }
    .pan { min-height: 90px; background: white; border: 2px solid #ba7c24; border-radius: 8px; display: grid; place-items: center; font-size: 24px; font-weight: 700; }
    .stand { height: 120px; border-left: 6px solid #7c4a03; justify-self: center; }
    .card { display: none; background: white; border: 1px solid #e3d7c4; border-radius: 8px; padding: 16px; min-height: 110px; }
    .card.active { display: block; }
    .steps { display: flex; gap: 8px; margin: 16px 0; }
    .dot { width: 34px; height: 34px; border-radius: 50%; border: 1px solid #c8b79f; display: grid; place-items: center; background: white; }
    .dot.active { background: #1f7a5a; color: white; border-color: #1f7a5a; }
    button { height: 40px; padding: 0 16px; border: 0; border-radius: 6px; background: #1f7a5a; color: white; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(plan.title)}</h1>
    <div class="problem">${escapeHtml(plan.originalProblem)}</div>
    <section class="balance" aria-label="方程天平">
      <div class="pan">${escapeHtml(equation.expression.split("=")[0]?.trim() || equation.variable)}</div>
      <div class="stand"></div>
      <div class="pan">${escapeHtml(equation.expression.split("=")[1]?.trim() || equation.solution)}</div>
    </section>
    <div class="steps">${cards.map((_, index) => `<div class="dot" id="dot-${index}">${index + 1}</div>`).join("")}</div>
    ${cards.map((card, index) => `<section class="card" id="card-${index}"><h2>${card.title}</h2><p>${card.body}</p></section>`).join("")}
    <p><button id="prev">上一步</button> <button id="next">下一步</button></p>
  </main>
  <script>
    let index = 0;
    const total = ${cards.length};
    function render() {
      for (let i = 0; i < total; i++) {
        document.getElementById("card-" + i).classList.toggle("active", i === index);
        document.getElementById("dot-" + i).classList.toggle("active", i <= index);
      }
    }
    document.getElementById("prev").onclick = () => { index = Math.max(0, index - 1); render(); };
    document.getElementById("next").onclick = () => { index = Math.min(total - 1, index + 1); render(); };
    render();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/renderEquationDemo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/main/demo/renderEquationDemo.ts tests/main/renderEquationDemo.test.ts
git commit -m "feat: render equation problem demos"
```

Expected: commit created.

## Task 10: Simple Demo Renderer and Demo Server

**Files:**
- Create: `src/main/demo/renderSimpleDemo.ts`
- Create: `src/main/demo/demoServer.ts`
- Test: `tests/e2e/demo-render.spec.ts`

- [ ] **Step 1: Write failing Playwright demo test**

Create `tests/e2e/demo-render.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDemoServer } from "../../src/main/demo/demoServer";

test("serves a generated demo page", async ({ page }) => {
  const dir = await mkdtemp(join(tmpdir(), "teacherhelper-demo-"));
  try {
    await writeFile(join(dir, "index.html"), "<!doctype html><title>Demo</title><button>开始</button>", "utf-8");
    const server = await startDemoServer(dir);
    try {
      await page.goto(server.url);
      await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
    } finally {
      await server.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm run test:e2e -- tests/e2e/demo-render.spec.ts
```

Expected: FAIL because `src/main/demo/demoServer.ts` does not exist.

- [ ] **Step 3: Implement simple renderer**

Create `src/main/demo/renderSimpleDemo.ts`:

```ts
import type { ProblemDemoPlan } from "../../shared/types";

export function renderSimpleDemoHtml(plan: ProblemDemoPlan): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(plan.title)}</title>
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f6f8fb; color: #1f2937; }
    main { max-width: 900px; margin: 0 auto; padding: 28px; }
    .card { background: white; border: 1px solid #dbe3ef; border-radius: 8px; padding: 16px; margin: 12px 0; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(plan.title)}</h1>
    <section class="card">${escapeHtml(plan.originalProblem)}</section>
    <section class="card"><h2>已知条件</h2><ul>${plan.knownValues.map((item) => `<li>${escapeHtml(item.label)}：${escapeHtml(String(item.value))}${escapeHtml(item.unit ?? "")}</li>`).join("")}</ul></section>
    <section class="card"><h2>讲解步骤</h2><ol>${plan.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}
```

- [ ] **Step 4: Implement demo server**

Create `src/main/demo/demoServer.ts`:

```ts
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

export async function startDemoServer(rootDir: string): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer(async (request, response) => {
    const pathname = request.url && request.url !== "/" ? request.url : "/index.html";
    const filePath = normalize(join(rootDir, pathname));
    if (!filePath.startsWith(normalize(rootDir))) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const content = await readFile(filePath);
      response.writeHead(200, { "Content-Type": contentType(filePath) });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to start demo server");

  return {
    url: `http://localhost:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}
```

- [ ] **Step 5: Run test to verify GREEN**

Run:

```powershell
npm run test:e2e -- tests/e2e/demo-render.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/main/demo/renderSimpleDemo.ts src/main/demo/demoServer.ts tests/e2e/demo-render.spec.ts
git commit -m "feat: serve generated demo pages"
```

Expected: commit created.

## Task 11: History Store

**Files:**
- Create: `src/main/jsonStore.ts`
- Create: `src/main/historyStore.ts`
- Test: `tests/main/historyStore.test.ts`

- [ ] **Step 1: Write failing history tests**

Create `tests/main/historyStore.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHistoryStore } from "../../src/main/historyStore";

let tempDir = "";

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe("createHistoryStore", () => {
  it("adds and lists lesson records newest first", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await store.addLesson({ id: "1", title: "A", topic: "a", createdAt: "2026-01-01T00:00:00.000Z" });
    await store.addLesson({ id: "2", title: "B", topic: "b", createdAt: "2026-01-02T00:00:00.000Z" });

    await expect(store.listLessons()).resolves.toEqual([
      { id: "2", title: "B", topic: "b", createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "1", title: "A", topic: "a", createdAt: "2026-01-01T00:00:00.000Z" }
    ]);
  });

  it("upserts and lists video task records", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-history-"));
    const store = createHistoryStore(tempDir);

    await store.upsertVideo({
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "req-1",
      status: "InQueue",
      prompt: "prompt",
      script: "script",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    await store.upsertVideo({
      id: "video-1",
      lessonId: "lesson-1",
      requestId: "req-1",
      status: "Succeed",
      prompt: "prompt",
      script: "script",
      videoUrl: "https://video.example/a.mp4",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z"
    });

    const videos = await store.listVideos();
    expect(videos).toHaveLength(1);
    expect(videos[0].status).toBe("Succeed");
    expect(videos[0].videoUrl).toBe("https://video.example/a.mp4");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/historyStore.test.ts
```

Expected: FAIL because `src/main/historyStore.ts` does not exist.

- [ ] **Step 3: Implement JSON store helper**

Create `src/main/jsonStore.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}
```

- [ ] **Step 4: Implement history store**

Create `src/main/historyStore.ts`:

```ts
import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "./jsonStore";

export type LessonRecord = {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  markdown?: string;
  wordPath?: string;
};

export type DemoRecord = {
  id: string;
  title: string;
  problem: string;
  kind: string;
  demoPath: string;
  createdAt: string;
};

export type VideoRecord = {
  id: string;
  lessonId: string;
  requestId: string;
  status: string;
  prompt: string;
  script: string;
  videoUrl?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

type HistoryData = {
  lessons: LessonRecord[];
  demos: DemoRecord[];
  videos: VideoRecord[];
};

export function createHistoryStore(baseDir: string) {
  const filePath = join(baseDir, "history.json");

  async function load(): Promise<HistoryData> {
    return readJsonFile(filePath, { lessons: [], demos: [], videos: [] });
  }

  async function save(data: HistoryData): Promise<void> {
    await writeJsonFile(filePath, data);
  }

  return {
    async addLesson(record: LessonRecord): Promise<void> {
      const data = await load();
      data.lessons = [record, ...data.lessons.filter((item) => item.id !== record.id)];
      await save(data);
    },

    async listLessons(): Promise<LessonRecord[]> {
      const data = await load();
      return [...data.lessons].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async addDemo(record: DemoRecord): Promise<void> {
      const data = await load();
      data.demos = [record, ...data.demos.filter((item) => item.id !== record.id)];
      await save(data);
    },

    async listDemos(): Promise<DemoRecord[]> {
      const data = await load();
      return [...data.demos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async upsertVideo(record: VideoRecord): Promise<void> {
      const data = await load();
      data.videos = [record, ...data.videos.filter((item) => item.id !== record.id)];
      await save(data);
    },

    async listVideos(): Promise<VideoRecord[]> {
      const data = await load();
      return [...data.videos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  };
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/historyStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/main/jsonStore.ts src/main/historyStore.ts tests/main/historyStore.test.ts
git commit -m "feat: persist lesson and demo history"
```

Expected: commit created.

## Task 12: Lesson-to-Video Workflow

**Files:**
- Create: `src/main/videoWorkflow.ts`
- Test: `tests/main/videoWorkflow.test.ts`

- [ ] **Step 1: Write failing workflow test**

Create `tests/main/videoWorkflow.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createVideoTaskFromLesson } from "../../src/main/videoWorkflow";

describe("createVideoTaskFromLesson", () => {
  it("uses lesson video prompt and script to submit a video task", async () => {
    const client = { submitVideo: vi.fn().mockResolvedValue("req-lesson-video") };

    const task = await createVideoTaskFromLesson({
      lessonId: "lesson-1",
      lesson: {
        title: "方程题",
        grade_suggestion: "七年级",
        teaching_goals: ["会列方程"],
        key_points: ["等量关系"],
        difficult_points: ["设未知量"],
        common_confusions: ["单位"],
        lesson_flow: [{ title: "导入", minutes: 5, activities: ["提问"] }],
        board_design: ["x"],
        example_questions: [{ question: "题", answer: "答" }],
        worked_solutions: [{ question: "题", steps: ["设 x"], answer: "答" }],
        classroom_questions: ["为什么？"],
        homework_suggestions: ["练习"],
        video_script: "用天平展示方程两边相等。",
        video_prompt: "A classroom animation showing equation balance.",
        markdown: "# 方程题"
      },
      config: { apiKey: "video-key", modelName: "Wan-AI/Wan2.2-T2V-A14B" },
      client
    });

    expect(task.lessonId).toBe("lesson-1");
    expect(task.requestId).toBe("req-lesson-video");
    expect(task.prompt).toBe("A classroom animation showing equation balance.");
    expect(task.script).toBe("用天平展示方程两边相等。");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm run test:run -- tests/main/videoWorkflow.test.ts
```

Expected: FAIL because `src/main/videoWorkflow.ts` does not exist.

- [ ] **Step 3: Implement workflow helper**

Create `src/main/videoWorkflow.ts`:

```ts
import type { LessonPlan, ModelConfig } from "../shared/types";
import type { VideoRecord } from "./historyStore";
import { submitVideoTask } from "./videoService";

type VideoSubmitClient = {
  submitVideo(input: { apiKey: string; modelName: string; prompt: string }): Promise<string>;
};

export async function createVideoTaskFromLesson(input: {
  lessonId: string;
  lesson: LessonPlan;
  config: ModelConfig;
  client: VideoSubmitClient;
}): Promise<VideoRecord> {
  const task = await submitVideoTask({
    client: input.client,
    config: input.config,
    prompt: input.lesson.video_prompt,
    script: input.lesson.video_script
  });

  return {
    id: task.id,
    lessonId: input.lessonId,
    requestId: task.requestId,
    status: task.status,
    prompt: task.prompt,
    script: task.script,
    videoUrl: task.videoUrl,
    reason: task.reason,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm run test:run -- tests/main/videoWorkflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/main/videoWorkflow.ts tests/main/videoWorkflow.test.ts
git commit -m "feat: create video tasks from lessons"
```

Expected: commit created.

## Task 13: Electron IPC and Desktop Shell

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/ipc.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Electron scripts**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "tsc -p tsconfig.node.json && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "lint": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json"
  }
}
```

- [ ] **Step 2: Create IPC handlers**

Create `electron/ipc.ts`:

```ts
import { ipcMain } from "electron";
import { getAppDataDir } from "../src/main/paths";
import { createConfigStore } from "../src/main/configStore";

export function registerIpcHandlers(): void {
  const configStore = createConfigStore(getAppDataDir());

  ipcMain.handle("settings:load", () => configStore.load());
  ipcMain.handle("settings:save", (_event, settings) => configStore.save(settings));
  ipcMain.handle("settings:clear", () => configStore.clear());
}
```

- [ ] **Step 3: Create preload bridge**

Create `electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings } from "../src/shared/types";

const api = {
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke("settings:save", settings),
  clearSettings: (): Promise<void> => ipcRenderer.invoke("settings:clear")
};

contextBridge.exposeInMainWorld("teacherHelper", api);

export type TeacherHelperApi = typeof api;
```

- [ ] **Step 4: Create Electron main entry**

Create `electron/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { registerIpcHandlers } from "./ipc";

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await win.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 5: Run TypeScript verification**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add electron/main.ts electron/preload.ts electron/ipc.ts package.json
git commit -m "feat: add electron desktop shell"
```

Expected: commit created.

## Task 14: React Shell and Settings Page

**Files:**
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/api.ts`
- Create: `src/renderer/pages/SettingsPage.tsx`
- Create: `src/renderer/styles.css`

- [ ] **Step 1: Create renderer API wrapper**

Create `src/renderer/api.ts`:

```ts
import type { TeacherHelperApi } from "../../electron/preload";

declare global {
  interface Window {
    teacherHelper: TeacherHelperApi;
  }
}

export const api = window.teacherHelper;
```

- [ ] **Step 2: Create settings page**

Create `src/renderer/pages/SettingsPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { AppSettings } from "../../shared/types";
import { api } from "../api";

const emptySettings: AppSettings = {
  textModel: { apiKey: "", modelName: "" },
  videoModel: { apiKey: "", modelName: "" }
};

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(emptySettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.loadSettings().then(setSettings).catch((error) => setMessage(String(error)));
  }, []);

  async function save() {
    await api.saveSettings(settings);
    setMessage("设置已保存到本机。");
  }

  async function clear() {
    await api.clearSettings();
    setSettings(emptySettings);
    setMessage("本地设置已清空。");
  }

  return (
    <section className="panel">
      <h1>设置</h1>
      <div className="form-grid">
        <label>文本 API Key<input type="password" value={settings.textModel.apiKey} onChange={(event) => setSettings({ ...settings, textModel: { ...settings.textModel, apiKey: event.target.value } })} /></label>
        <label>文本模型名<input value={settings.textModel.modelName} onChange={(event) => setSettings({ ...settings, textModel: { ...settings.textModel, modelName: event.target.value } })} /></label>
        <label>视频 API Key<input type="password" value={settings.videoModel.apiKey} onChange={(event) => setSettings({ ...settings, videoModel: { ...settings.videoModel, apiKey: event.target.value } })} /></label>
        <label>视频模型名<input value={settings.videoModel.modelName} onChange={(event) => setSettings({ ...settings, videoModel: { ...settings.videoModel, modelName: event.target.value } })} /></label>
      </div>
      <div className="actions">
        <button onClick={save}>保存</button>
        <button className="secondary" onClick={clear}>清空</button>
      </div>
      {message && <p className="status">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Create app shell**

Create `src/renderer/App.tsx`:

```tsx
import { useState } from "react";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "lesson" | "demo" | "history" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("lesson");

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>teacherHelper</h1>
        <button onClick={() => setPage("lesson")}>今日备课</button>
        <button onClick={() => setPage("demo")}>题目演示</button>
        <button onClick={() => setPage("history")}>历史记录</button>
        <button onClick={() => setPage("settings")}>设置</button>
      </aside>
      <section className="workspace">
        {page === "settings" ? <SettingsPage /> : <section className="panel"><h1>{pageName(page)}</h1></section>}
      </section>
    </main>
  );
}

function pageName(page: Page): string {
  return { lesson: "今日备课", demo: "题目演示", history: "历史记录", settings: "设置" }[page];
}
```

- [ ] **Step 4: Create renderer entry and styles**

Create `src/renderer/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/renderer/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>teacherHelper</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/main.tsx"></script>
</body>
</html>
```

Create `src/renderer/styles.css`:

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; color: #172033; background: #f4f7fb; }
button { height: 36px; border: 0; border-radius: 6px; background: #1f7a5a; color: white; font-weight: 700; cursor: pointer; }
button.secondary { background: #617084; }
input, textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 10px; font: inherit; }
.app-shell { min-height: 100vh; display: grid; grid-template-columns: 210px 1fr; }
.sidebar { background: #182235; color: white; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.sidebar h1 { font-size: 22px; margin: 0 0 12px; }
.sidebar button { background: transparent; text-align: left; border: 1px solid rgba(255,255,255,.18); }
.workspace { padding: 22px; }
.panel { background: white; border: 1px solid #d8e0ea; border-radius: 8px; padding: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.actions { display: flex; gap: 10px; margin-top: 16px; }
.status { color: #1f7a5a; }
```

- [ ] **Step 5: Run build and lint**

Run:

```powershell
npm run lint
npm run build
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/renderer
git commit -m "feat: add desktop workspace shell"
```

Expected: commit created.

## Task 15: Wire Lesson, Video, Demo, and History Pages Through IPC

**Files:**
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/renderer/api.ts`
- Modify: `src/renderer/pages/LessonPage.tsx`
- Modify: `src/renderer/pages/DemoPage.tsx`
- Modify: `src/renderer/pages/HistoryPage.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add IPC handlers for app workflows**

Modify `electron/ipc.ts`:

```ts
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ipcMain, shell } from "electron";
import { getAppDataDir } from "../src/main/paths";
import { createConfigStore } from "../src/main/configStore";
import { createHistoryStore } from "../src/main/historyStore";
import { createSiliconFlowClient } from "../src/main/siliconflowClient";
import { generateLessonPlan } from "../src/main/lessonService";
import { exportLessonDocx } from "../src/main/docxExporter";
import { createVideoTaskFromLesson } from "../src/main/videoWorkflow";
import { analyzeProblemForDemo, chooseDemoRenderer } from "../src/main/demo/demoService";
import { renderMotionDemoHtml } from "../src/main/demo/renderMotionDemo";
import { renderEquationDemoHtml } from "../src/main/demo/renderEquationDemo";
import { renderSimpleDemoHtml } from "../src/main/demo/renderSimpleDemo";
import { startDemoServer } from "../src/main/demo/demoServer";

let activeDemoServer: Awaited<ReturnType<typeof startDemoServer>> | undefined;

export function registerIpcHandlers(): void {
  const dataDir = getAppDataDir();
  const configStore = createConfigStore(dataDir);
  const historyStore = createHistoryStore(dataDir);
  const client = createSiliconFlowClient();

  ipcMain.handle("settings:load", () => configStore.load());
  ipcMain.handle("settings:save", (_event, settings) => configStore.save(settings));
  ipcMain.handle("settings:clear", () => configStore.clear());

  ipcMain.handle("lesson:generate", async (_event, topic: string) => {
    const settings = await configStore.load();
    const lesson = await generateLessonPlan({ topic, config: settings.textModel, client });
    const id = randomUUID();
    await historyStore.addLesson({ id, title: lesson.title, topic, markdown: lesson.markdown, createdAt: new Date().toISOString() });
    let videoTask = undefined;
    if (settings.videoModel.apiKey && settings.videoModel.modelName) {
      videoTask = await createVideoTaskFromLesson({ lessonId: id, lesson, config: settings.videoModel, client });
      await historyStore.upsertVideo(videoTask);
    }
    return { id, lesson, videoTask };
  });

  ipcMain.handle("lesson:exportDocx", async (_event, input: { id: string; title: string; lesson: any }) => {
    const filePath = join(dataDir, "exports", `${safeName(input.title)}.docx`);
    await mkdir(join(dataDir, "exports"), { recursive: true });
    await exportLessonDocx({ filePath, lesson: input.lesson });
    return filePath;
  });

  ipcMain.handle("demo:generate", async (_event, problem: string) => {
    const settings = await configStore.load();
    const plan = await analyzeProblemForDemo({ problem, config: settings.textModel, client });
    const renderer = chooseDemoRenderer(plan);
    const html = renderer === "motion" ? renderMotionDemoHtml(plan) : renderer === "equation" ? renderEquationDemoHtml(plan) : renderSimpleDemoHtml(plan);
    const id = randomUUID();
    const demoDir = join(dataDir, "demos", id);
    await mkdir(demoDir, { recursive: true });
    await writeFile(join(demoDir, "index.html"), html, "utf-8");
    if (activeDemoServer) await activeDemoServer.close();
    activeDemoServer = await startDemoServer(demoDir);
    await historyStore.addDemo({ id, title: plan.title, problem, kind: plan.kind, demoPath: demoDir, createdAt: new Date().toISOString() });
    await shell.openExternal(activeDemoServer.url);
    return { id, plan, url: activeDemoServer.url };
  });

  ipcMain.handle("history:list", async () => ({
    lessons: await historyStore.listLessons(),
    demos: await historyStore.listDemos(),
    videos: await historyStore.listVideos()
  }));
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}
```

- [ ] **Step 2: Update preload bridge**

Modify `electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, LessonPlan, ProblemDemoPlan } from "../src/shared/types";

const api = {
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke("settings:save", settings),
  clearSettings: (): Promise<void> => ipcRenderer.invoke("settings:clear"),
  generateLesson: (topic: string): Promise<{ id: string; lesson: LessonPlan; videoTask?: unknown }> => ipcRenderer.invoke("lesson:generate", topic),
  exportLessonDocx: (input: { id: string; title: string; lesson: LessonPlan }): Promise<string> => ipcRenderer.invoke("lesson:exportDocx", input),
  generateDemo: (problem: string): Promise<{ id: string; plan: ProblemDemoPlan; url: string }> => ipcRenderer.invoke("demo:generate", problem),
  listHistory: (): Promise<{ lessons: unknown[]; demos: unknown[]; videos: unknown[] }> => ipcRenderer.invoke("history:list")
};

contextBridge.exposeInMainWorld("teacherHelper", api);

export type TeacherHelperApi = typeof api;
```

- [ ] **Step 3: Create lesson page**

Create `src/renderer/pages/LessonPage.tsx`:

```tsx
import { useState } from "react";
import type { LessonPlan } from "../../shared/types";
import { api } from "../api";

export function LessonPage() {
  const [topic, setTopic] = useState("");
  const [lesson, setLesson] = useState<LessonPlan | null>(null);
  const [recordId, setRecordId] = useState("");
  const [status, setStatus] = useState("");

  async function generate() {
    setStatus("正在生成教案...");
    const result = await api.generateLesson(topic);
    setLesson(result.lesson);
    setRecordId(result.id);
    setStatus(result.videoTask ? "教案已生成，视频任务已提交。" : "教案已生成。视频模型未配置，已保留视频脚本和提示词。");
  }

  async function exportDocx() {
    if (!lesson) return;
    const path = await api.exportLessonDocx({ id: recordId, title: lesson.title, lesson });
    setStatus(`Word 已导出：${path}`);
  }

  async function copyMarkdown() {
    if (!lesson) return;
    await navigator.clipboard.writeText(lesson.markdown);
    setStatus("Markdown 已复制。");
  }

  return (
    <section className="panel">
      <h1>今日备课</h1>
      <textarea rows={4} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="输入教学知识点，例如：一元一次方程" />
      <div className="actions">
        <button onClick={generate}>生成教案</button>
        <button className="secondary" onClick={copyMarkdown} disabled={!lesson}>复制 Markdown</button>
        <button className="secondary" onClick={exportDocx} disabled={!lesson}>导出 Word</button>
      </div>
      {status && <p className="status">{status}</p>}
      {lesson && <article className="result"><pre>{lesson.markdown}</pre></article>}
    </section>
  );
}
```

- [ ] **Step 4: Create demo and history pages**

Create `src/renderer/pages/DemoPage.tsx`:

```tsx
import { useState } from "react";
import { api } from "../api";

export function DemoPage() {
  const [problem, setProblem] = useState("");
  const [status, setStatus] = useState("");

  async function generate() {
    setStatus("正在生成演示页...");
    const result = await api.generateDemo(problem);
    setStatus(`演示页已打开：${result.url}`);
  }

  return (
    <section className="panel">
      <h1>题目演示</h1>
      <textarea rows={5} value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="输入数学应用题，例如：A/B 两地相距 1000m，小明速度是 2m/s..." />
      <div className="actions"><button onClick={generate}>生成并打开演示页</button></div>
      {status && <p className="status">{status}</p>}
    </section>
  );
}
```

Create `src/renderer/pages/HistoryPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api } from "../api";

export function HistoryPage() {
  const [history, setHistory] = useState<{ lessons: any[]; demos: any[]; videos: any[] }>({ lessons: [], demos: [], videos: [] });

  useEffect(() => {
    api.listHistory().then((value) => setHistory(value as { lessons: any[]; demos: any[]; videos: any[] }));
  }, []);

  return (
    <section className="panel">
      <h1>历史记录</h1>
      <h2>教案</h2>
      <ul>{history.lessons.map((item) => <li key={item.id}>{item.title} - {item.createdAt}</li>)}</ul>
      <h2>演示页</h2>
      <ul>{history.demos.map((item) => <li key={item.id}>{item.title} - {item.kind}</li>)}</ul>
      <h2>视频任务</h2>
      <ul>{history.videos.map((item) => <li key={item.id}>{item.status} - {item.requestId}</li>)}</ul>
    </section>
  );
}
```

- [ ] **Step 5: Update app shell page routing**

Modify `src/renderer/App.tsx`:

```tsx
import { useState } from "react";
import { DemoPage } from "./pages/DemoPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LessonPage } from "./pages/LessonPage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "lesson" | "demo" | "history" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("lesson");

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>teacherHelper</h1>
        <button onClick={() => setPage("lesson")}>今日备课</button>
        <button onClick={() => setPage("demo")}>题目演示</button>
        <button onClick={() => setPage("history")}>历史记录</button>
        <button onClick={() => setPage("settings")}>设置</button>
      </aside>
      <section className="workspace">
        {page === "lesson" && <LessonPage />}
        {page === "demo" && <DemoPage />}
        {page === "history" && <HistoryPage />}
        {page === "settings" && <SettingsPage />}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Run verification**

Run:

```powershell
npm run test:run
npm run lint
npm run build
```

Expected: all commands PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add electron src/renderer
git commit -m "feat: wire teacher workflows into desktop app"
```

Expected: commit created.

## Task 16: Final Verification and Windows Manual Check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

````md
# teacherHelper

teacherHelper is a Windows desktop app for teachers. It generates structured lesson plans, exports Markdown and Word files, submits SiliconFlow video generation tasks, and creates localhost interactive demos for math word problems.

## Development

```powershell
npm install
npm run dev
```

## Verification

```powershell
npm run test:run
npm run test:e2e
npm run lint
npm run build
```

## SiliconFlow Settings

Open Settings in the app and fill in:

- Text API Key
- Text model name
- Video API Key
- Video model name
````

- [ ] **Step 2: Run full automated verification**

Run:

```powershell
npm run test:run
npm run test:e2e
npm run lint
npm run build
```

Expected: all commands PASS with exit code 0.

- [ ] **Step 3: Run desktop app locally**

Run:

```powershell
npm run dev
```

Expected: Electron window opens with left navigation and Settings page can save local settings.

- [ ] **Step 4: Manual lesson check**

In the desktop app:

```text
知识点：一元一次方程
```

Expected:

- 教案生成成功。
- 页面显示重点、难点、疑点、例题、解法、视频脚本和视频提示词。
- Markdown copy button copies complete lesson Markdown.
- Word export writes a `.docx` file under local app data.
- If video model settings are complete, History shows a video task with status and `requestId`.

- [ ] **Step 5: Manual motion demo check**

In the desktop app:

```text
A/B 两地相距 1000m，小明的速度是 2m/s，那小明走完全程需要几秒？
```

Expected:

- localhost demo opens.
- Distance is shown as `1000m`.
- Speed is shown as `2m/s`.
- Start, pause, and replay controls work.
- Final answer shows `500s`.

- [ ] **Step 6: Manual equation demo check**

In the desktop app:

```text
每支钢笔 2 元，小明一共花了 10 元，他买了几支钢笔？
```

Expected:

- localhost demo opens.
- Demo shows setting unknown variable.
- Demo shows equality relationship.
- Demo shows equation `2x = 10` or equivalent.
- Next-step button reveals solve and verification steps.

- [ ] **Step 7: Commit README and final fixes**

Run:

```powershell
git add README.md
git commit -m "docs: add teacherhelper development guide"
```

Expected: commit created.

## Self-Review

Spec coverage:

- Windows desktop app: covered by Tasks 0, 13, 14, 15, 16.
- Local settings for two SiliconFlow model groups: covered by Tasks 2, 3, 13, 14, 15.
- Lesson plan generation with complete sections: covered by Tasks 1, 4, 5, 12, 15, 16.
- Markdown copy and Word export: covered by Tasks 4, 5, 15, 16.
- Video submit and status tracking service: covered by Tasks 3, 6, 11, 12, 15, 16.
- High-quality motion template: covered by Tasks 7, 8, 10, 15, 16.
- High-quality equation template: covered by Tasks 7, 9, 10, 15, 16.
- Simple engineering and geometry fallback: covered by Tasks 7 and 10.
- Local history: covered by Tasks 11 and 15.

Placeholder scan:

- No placeholder markers or empty task sections are intentionally present.
- Each code-changing step includes concrete file content or exact code replacement.

Type consistency:

- `AppSettings`, `LessonPlan`, `ProblemDemoPlan`, `VideoTask`, and `VideoTaskStatus` are defined in Task 1 and reused consistently in later tasks.
- `createSiliconFlowClient`, `generateLessonPlan`, `analyzeProblemForDemo`, `renderMotionDemoHtml`, `renderEquationDemoHtml`, `renderSimpleDemoHtml`, and `startDemoServer` names are consistent across tests, services, and IPC.
