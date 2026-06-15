import { describe, expect, it } from "vitest";
import { renderMotionDemoHtml } from "../../src/main/demo/renderMotionDemo";
import type { ProblemDemoPlan } from "../../src/shared/types";

function motionPlan(overrides: Partial<ProblemDemoPlan> = {}): ProblemDemoPlan {
  return {
    kind: "motion",
    title: "小明上学路程",
    originalProblem: "小明从家到学校的路程是 1000m，速度是 2m/s，需要多少秒？",
    knownValues: [
      { label: "路程", value: 1000, unit: "m" },
      { label: "速度", value: 2, unit: "m/s" }
    ],
    target: "求所用时间",
    steps: ["时间 = 路程 ÷ 速度", "1000 ÷ 2 = 500", "答：需要 500 秒"],
    motion: {
      startLabel: "家",
      endLabel: "学校",
      distance: 1000,
      distanceUnit: "m",
      speed: 2,
      speedUnit: "m/s",
      answerSeconds: 500
    },
    ...overrides
  };
}

describe("renderMotionDemoHtml", () => {
  it("renders distance, speed, timer, playback controls, and worked steps", () => {
    const html = renderMotionDemoHtml(motionPlan());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("1000m");
    expect(html).toContain("2m/s");
    expect(html).toContain("开始");
    expect(html).toContain("暂停");
    expect(html).toContain("重播");
    expect(html).toContain("小明");
    expect(html).toContain("时间 = 路程 ÷ 速度");
    expect(html).toContain("500 秒");
  });

  it("throws when motion data is missing", () => {
    const plan = motionPlan({ motion: undefined });

    expect(() => renderMotionDemoHtml(plan)).toThrow("motion demo requires motion data");
  });

  it("escapes title, problem, and steps instead of rendering raw HTML", () => {
    const html = renderMotionDemoHtml(
      motionPlan({
        title: "标题 <script>alert('x')</script>",
        originalProblem: "题目 <img src=x onerror=alert(1)>",
        steps: ["步骤 <script>bad()</script>", "比较 3 < 5 且 6 > 4"]
      })
    );

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<script>bad()</script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("比较 3 &lt; 5 且 6 &gt; 4");
  });

  it("includes stable controls and scene elements for future browser checks", () => {
    const html = renderMotionDemoHtml(motionPlan());

    expect(html).toContain('id="start"');
    expect(html).toContain('id="pause"');
    expect(html).toContain('id="replay"');
    expect(html).toContain('id="timer"');
    expect(html).toContain('id="walker"');
    expect(html).toContain('id="track"');
  });
});
