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
  const steps = plan.steps
    .map((step, index) => `<li data-step-index="${index}">${escapeHtml(step)}</li>`)
    .join("");
  const stepData = toScriptJson(plan.steps);
  const answer = createMotionAnswer(plan);
  const answerLabel = createMotionAnswerLabel(plan);
  const playbackSeconds = 6;
  const realTimeLabel = formatDuration(motion.answerSeconds);
  const sceneActor = inferSceneActor(plan.originalProblem);
  const relationBoard = createMotionRelationBoard(plan, sceneActor);

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

    .teaching-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
      gap: 16px;
      align-items: stretch;
    }

    .stage {
      position: relative;
      min-height: 150px;
    }

    .labels {
      display: flex;
      justify-content: space-between;
      color: #59677d;
      font-weight: 600;
    }

    .track {
      position: relative;
      height: 150px;
      border-radius: 8px;
      background: linear-gradient(#dce8f8, #eef4fb);
      overflow: hidden;
    }

    .track::before {
      content: "";
      position: absolute;
      left: 40px;
      right: 40px;
      top: 88px;
      height: 6px;
      border-radius: 999px;
      background: #93a7c0;
    }

    .walker {
      position: absolute;
      left: 40px;
      top: 54px;
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

    .drag-marker {
      position: absolute;
      left: calc(50% - 34px);
      top: 18px;
      z-index: 3;
      width: 68px;
      border: 1px solid #2563eb;
      border-radius: 8px;
      background: #ffffff;
      color: #1d4ed8;
      padding: 6px 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      cursor: grab;
      user-select: none;
      box-shadow: 0 8px 20px rgb(37 99 235 / 18%);
    }

    .annotation-canvas {
      position: absolute;
      inset: 0;
      z-index: 4;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .stage.draw-mode .annotation-canvas {
      pointer-events: auto;
      cursor: crosshair;
    }

    .relation-board {
      position: relative;
      display: grid;
      gap: 14px;
      border: 1px solid #d8e2f0;
      border-radius: 8px;
      background: #f8fbff;
      padding: 16px;
      min-height: 260px;
      overflow: hidden;
    }

    .route-summary {
      display: grid;
      gap: 10px;
    }

    .route-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #24324a;
      font-weight: 700;
      line-height: 1.5;
    }

    .route-distance {
      color: #0f766e;
      white-space: nowrap;
    }

    .step-card {
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: #fbfcff;
      padding: 16px;
      display: grid;
      gap: 10px;
      align-content: start;
    }

    .step-label {
      color: #0f766e;
      font-size: 13px;
      font-weight: 700;
    }

    .step-focus {
      margin: 0;
      color: #172033;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.7;
    }

    .teacher-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .relation-lanes {
      display: grid;
      gap: 10px;
    }

    .relation-lane {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    .lane-label {
      color: #172033;
      font-weight: 700;
    }

    .lane-track {
      border: 1px solid #dde7f3;
      border-radius: 8px;
      background: #ffffff;
      padding: 10px 12px;
    }

    .lane-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      color: #405069;
      font-size: 14px;
      line-height: 1.5;
    }

    .lane-bar {
      height: 10px;
      margin-top: 8px;
      border-radius: 999px;
      background: #dbeafe;
      overflow: hidden;
    }

    .lane-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #0f766e;
    }

    .lane-bar.slow span {
      width: 54%;
      background: #f59e0b;
    }

    .lane-bar.fast span {
      width: 82%;
    }

    .relationship-note {
      border-left: 4px solid #0f766e;
      background: #eefcf8;
      border-radius: 8px;
      padding: 12px 14px;
      color: #172033;
      line-height: 1.7;
      font-weight: 700;
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

    .steps li[data-active="true"] {
      color: #0f766e;
      font-weight: 700;
    }

    @media (max-width: 760px) {
      .teaching-grid {
        grid-template-columns: 1fr;
      }
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
      <h2 id="motion-scene-title">数量关系对比</h2>
      <div class="teaching-grid">
        <div id="stage" class="stage">
          ${relationBoard}
          <canvas id="annotation-canvas" class="annotation-canvas" aria-label="课堂批注画板"></canvas>
        </div>
        <aside class="step-card" aria-label="当前讲解步骤">
          <div id="step-label" class="step-label">步骤 1 / ${escapeHtml(String(Math.max(plan.steps.length, 1)))}</div>
          <p id="step-focus" class="step-focus">${escapeHtml(plan.steps[0] ?? "先观察题目条件。")}</p>
          <div class="teacher-tools">
            <button id="prev-step" type="button">上一步</button>
            <button id="next-step" class="primary" type="button">下一步</button>
            <button id="pen-toggle" type="button">画笔</button>
            <button id="clear-annotations" type="button">清空批注</button>
          </div>
        </aside>
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
      <p><strong>${escapeHtml(answerLabel)}：</strong>${escapeHtml(answer)}</p>
    </section>
  </main>

  <script>
    const teachingSteps = ${stepData};
    const playbackSeconds = ${JSON.stringify(playbackSeconds)};
    const realSeconds = ${JSON.stringify(motion.answerSeconds)};
    const timer = document.getElementById("timer");
    const walker = document.getElementById("walker");
    const track = document.getElementById("track");
    const stage = document.getElementById("stage");
    const stepFocus = document.getElementById("step-focus");
    const stepLabel = document.getElementById("step-label");
    const prevStepButton = document.getElementById("prev-step");
    const nextStepButton = document.getElementById("next-step");
    const penToggleButton = document.getElementById("pen-toggle");
    const clearAnnotationsButton = document.getElementById("clear-annotations");
    const annotationCanvas = document.getElementById("annotation-canvas");
    const dragMarker = document.getElementById("drag-marker");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const replayButton = document.getElementById("replay");
    let startedAt = 0;
    let elapsed = 0;
    let frameId = 0;
    let running = false;
    let currentStep = 0;
    let drawing = false;
    let penEnabled = false;

    function maxTravel() {
      return Math.max(track.clientWidth - walker.clientWidth - 80, 0);
    }

    function render() {
      const progress = Math.min(elapsed / playbackSeconds, 1);
      timer.textContent = "演示：" + elapsed.toFixed(1) + " 秒";
      walker.style.transform = "translateX(" + Math.round(progress * maxTravel()) + "px)";
    }

    function renderCurrentStep() {
      const total = Math.max(teachingSteps.length, 1);
      currentStep = Math.max(0, Math.min(currentStep, total - 1));
      if (stepFocus) {
        stepFocus.textContent = teachingSteps[currentStep] || "先观察题目条件。";
      }
      if (stepLabel) {
        stepLabel.textContent = "步骤 " + (currentStep + 1) + " / " + total;
      }
      document.querySelectorAll("[data-step-index]").forEach((item) => {
        item.dataset.active = item.getAttribute("data-step-index") === String(currentStep) ? "true" : "false";
      });
      elapsed = total <= 1 ? 0 : playbackSeconds * (currentStep / (total - 1));
      render();
    }

    function resizeCanvas() {
      if (!annotationCanvas || !stage) return;
      annotationCanvas.width = stage.clientWidth;
      annotationCanvas.height = stage.clientHeight;
    }

    function getCanvasPoint(event) {
      const rect = annotationCanvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    function getAnnotationContext() {
      if (!annotationCanvas || typeof annotationCanvas.getContext !== "function") return null;
      try {
        const context = annotationCanvas.getContext("2d");
        if (!context) return null;
        context.lineWidth = 3;
        context.lineCap = "round";
        context.strokeStyle = "#dc2626";
        return context;
      } catch {
        return null;
      }
    }

    function startDrawing(event) {
      if (!penEnabled) return;
      const context = getAnnotationContext();
      if (!context) return;
      drawing = true;
      const point = getCanvasPoint(event);
      context.beginPath();
      context.moveTo(point.x, point.y);
    }

    function draw(event) {
      if (!drawing || !penEnabled) return;
      const context = getAnnotationContext();
      if (!context) return;
      const point = getCanvasPoint(event);
      context.lineTo(point.x, point.y);
      context.stroke();
    }

    function stopDrawing() {
      drawing = false;
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

    prevStepButton.addEventListener("click", () => {
      running = false;
      cancelAnimationFrame(frameId);
      currentStep -= 1;
      renderCurrentStep();
    });

    nextStepButton.addEventListener("click", () => {
      running = false;
      cancelAnimationFrame(frameId);
      currentStep += 1;
      renderCurrentStep();
    });

    penToggleButton.addEventListener("click", () => {
      penEnabled = !penEnabled;
      stage.classList.toggle("draw-mode", penEnabled);
      penToggleButton.textContent = penEnabled ? "收起画笔" : "画笔";
    });

    clearAnnotationsButton.addEventListener("click", () => {
      const context = getAnnotationContext();
      if (context && annotationCanvas) {
        context.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
      }
    });

    annotationCanvas.addEventListener("pointerdown", startDrawing);
    annotationCanvas.addEventListener("pointermove", draw);
    annotationCanvas.addEventListener("pointerup", stopDrawing);
    annotationCanvas.addEventListener("pointerleave", stopDrawing);

    dragMarker.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", "drag-marker");
    });

    track.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    track.addEventListener("drop", (event) => {
      event.preventDefault();
      const rect = track.getBoundingClientRect();
      const nextLeft = Math.max(8, Math.min(event.clientX - rect.left - dragMarker.offsetWidth / 2, track.clientWidth - dragMarker.offsetWidth - 8));
      dragMarker.style.left = nextLeft + "px";
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

    window.addEventListener("resize", () => {
      resizeCanvas();
      render();
    });
    resizeCanvas();
    renderCurrentStep();
    render();
  </script>
</body>
</html>`;
}

function createMotionRelationBoard(plan: ProblemDemoPlan, sceneActor: string): string {
  const motion = plan.motion;
  if (!motion) {
    return "";
  }

  const outboundSpeed = findKnownValue(plan, [/去|往|出发|甲地到乙地/, /速度|每小时|每秒/])
    ?? formatQuantity(motion.speed, motion.speedUnit);
  const returnSpeed = findKnownValue(plan, [/返|回|乙地到甲地/, /速度|每小时|每秒/]);
  const earlyTime = findKnownValue(plan, [/提前|早到|少/, /时|分|秒|时间/]) ?? findKnownValue(plan, [/提前|早到|少/]);
  const lateTime = findKnownValue(plan, [/迟到|晚到|多/, /时|分|秒|时间/]) ?? findKnownValue(plan, [/迟到|晚到|多/]);
  const comparisonStep = plan.steps.find((step) => /方程|列式|S\/|x\/|时间差|少.*多|提前.*迟到/.test(step))
    ?? "速度越快，用时越短；速度越慢，用时越长。";
  const distanceText = createMotionAnswer(plan);
  const hasReturnTrip = Boolean(returnSpeed || /返回|返程|回程|迟到|晚到/.test(plan.originalProblem));
  const firstLaneText = hasReturnTrip ? "去时速度快，用时比计划少" : "速度给出每段时间能走多远";
  const secondLaneText = hasReturnTrip ? "返回速度慢，用时比计划多" : "同一路程下，用 路程 ÷ 速度 得到时间";
  const secondLaneValue = hasReturnTrip ? returnSpeed ?? "返回速度待比较" : "路程 ÷ 速度 = 时间";
  const relationshipText = hasReturnTrip
    ? `${earlyTime && lateTime ? `时间差：少 ${earlyTime} + 多 ${lateTime} = 2 小时` : "时间差来自“提前”和“迟到”的合并比较"}；${comparisonStep}`
    : `基本关系：路程 = 速度 × 时间；${plan.steps[0] ?? "用 路程 ÷ 速度 求时间"}`;

  return `
          <div class="relation-board">
            <div class="route-summary">
              <div class="route-heading">
                <span>同一段路程：${escapeHtml(motion.startLabel)} → ${escapeHtml(motion.endLabel)}</span>
                <span class="route-distance">${escapeHtml(createMotionAnswerLabel(plan))}：${escapeHtml(distanceText)}</span>
              </div>
              <div class="labels">
                <span>${escapeHtml(motion.startLabel)}</span>
                <span>${escapeHtml(motion.endLabel)}</span>
              </div>
              <div id="track" class="track" aria-label="同一段路程的压缩动画">
                <div id="walker" class="walker">${escapeHtml(sceneActor)}</div>
                <div id="drag-marker" class="drag-marker" draggable="true" data-drag-marker>讲解点</div>
              </div>
            </div>
            <div class="relation-lanes" aria-label="速度和用时对比">
              <div class="relation-lane">
                <div class="lane-label">${hasReturnTrip ? "去时" : "行驶"}</div>
                <div class="lane-track">
                  <div class="lane-meta">
                    <span>${escapeHtml(firstLaneText)}</span>
                    <strong>${escapeHtml(outboundSpeed)}</strong>
                  </div>
                  <div class="lane-bar fast"><span></span></div>
                </div>
              </div>
              <div class="relation-lane">
                <div class="lane-label">${hasReturnTrip ? "返回" : "对比"}</div>
                <div class="lane-track">
                  <div class="lane-meta">
                    <span>${escapeHtml(secondLaneText)}</span>
                    <strong>${escapeHtml(secondLaneValue)}</strong>
                  </div>
                  <div class="lane-bar slow"><span></span></div>
                </div>
              </div>
            </div>
            <div class="relationship-note">
              ${escapeHtml(relationshipText)}
            </div>
          </div>`;
}

function createMotionAnswer(plan: ProblemDemoPlan): string {
  const motion = plan.motion;
  if (!motion) {
    return "";
  }

  if (motion.answerValue !== undefined && motion.answerUnit?.trim()) {
    return formatQuantity(motion.answerValue, motion.answerUnit);
  }

  const target = inferFallbackMotionTarget([motion.targetQuantity, motion.answerLabel, plan.target].join(" "));
  if (target === "distance") {
    return formatQuantity(motion.distance, motion.distanceUnit);
  }

  if (target === "speed") {
    return formatQuantity(motion.speed, motion.speedUnit);
  }

  return formatQuantity(formatNumber(motion.answerSeconds), "秒");
}

function createMotionAnswerLabel(plan: ProblemDemoPlan): string {
  const motion = plan.motion;
  const label = normalizeLabel(motion?.answerLabel)
    || normalizeLabel(motion?.targetQuantity)
    || normalizeLabel(plan.target);

  return label || "答案";
}

function normalizeLabel(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(/[。？?：:]\s*$/g, "").trim();
}

function inferFallbackMotionTarget(target: string): "time" | "distance" | "speed" {
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

function findKnownValue(plan: ProblemDemoPlan, patterns: RegExp[]): string | undefined {
  const found = plan.knownValues.find((item) => {
    const label = `${item.label}${item.unit ?? ""}`;

    return patterns.every((pattern) => pattern.test(label));
  });

  if (!found) {
    return undefined;
  }

  return formatQuantity(found.value, found.unit ?? "");
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

function toScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
