import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { exportLessonDocx } from "../../src/main/docxExporter";
import type { LessonPlan } from "../../src/shared/types";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function completeLessonPlan(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    title: "一元一次方程",
    grade_suggestion: "七年级",
    teaching_goals: ["理解一元一次方程的意义", "会用等式性质解简单方程"],
    key_points: ["找等量关系", "规范列方程"],
    difficult_points: ["从实际情境中设未知量"],
    common_confusions: ["漏写单位", "移项忘记变号"],
    lesson_flow: [
      { title: "情境导入", minutes: 5, activities: ["用天平情境引出等式平衡"] },
      { title: "例题讲解", minutes: 15, activities: ["设未知数", "列方程", "解方程"] }
    ],
    board_design: ["设未知数", "列方程", "解方程", "检验"],
    example_questions: [{ question: "小明买笔共花 10 元，每支 2 元，买了几支？", answer: "5 支" }],
    worked_solutions: [
      {
        question: "2x + 3 = 11",
        steps: ["两边同时减 3，得 2x = 8", "两边同时除以 2，得 x = 4"],
        answer: "x = 4"
      }
    ],
    classroom_questions: ["为什么等式两边要做同样的运算？"],
    homework_suggestions: ["完成 3 道列方程解决实际问题"],
    video_script: "展示天平两边保持平衡，逐步消去砝码。",
    video_prompt: "A clean classroom animation showing balance scale equation solving.",
    markdown: "# 旧 Markdown 不应作为 DOCX 数据源",
    ...overrides
  };
}

describe("exportLessonDocx", () => {
  it("writes a non-empty docx file at the provided path", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-docx-"));
    const filePath = join(tempDir, "custom-lesson.docx");

    await exportLessonDocx({ filePath, lesson: completeLessonPlan() });

    const buffer = await readFile(filePath);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(basename(filePath)).toBe("custom-lesson.docx");
  });

  it("creates a zip-based docx that includes structured lesson content", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-docx-"));
    const filePath = join(tempDir, "lesson.docx");

    await exportLessonDocx({ filePath, lesson: completeLessonPlan() });

    const buffer = await readFile(filePath);
    expect(buffer.subarray(0, 2).toString("utf-8")).toBe("PK");

    const documentXml = readZipEntry(buffer, "word/document.xml");
    expect(documentXml).toContain("一元一次方程");
    expect(documentXml).toContain("找等量关系");
    expect(documentXml).toContain("展示天平两边保持平衡");
  });

  it("uses only the supplied file path for export output", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-docx-"));
    const outputDir = join(tempDir, "chosen-output");
    const filePath = join(outputDir, "chosen.docx");

    await exportLessonDocx({ filePath, lesson: completeLessonPlan() });

    await expect(readFile(filePath)).resolves.toBeInstanceOf(Buffer);
    await expect(readdir(tempDir)).resolves.toEqual(["chosen-output"]);
  });
});

function readZipEntry(buffer: Buffer, entryName: string): string {
  let offset = 0;

  while (offset < buffer.byteLength - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = buffer.subarray(fileNameStart, fileNameEnd).toString("utf-8");
    const dataStart = fileNameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (fileName === entryName) {
      const compressed = buffer.subarray(dataStart, dataEnd);
      if (compressionMethod === 0) return compressed.toString("utf-8");
      if (compressionMethod === 8) return inflateRawSync(compressed).toString("utf-8");
      throw new Error(`Unsupported ZIP compression method ${compressionMethod}`);
    }

    offset = dataEnd;
  }

  throw new Error(`ZIP entry not found: ${entryName}`);
}
