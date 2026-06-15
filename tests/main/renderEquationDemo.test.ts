import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { renderEquationDemoHtml } from "../../src/main/demo/renderEquationDemo";
import type { ProblemDemoPlan } from "../../src/shared/types";

type JsdomWindow = Window & typeof globalThis;
type JsdomInstance = {
  window: JsdomWindow;
};
type JsdomConstructor = new (
  html: string,
  options: {
    pretendToBeVisual?: boolean;
    runScripts?: "dangerously";
  }
) => JsdomInstance;

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom") as { JSDOM: JsdomConstructor };

function equationPlan(overrides: Partial<ProblemDemoPlan> = {}): ProblemDemoPlan {
  return {
    kind: "equation",
    title: "文具盒价格问题",
    originalProblem: "买 3 个同样的文具盒共 45 元，每个文具盒多少元？",
    knownValues: [
      { label: "数量", value: 3, unit: "个" },
      { label: "总价", value: 45, unit: "元" }
    ],
    target: "求每个文具盒的单价",
    steps: ["设每个文具盒 x 元", "总价 = 单价 × 数量", "3x = 45", "x = 15", "15 × 3 = 45"],
    equation: {
      variable: "设每个文具盒 x 元",
      relationship: "总价 = 单价 × 数量",
      expression: "3x = 45",
      solution: "x = 15",
      verification: "15 × 3 = 45，符合题意"
    },
    ...overrides
  };
}

describe("renderEquationDemoHtml", () => {
  it("renders variable, relationship, equation, solution, verification, and next-step control", () => {
    const html = renderEquationDemoHtml(equationPlan());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("设未知量");
    expect(html).toContain("总价 = 单价 × 数量");
    expect(html).toContain("3x = 45");
    expect(html).toContain("x = 15");
    expect(html).toContain("检验");
    expect(html).toContain("下一步");
  });

  it("throws when equation data is missing", () => {
    const plan = equationPlan({ equation: undefined });

    expect(() => renderEquationDemoHtml(plan)).toThrow("equation demo requires equation data");
  });

  it("escapes title, problem, relationship, expression, solution, verification, and steps", () => {
    const html = renderEquationDemoHtml(
      equationPlan({
        title: "标题 <script>alert('x')</script>",
        originalProblem: "题目 <img src=x onerror=alert(1)>",
        steps: ["步骤 <script>bad()</script>", "比较 3 < 5 且 6 > 4"],
        equation: {
          variable: "设 <script>v()</script>",
          relationship: "关系 <script>rel()</script>",
          expression: "式子 <script>eq()</script>",
          solution: "解 <script>solve()</script>",
          verification: "检验 <script>check()</script>"
        }
      })
    );

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("<script>bad()</script>");
    expect(html).not.toContain("<script>v()</script>");
    expect(html).not.toContain("<script>rel()</script>");
    expect(html).not.toContain("<script>eq()</script>");
    expect(html).not.toContain("<script>solve()</script>");
    expect(html).not.toContain("<script>check()</script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("比较 3 &lt; 5 且 6 &gt; 4");
    expect(html).toContain("设 &lt;script&gt;v()&lt;/script&gt;");
    expect(html).toContain("关系 &lt;script&gt;rel()&lt;/script&gt;");
    expect(html).toContain("式子 &lt;script&gt;eq()&lt;/script&gt;");
    expect(html).toContain("解 &lt;script&gt;solve()&lt;/script&gt;");
    expect(html).toContain("检验 &lt;script&gt;check()&lt;/script&gt;");
  });

  it("includes stable controls, cards, and progress dots for browser checks", () => {
    const html = renderEquationDemoHtml(equationPlan());

    expect(html).toContain('id="prev"');
    expect(html).toContain('id="next"');
    expect(html).toContain('id="card-0"');
    expect(html).toContain('id="card-4"');
    expect(html).toContain('id="dot-0"');
    expect(html).toContain('id="dot-4"');
  });

  it("runs generated step controls in the browser script", () => {
    const dom = new JSDOM(renderEquationDemoHtml(equationPlan()), {
      pretendToBeVisual: true,
      runScripts: "dangerously"
    });
    const document = dom.window.document;
    const next = document.getElementById("next") as HTMLButtonElement | null;
    const prev = document.getElementById("prev") as HTMLButtonElement | null;

    expect(document.getElementById("card-0")?.hidden).toBe(false);
    expect(document.getElementById("card-1")?.hidden).toBe(true);

    next?.click();

    expect(document.getElementById("card-0")?.hidden).toBe(true);
    expect(document.getElementById("card-1")?.hidden).toBe(false);

    next?.click();
    next?.click();
    next?.click();

    expect(document.getElementById("card-4")?.hidden).toBe(false);
    expect(document.getElementById("card-4")?.textContent).toContain("检验");

    prev?.click();

    expect(document.getElementById("card-3")?.hidden).toBe(false);
    expect(document.getElementById("card-4")?.hidden).toBe(true);
  });
});
