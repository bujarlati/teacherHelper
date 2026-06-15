import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { renderMotionDemoHtml } from "../../src/main/demo/renderMotionDemo";
import type { ProblemDemoPlan } from "../../src/shared/types";

type JsdomWindow = Window & typeof globalThis;
type JsdomInstance = {
  window: JsdomWindow;
};
type JsdomConstructor = new (
  html: string,
  options: {
    beforeParse?: (window: JsdomWindow) => void;
    pretendToBeVisual?: boolean;
    runScripts?: "dangerously";
  }
) => JsdomInstance;

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom") as { JSDOM: JsdomConstructor };

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

  it("uses fractional answer seconds as the animation duration", () => {
    const html = renderMotionDemoHtml(
      motionPlan({
        motion: {
          startLabel: "起点",
          endLabel: "终点",
          distance: 1,
          distanceUnit: "m",
          speed: 2,
          speedUnit: "m/s",
          answerSeconds: 0.5
        }
      })
    );

    expect(html).toContain("const totalSeconds = 0.5;");
    expect(html).not.toContain("const totalSeconds = 1;");
  });

  it("runs generated playback controls in the browser script", () => {
    let now = 0;
    const frames: FrameRequestCallback[] = [];
    const html = renderMotionDemoHtml(
      motionPlan({
        motion: {
          startLabel: "起点",
          endLabel: "终点",
          distance: 1,
          distanceUnit: "m",
          speed: 2,
          speedUnit: "m/s",
          answerSeconds: 0.5
        }
      })
    );

    const dom = new JSDOM(html, {
      pretendToBeVisual: true,
      runScripts: "dangerously",
      beforeParse(window) {
        Object.defineProperty(window.performance, "now", {
          configurable: true,
          value: () => now
        });
        window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
          frames.push(callback);
          return frames.length;
        };
        window.cancelAnimationFrame = () => undefined;
        Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
          configurable: true,
          get() {
            if (this.id === "track") return 240;
            if (this.id === "walker") return 64;

            return 0;
          }
        });
      }
    });
    const document = dom.window.document;
    const timer = document.getElementById("timer");
    const walker = document.getElementById("walker") as HTMLElement | null;
    const start = document.getElementById("start");
    const pause = document.getElementById("pause");
    const replay = document.getElementById("replay");

    expect(timer?.textContent).toBe("计时：0.0 秒");
    expect(walker?.style.transform).toBe("translateX(0px)");

    start?.click();
    now = 250;
    frames.shift()?.(now);

    expect(timer?.textContent).toBe("计时：0.3 秒");
    expect(walker?.style.transform).toBe("translateX(48px)");

    pause?.click();
    replay?.click();

    expect(timer?.textContent).toBe("计时：0.0 秒");
    expect(walker?.style.transform).toBe("translateX(0px)");
  });
});
