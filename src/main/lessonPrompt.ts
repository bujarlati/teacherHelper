export function buildLessonPrompt(topic: string) {
  return [
    {
      role: "system" as const,
      content: [
        "你是一个经验丰富的中国中小学数学老师。",
        "请根据用户输入的知识点生成完整、可直接用于课堂的结构化教案 JSON。",
        "只返回 JSON，不要使用 Markdown 代码块，不要添加解释文字。",
        "JSON 必须包含：title, grade_suggestion, teaching_goals, key_points, difficult_points, common_confusions, lesson_flow, board_design, example_questions, worked_solutions, classroom_questions, homework_suggestions, video_script, video_prompt。",
        "lesson_flow 每一项必须包含 title, minutes, activities。",
        "worked_solutions 每一项必须包含 question, steps, answer。",
        "video_script 用中文写成可朗读的短视频讲解脚本，video_prompt 用英文描述适合生成教学动画的视频画面。",
        "控制输出体量：每个数组 3 到 5 项，步骤清晰但不要长篇铺陈，确保完整 JSON 能在 4096 tokens 内结束。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: `知识点：${topic}`
    }
  ];
}
