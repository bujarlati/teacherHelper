import { describe, expect, it } from "vitest";
import { renderSimpleDemoHtml } from "../../src/main/demo/renderSimpleDemo";
import type { ProblemDemoPlan } from "../../src/shared/types";

function simplePlan(overrides: Partial<ProblemDemoPlan> = {}): ProblemDemoPlan {
  return {
    kind: "engineering",
    title: "水池注水问题",
    originalProblem: "一个水池每小时注水 12 吨，3 小时可以注水多少吨？",
    knownValues: [
      { label: "每小时注水量", value: 12, unit: "吨" },
      { label: "时间", value: 3, unit: "小时" }
    ],
    target: "求总注水量",
    steps: ["总量 = 每小时注水量 × 时间", "12 × 3 = 36", "答：可以注水 36 吨"],
    ...overrides
  };
}

describe("renderSimpleDemoHtml", () => {
  it("renders the problem, known values, target, and worked steps", () => {
    const html = renderSimpleDemoHtml(simplePlan());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("水池注水问题");
    expect(html).toContain("工程题");
    expect(html).toContain("一个水池每小时注水 12 吨");
    expect(html).toContain("每小时注水量");
    expect(html).toContain("12吨");
    expect(html).toContain("时间");
    expect(html).toContain("3小时");
    expect(html).toContain("求总注水量");
    expect(html).toContain("总量 = 每小时注水量 × 时间");
    expect(html).toContain("答：可以注水 36 吨");
  });

  it("uses kind-specific labels for geometry and generic demos", () => {
    expect(renderSimpleDemoHtml(simplePlan({ kind: "geometry" }))).toContain("几何题");
    expect(renderSimpleDemoHtml(simplePlan({ kind: "simple" }))).toContain("通用演示");
  });

  it("escapes all text from the plan instead of rendering raw HTML", () => {
    const html = renderSimpleDemoHtml(
      simplePlan({
        title: "标题 <script>alert('x')</script>",
        originalProblem: "题目 <img src=x onerror=alert(1)>",
        knownValues: [
          { label: "标签 <script>l()</script>", value: "值 <b>1</b>", unit: "<kg>" }
        ],
        target: "目标 <script>t()</script>",
        steps: ["步骤 <script>bad()</script>", "比较 3 < 5 且 6 > 4"]
      })
    );

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<script>l()</script>");
    expect(html).not.toContain("<b>1</b>");
    expect(html).not.toContain("<script>t()</script>");
    expect(html).not.toContain("<script>bad()</script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("标签 &lt;script&gt;l()&lt;/script&gt;");
    expect(html).toContain("值 &lt;b&gt;1&lt;/b&gt;&lt;kg&gt;");
    expect(html).toContain("目标 &lt;script&gt;t()&lt;/script&gt;");
    expect(html).toContain("比较 3 &lt; 5 且 6 &gt; 4");
  });
});
