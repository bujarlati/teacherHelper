import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { LessonPlan } from "../shared/types.js";

export async function exportLessonDocx(input: { filePath: string; lesson: LessonPlan }): Promise<void> {
  const { filePath, lesson } = input;
  const doc = new Document({
    sections: [
      {
        children: [
          heading(lesson.title, 32),
          paragraph(`建议年级：${lesson.grade_suggestion}`),
          sectionHeading("教学目标"),
          ...bullets(lesson.teaching_goals),
          sectionHeading("教学重点"),
          ...bullets(lesson.key_points),
          sectionHeading("教学难点"),
          ...bullets(lesson.difficult_points),
          sectionHeading("易混疑点"),
          ...bullets(lesson.common_confusions),
          sectionHeading("教学流程"),
          ...bullets(
            lesson.lesson_flow.map((item) => `${item.title}（${item.minutes} 分钟）：${item.activities.join("；")}`)
          ),
          sectionHeading("板书设计"),
          ...bullets(lesson.board_design),
          sectionHeading("例题"),
          ...lesson.example_questions.flatMap((item) => [
            paragraph(`题目：${item.question}`),
            paragraph(`答案：${item.answer}`)
          ]),
          sectionHeading("示例解法"),
          ...lesson.worked_solutions.flatMap((item) => [
            paragraph(`题目：${item.question}`),
            ...item.steps.map((step, index) => paragraph(`${index + 1}. ${step}`)),
            paragraph(`答案：${item.answer}`)
          ]),
          sectionHeading("课堂提问"),
          ...bullets(lesson.classroom_questions),
          sectionHeading("作业建议"),
          ...bullets(lesson.homework_suggestions),
          sectionHeading("视频脚本"),
          paragraph(lesson.video_script),
          sectionHeading("视频提示词"),
          paragraph(lesson.video_prompt)
        ]
      }
    ]
  });

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, await Packer.toBuffer(doc));
}

function sectionHeading(text: string): Paragraph {
  return heading(text, 24);
}

function heading(text: string, size: number): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size })],
    spacing: { after: 160 }
  });
}

function paragraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 }
  });
}

function bullets(items: string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        children: [new TextRun({ text: item, size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 80 }
      })
  );
}
