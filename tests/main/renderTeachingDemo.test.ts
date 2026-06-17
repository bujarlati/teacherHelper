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

  test("generated controls execute in the browser document", () => {
    const html = renderTeachingDemoHtml({
      title: "一次函数复习",
      prompt: "A classroom animation for y=kx+b with slope and intercept.",
      script: "观察 k 改变时图像如何转动。\n拖动 b 观察截距变化。\n判断斜率为正时图像的变化趋势。"
    });
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    const document = dom.window.document;

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
