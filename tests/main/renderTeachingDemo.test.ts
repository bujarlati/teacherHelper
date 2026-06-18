import { describe, expect, test } from "vitest";
import { JSDOM } from "jsdom";
import { renderTeachingDemoHtml } from "../../src/main/demo/renderTeachingDemo";

describe("renderTeachingDemoHtml", () => {
  test("renders an interactive function courseware for function topics", () => {
    const html = renderTeachingDemoHtml({
      title: "Number line addition",
      prompt: "A classroom animation for 一次函数 y=kx+b with slope and intercept.",
      script: "观察 k 改变时图像如何转动。\n拖动 b 观察截距变化。\n判断斜率为正时图像的变化趋势。"
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("class=\"interactive-courseware\"");
    expect(html).toContain("id=\"prev-step\"");
    expect(html).toContain("id=\"next-step\"");
    expect(html).toContain("id=\"reset-demo\"");
    expect(html).toContain("id=\"teacher-note\"");
    expect(html).toContain("id=\"slope-slider\"");
    expect(html).toContain("id=\"intercept-slider\"");
    expect(html).toContain("function updateFunctionPlot");
    expect(html).toContain("data-correct=\"positive-slope\"");
    expect(html).toContain("观察 k 改变时图像如何转动。");
    expect(html).not.toContain("A classroom animation for 一次函数 y=kx+b with slope and intercept.");
  });

  test("renders a balance interaction for equation topics", () => {
    const html = renderTeachingDemoHtml({
      title: "Equation balance",
      prompt: "用天平演示一元一次方程 3x + 2 = 11",
      script: "先观察左右两边保持平衡。\n两边同时减 2。\n再同时除以 3。"
    });

    expect(html).toContain("data-template=\"balance\"");
    expect(html).toContain("id=\"subtract-weight\"");
    expect(html).toContain("id=\"divide-weight\"");
    expect(html).toContain("function updateBalance");
    expect(html).toContain("两边同时减 2。");
  });

  test("renders a number line interaction for number line topics", () => {
    const html = renderTeachingDemoHtml({
      title: "Number line addition",
      prompt: "在数轴上演示 A+B 的跳跃过程",
      script: "先移动 A。\n再从 A 的终点继续移动 B。\n观察最终位置。"
    });

    expect(html).toContain("data-template=\"number-line\"");
    expect(html).toContain("id=\"first-jump\"");
    expect(html).toContain("id=\"second-jump\"");
    expect(html).toContain("function updateNumberLine");
    expect(html).toContain("再从 A 的终点继续移动 B。");
  });

  test("renders an executable arithmetic interaction for four-operation topics", () => {
    const html = renderTeachingDemoHtml({
      title: "四则运算综合复习",
      prompt: "复习整数四则运算、混合运算和运算顺序",
      script: "同学们好，今天我们来复习四则运算。\n先判断先算哪一步。\n再按顺序完成计算。"
    });
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const document = dom.window.document;

    expect(document.querySelector(".interactive-courseware")?.getAttribute("data-template")).toBe("arithmetic");
    expect(document.querySelector("#arithmetic-expression")?.textContent).toContain("18 ÷ 3 + 4 × 2");

    document.querySelector<HTMLButtonElement>("#arithmetic-next")?.click();
    expect(document.querySelector("#arithmetic-expression")?.textContent).toContain("6 + 4 × 2");
    expect(document.querySelector("#arithmetic-rule")?.textContent).toContain("先算除法");

    document.querySelector<HTMLButtonElement>("#arithmetic-next")?.click();
    expect(document.querySelector("#arithmetic-expression")?.textContent).toContain("6 + 8");

    document.querySelector<HTMLButtonElement>("#arithmetic-answer")?.click();
    expect(document.querySelector("#arithmetic-result")?.textContent).toContain("14");
  });

  test("starts courseware with story and principle before exercises", () => {
    const html = renderTeachingDemoHtml({
      title: "分数加法",
      prompt: "讲解分数加法的意义",
      script: "例题：1/2 + 1/3 怎么算？\n通分后相加。",
      exampleQuestions: [{ question: "1/2 + 1/3 = ?", answer: "5/6" }]
    });
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const document = dom.window.document;
    const cards = Array.from(document.querySelectorAll(".step-card"));

    expect(document.querySelector(".step-card.is-active")?.textContent).toContain("故事导入");
    expect(cards[0]?.textContent).not.toContain("例题：1/2 + 1/3");
    expect(cards[1]?.textContent).toContain("生活场景");
    expect(cards[2]?.textContent).toContain("原理观察");
    expect(cards.some((card) => card.textContent?.includes("例题迁移"))).toBe(true);
  });

  test("generated controls execute in the browser document", () => {
    const html = renderTeachingDemoHtml({
      title: "一次函数复习",
      prompt: "A classroom animation for y=kx+b with slope and intercept.",
      script: "观察 k 改变时图像如何转动。\n拖动 b 观察截距变化。\n判断斜率为正时图像的变化趋势。"
    });
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const document = dom.window.document;

    expect(document.querySelector(".step-card.is-active")?.textContent).toContain("故事导入");

    for (let index = 0; index < 4; index += 1) {
      document.querySelector<HTMLButtonElement>("#next-step")?.click();
    }
    expect(document.querySelector(".step-card.is-active")?.textContent).toContain("观察 k 改变时图像如何转动。");

    document.querySelector<HTMLButtonElement>("#next-step")?.click();
    expect(document.querySelector(".step-card.is-active")?.textContent).toContain("拖动 b 观察截距变化。");

    const line = document.querySelector("#function-line");
    const before = line?.getAttribute("y1");
    const slope = document.querySelector<HTMLInputElement>("#slope-slider");
    if (!slope) throw new Error("missing slope slider");
    slope.value = "2";
    slope.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    expect(line?.getAttribute("y1")).not.toBe(before);

    document.querySelector<HTMLButtonElement>("[data-correct='positive-slope']")?.click();
    expect(document.querySelector("#feedback")?.textContent).toContain("判断正确");
  });

  test("renders lesson examples as executable step-by-step interactions", () => {
    const html = renderTeachingDemoHtml({
      title: "一元一次方程",
      prompt: "用天平演示一元一次方程 3x + 2 = 11",
      script: "观察等式两边。\n两边同时减 2。\n两边同时除以 3。",
      exampleQuestions: [{ question: "3x + 2 = 11，求 x。", answer: "x = 3" }],
      workedSolutions: [{
        question: "3x + 2 = 11，求 x。",
        steps: ["两边同时减 2，得到 3x = 9。", "两边同时除以 3，得到 x = 3。"],
        answer: "x = 3"
      }]
    });
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const document = dom.window.document;

    expect(document.querySelector<HTMLElement>("[data-example-lab]")?.hidden).toBe(true);
    expect(document.querySelector("[data-example-card]")?.textContent).toContain("3x + 2 = 11");
    expect(document.querySelector("[data-example-step-output]")?.textContent).toContain("点击“下一步”");

    for (let index = 0; index < 7; index += 1) {
      document.querySelector<HTMLButtonElement>("#next-step")?.click();
    }
    expect(document.querySelector<HTMLElement>("[data-example-lab]")?.hidden).toBe(false);

    document.querySelector<HTMLButtonElement>("[data-example-next]")?.click();
    expect(document.querySelector("[data-example-step-output]")?.textContent).toContain("两边同时减 2");

    document.querySelector<HTMLButtonElement>("[data-example-next]")?.click();
    expect(document.querySelector("[data-example-step-output]")?.textContent).toContain("两边同时除以 3");

    document.querySelector<HTMLButtonElement>("[data-example-answer]")?.click();
    expect(document.querySelector("[data-example-answer-output]")?.textContent).toContain("x = 3");
  });

  test("escapes unsafe text from prompts and scripts", () => {
    const html = renderTeachingDemoHtml({
      title: "<script>alert(1)</script>",
      prompt: "Compare 1 < 2 and 3 > 2.",
      script: "Use \"labels\" and don't run <img src=x onerror=alert(1)>."
    });

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("Compare 1 &lt; 2 and 3 &gt; 2.");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
