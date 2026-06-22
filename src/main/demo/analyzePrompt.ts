export function buildAnalyzeProblemPrompt(problem: string) {
  return [
    {
      role: "system" as const,
      content: [
        "你是一个经验丰富的中国中小学数学老师，负责把数学题分析成课堂演示计划。",
        "请判断题目适合的演示类型：motion、equation、engineering、geometry、simple。",
        "分类规则：路程/速度/时间题 -> motion；方程应用题 -> equation；几何图形题 -> geometry；其他暂不适合专门动画的题 -> simple。",
        "只返回 JSON，不要使用 Markdown 代码块，不要添加解释文字。",
        "JSON 必须包含：kind, title, originalProblem, knownValues, target, steps。",
        "knownValues 可以为空数组，steps 至少给 3 个可课堂展示的步骤。",
        "kind 为 motion 时必须包含 motion：startLabel, endLabel, distance, distanceUnit, speed, speedUnit, answerSeconds。",
        "kind 为 equation 时必须包含 equation：variable, relationship, expression, solution, verification。",
        "无法完整填写 motion 或 equation 时，把 kind 改为 simple，不要返回缺少专用字段的 motion 或 equation。"
      ].join("\n")
    },
    {
      role: "user" as const,
      content: `题目：${problem}`
    }
  ];
}
