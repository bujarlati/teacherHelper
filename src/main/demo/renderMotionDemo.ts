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
  const answer = createMotionAnswer(plan);
  const playbackSeconds = 6;
  const realTimeLabel = formatDuration(motion.answerSeconds);
  const sceneActor = inferSceneActor(plan.originalProblem);

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

    .facts span,
    .facts strong {
      min-width: 0;
      overflow-wrap: anywhere;
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

    .time-note {
      color: #59677d;
      font-size: 14px;
      line-height: 1.6;
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
      <h2 id="motion-scene-title">${escapeHtml(sceneActor)}沿轨道移动</h2>
      <div class="labels">
        <span>${escapeHtml(motion.startLabel)}</span>
        <span>${escapeHtml(motion.endLabel)}</span>
      </div>
      <div id="track" class="track">
        <div id="walker" class="walker">${escapeHtml(sceneActor)}</div>
      </div>
      <div class="metrics">
        <div>
          <div id="timer" class="timer">演示：0.0 秒</div>
          <div class="time-note">真实用时：${escapeHtml(realTimeLabel)}，课堂演示压缩为 ${escapeHtml(String(playbackSeconds))} 秒。</div>
        </div>
        <div class="controls">
          <button id="start" class="primary" type="button">开始</button>
          <button id="pause" type="button">暂停</button>
          <button id="replay" type="button">重播</button>
        </div>
      </div>
    </section>

    <section class="panel" aria-labelledby="steps-title">
      <h2 id="steps-title">计算步骤</h2>
      <ol class="steps">
        ${steps}
      </ol>
      <p><strong>答案：</strong>${escapeHtml(answer)}</p>
    </section>
  </main>

  <script>
    const playbackSeconds = ${JSON.stringify(playbackSeconds)};
    const realSeconds = ${JSON.stringify(motion.answerSeconds)};
    const timer = document.getElementById("timer");
    const walker = document.getElementById("walker");
    const track = document.getElementById("track");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const replayButton = document.getElementById("replay");
    let startedAt = 0;
    let elapsed = 0;
    let frameId = 0;
    let running = false;

    function maxTravel() {
      return Math.max(track.clientWidth - walker.clientWidth - 80, 0);
    }

    function render() {
      const progress = Math.min(elapsed / playbackSeconds, 1);
      timer.textContent = "演示：" + elapsed.toFixed(1) + " 秒";
      walker.style.transform = "translateX(" + Math.round(progress * maxTravel()) + "px)";
    }

    function tick(now) {
      elapsed = Math.min((now - startedAt) / 1000, playbackSeconds);
      render();
      if (elapsed < playbackSeconds && running) {
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

function createMotionAnswer(plan: ProblemDemoPlan): string {
  const motion = plan.motion;
  if (!motion) {
    return "";
  }

  if (motion.answerValue !== undefined && motion.answerUnit?.trim()) {
    return formatQuantity(motion.answerValue, motion.answerUnit);
  }

  const target = motion.targetQuantity ?? inferMotionTarget(plan.target);
  if (target === "distance") {
    return formatQuantity(motion.distance, motion.distanceUnit);
  }

  if (target === "speed") {
    return formatQuantity(motion.speed, motion.speedUnit);
  }

  return formatQuantity(formatNumber(motion.answerSeconds), "秒");
}

function inferMotionTarget(target: string): "time" | "distance" | "speed" {
  if (/距离|路程|相距|间距/.test(target)) {
    return "distance";
  }

  if (/速度|每小时|每秒|速率/.test(target)) {
    return "speed";
  }

  return "time";
}

function inferSceneActor(problem: string): string {
  if (/汽车|车|客车|货车|小车/.test(problem)) {
    return "汽车";
  }

  if (/船/.test(problem)) {
    return "小船";
  }

  if (/飞机/.test(problem)) {
    return "飞机";
  }

  return "小明";
}

function formatQuantity(value: number | string, unit: string): string {
  const displayValue = typeof value === "number" ? formatNumber(value) : value.trim();
  const displayUnit = unit.trim();

  return displayUnit ? `${displayValue} ${displayUnit}` : displayValue;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number(value.toFixed(2)));
}

function formatDuration(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return `${formatNumber(seconds / 3600)} 小时（${formatNumber(seconds)} 秒）`;
  }

  if (seconds >= 60 && seconds % 60 === 0) {
    return `${formatNumber(seconds / 60)} 分钟（${formatNumber(seconds)} 秒）`;
  }

  return `${formatNumber(seconds)} 秒`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
