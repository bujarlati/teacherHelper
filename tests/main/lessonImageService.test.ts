import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLessonImagePrompts, generateLessonImages } from "../../src/main/lessonImageService";
import type { LessonPlan } from "../../src/shared/types";

const lesson: LessonPlan = {
  title: "A+B 的数轴意义",
  grade_suggestion: "小学高年级",
  teaching_goals: ["理解加法表示连续合并"],
  key_points: ["第二段从第一段终点出发"],
  difficult_points: ["把两段都从 0 出发"],
  common_confusions: ["忽略第一段终点"],
  lesson_flow: [{ title: "导入", minutes: 5, activities: ["观察数轴"] }],
  board_design: ["A+B"],
  example_questions: [{ question: "3+2=?", answer: "5" }],
  worked_solutions: [{ question: "3+2=?", steps: ["先走 3", "再走 2"], answer: "5" }],
  classroom_questions: ["第二段从哪里开始？"],
  homework_suggestions: ["画数轴解释 4+3"],
  video_script: "用数轴演示 A+B。",
  video_prompt: "在数轴上演示 A+B。",
  markdown: "# A+B 的数轴意义"
};

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("lessonImageService", () => {
  it("builds story, scene, and principle prompts for a lesson", () => {
    const prompts = createLessonImagePrompts(lesson);

    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toMatchObject({ title: "故事导入图" });
    expect(prompts.map((item) => item.prompt).join("\n")).toContain("A+B 的数轴意义");
    expect(prompts.map((item) => item.prompt).join("\n")).toContain("适合中小学生");
  });

  it("skips image generation when image settings are incomplete", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-lesson-images-"));
    const client = { createImage: vi.fn() };

    await expect(generateLessonImages({
      lesson,
      lessonId: "lesson-1",
      config: { apiKey: "", modelName: "Tongyi-MAI/Z-Image" },
      client,
      dataDir: tempDir
    })).resolves.toEqual([]);
    expect(client.createImage).not.toHaveBeenCalled();
  });

  it("downloads generated image URLs and returns data URLs for local courseware", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-lesson-images-"));
    const client = {
      createImage: vi.fn()
        .mockResolvedValueOnce({ imageUrl: "https://cdn.example.test/story.png" })
        .mockResolvedValueOnce({ imageUrl: "https://cdn.example.test/scene.png" })
        .mockResolvedValueOnce({ imageUrl: "https://cdn.example.test/principle.png" })
    };
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" }
    }));

    const assets = await generateLessonImages({
      lesson,
      lessonId: "lesson-1",
      config: { apiKey: "image-key", modelName: "Tongyi-MAI/Z-Image" },
      client,
      dataDir: tempDir,
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(assets).toHaveLength(3);
    expect(assets[0]).toMatchObject({
      title: "故事导入图",
      src: "data:image/png;base64,AQID"
    });
    expect(client.createImage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      apiKey: "image-key",
      modelName: "Tongyi-MAI/Z-Image",
      imageSize: "1024x1024"
    }));
    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.test/story.png");
    await expect(readFile(join(tempDir, "lesson-images", "lesson-1-01.png"))).resolves.toEqual(Buffer.from([1, 2, 3]));
  });
});
