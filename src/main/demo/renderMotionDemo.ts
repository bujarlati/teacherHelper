import type { ProblemDemoPlan } from "../../shared/types.js";

export function renderMotionDemoHtml(plan: ProblemDemoPlan): string {
  const motion = plan.motion;
  if (!motion) {
    throw new Error("motion demo requires motion data");
  }

  const knownValues = plan.knownValues
    .map((item) => {
      const unit = item.unit ? escapeHtml(item.unit) : "";
      return `<li><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}${unit}</strong></li>`;
    })
    .join("");
  const steps = plan.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const duration = Math.max(motion.answerSeconds, 1);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(plan.title)}</title>
  <style>
    :root {
      color: #172033;
      background: #f7f8fb;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #f7f8fb;
    }

    main {
      width: min(960px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.25;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 18px;
    }

    .problem {
      margin: 0 0 24px;
      color: #405069;
      line-height: 1.7;
    }

    .panel {
      margin-bottom: 20px;
      border: 1px solid #dfe4ee;
      border-radius: 8px;
      background: #ffffff;
      padding: 20px;
      box-shadow: 0 10px 30px rgb(23 32 51 / 8%);
    }

    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .facts li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid #e6eaf2;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fbfcff;
    }

    .scene {
      display: grid;
      gap: 18px;
    }

    .labels {
      display: flex;
      justify-content: space-between;
      color: #59677d;
      font-weight: 600;
    }

    .track {
      position: relative;
      height: 94px;
      border-radius: 8px;
      background: linear-gradient(#dce8f8, #eef4fb);
      overflow: hidden;
    }

    .track::before {
      content: "";
      position: absolute;
      left: 40px;
      right: 40px;
      top: 55px;
      height: 6px;
      border-radius: 999px;
      background: #93a7c0;
    }

    .walker {
      position: absolute;
      left: 40px;
      top: 22px;
      width: 64px;
      height: 44px;
      border-radius: 8px;
      background: #ffcf5a;
      color: #172033;
      display: grid;
      place-items: center;
      font-weight: 700;
      transform: translateX(0);
      transition: transform 120ms linear;
      z-index: 1;
    }

    .metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
    }

    .timer {
      font-size: 22px;
      font-weight: 700;
      color: #0f766e;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    button {
      min-width: 76px;
      border: 1px solid #b8c3d6;
      border-radius: 8px;
      background: #ffffff;
      color: #172033;
      padding: 10px 14px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    button.primary {
      border-color: #0f766e;
      background: #0f766e;
      color: #ffffff;
    }

    .steps {
      margin: 0;
      padding-left: 22px;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(plan.title)}</h1>
    <p class="problem">${escapeHtml(plan.originalProblem)}</p>

    <section class="panel" aria-labelledby="known-values-title">
      <h2 id="known-values-title">已知条件</h2>
      <ul class="facts">
        ${knownValues}
        <li><span>路程</span><strong>${escapeHtml(String(motion.distance))}${escapeHtml(motion.distanceUnit)}</strong></li>
        <li><span>速度</span><strong>${escapeHtml(String(motion.speed))}${escapeHtml(motion.speedUnit)}</strong></li>
      </ul>
    </section>

    <section class="panel scene" aria-labelledby="motion-scene-title">
      <h2 id="motion-scene-title">小明沿轨道移动</h2>
      <div class="labels">
        <span>${escapeHtml(motion.startLabel)}</span>
        <span>${escapeHtml(motion.endLabel)}</span>
      </div>
      <div id="track" class="track">
        <div id="walker" class="walker">小明</div>
      </div>
      <div class="metrics">
        <div id="timer" class="timer">计时：0.0 秒</div>
        <div class="controls">
          <button id="start-button" class="primary" type="button">开始</button>
          <button id="pause-button" type="button">暂停</button>
          <button id="replay-button" type="button">重播</button>
        </div>
      </div>
    </section>

    <section class="panel" aria-labelledby="steps-title">
      <h2 id="steps-title">计算步骤</h2>
      <ol class="steps">
        ${steps}
      </ol>
      <p><strong>答案：</strong>${escapeHtml(String(motion.answerSeconds))} 秒</p>
    </section>
  </main>

  <script>
    const totalSeconds = ${JSON.stringify(duration)};
    const timer = document.getElementById("timer");
    const walker = document.getElementById("walker");
    const track = document.getElementById("track");
    const startButton = document.getElementById("start-button");
    const pauseButton = document.getElementById("pause-button");
    const replayButton = document.getElementById("replay-button");
    let startedAt = 0;
    let elapsed = 0;
    let frameId = 0;
    let running = false;

    function maxTravel() {
      return Math.max(track.clientWidth - walker.clientWidth - 80, 0);
    }

    function render() {
      const progress = Math.min(elapsed / totalSeconds, 1);
      timer.textContent = "计时：" + elapsed.toFixed(1) + " 秒";
      walker.style.transform = "translateX(" + Math.round(progress * maxTravel()) + "px)";
    }

    function tick(now) {
      elapsed = Math.min((now - startedAt) / 1000, totalSeconds);
      render();
      if (elapsed < totalSeconds && running) {
        frameId = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    startButton.addEventListener("click", () => {
      if (running) return;
      running = true;
      startedAt = performance.now() - elapsed * 1000;
      frameId = requestAnimationFrame(tick);
    });

    pauseButton.addEventListener("click", () => {
      running = false;
      cancelAnimationFrame(frameId);
    });

    replayButton.addEventListener("click", () => {
      running = false;
      cancelAnimationFrame(frameId);
      elapsed = 0;
      render();
      startButton.click();
    });

    window.addEventListener("resize", render);
    render();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
