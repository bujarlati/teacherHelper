type RenderTeachingDemoInput = {
  title: string;
  prompt: string;
  script?: string;
  exampleQuestions?: Array<{ question: string; answer: string }>;
  workedSolutions?: Array<{ question: string; steps: string[]; answer: string }>;
};

type CoursewareTemplate = "function" | "balance" | "number-line" | "generic";
type InteractiveExample = {
  question: string;
  steps: string[];
  answer: string;
};

export function renderTeachingDemoHtml(input: RenderTeachingDemoInput): string {
  const title = input.title.trim() || "本地互动课件";
  const prompt = input.prompt.trim();
  const steps = splitScriptIntoSteps(input.script || input.prompt);
  const template = chooseTemplate(`${title}\n${prompt}\n${input.script || ""}`);
  const coursewareSummary = createCoursewareSummary(steps, prompt);
  const interactiveExamples = createInteractiveExamples(input);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      background: #f5f7fa;
      color: #182235;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      padding: 24px;
      background: #f5f7fa;
    }

    button,
    input {
      font: inherit;
    }

    .interactive-courseware {
      width: min(1200px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: end;
      padding: 22px 24px;
      border: 1px solid #d9e0ea;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 14px 34px rgba(34, 48, 78, 0.08);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 30px;
      line-height: 1.25;
      letter-spacing: 0;
    }

    .prompt {
      margin: 0;
      color: #4d5a6e;
      line-height: 1.65;
      font-size: 16px;
    }

    .toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .toolbar button,
    .quiz-option,
    .action-button {
      border: 1px solid #b8c4d4;
      border-radius: 6px;
      background: #ffffff;
      color: #182235;
      padding: 9px 12px;
      cursor: pointer;
    }

    .toolbar button:hover,
    .quiz-option:hover,
    .action-button:hover {
      border-color: #2f78c4;
      color: #1f5d9b;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 16px;
      align-items: stretch;
    }

    .stage,
    .side-panel {
      border: 1px solid #d9e0ea;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 12px 28px rgba(34, 48, 78, 0.06);
    }

    .stage {
      min-height: 620px;
      padding: 22px;
      display: grid;
      grid-template-rows: auto minmax(340px, 1fr) auto;
      gap: 18px;
    }

    .step-card {
      display: none;
      gap: 10px;
      padding: 16px;
      border-left: 5px solid #2f78c4;
      background: #f8fbff;
      border-radius: 6px;
    }

    .step-card.is-active {
      display: grid;
    }

    .step-label {
      color: #2f78c4;
      font-weight: 700;
      font-size: 14px;
    }

    .step-text {
      margin: 0;
      font-size: 22px;
      line-height: 1.5;
      font-weight: 700;
    }

    .visual-panel {
      position: relative;
      overflow: hidden;
      display: grid;
      align-items: center;
      justify-items: center;
      min-height: 360px;
      border: 1px solid #d9e0ea;
      border-radius: 8px;
      background: #fbfcfe;
    }

    .side-panel {
      padding: 18px;
      display: grid;
      gap: 16px;
      align-content: start;
    }

    .side-panel h2 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0;
    }

    #teacher-note {
      margin: 0;
      color: #4d5a6e;
      line-height: 1.65;
    }

    .quiz {
      display: grid;
      gap: 10px;
    }

    .quiz p {
      margin: 0;
      font-weight: 700;
    }

    .quiz-options {
      display: grid;
      gap: 8px;
    }

    .example-lab {
      display: grid;
      gap: 12px;
      padding: 16px;
      border: 1px solid #d9e0ea;
      border-radius: 8px;
      background: #fbfcfe;
    }

    .example-lab h2 {
      margin: 0;
      font-size: 18px;
    }

    .example-grid {
      display: grid;
      gap: 12px;
    }

    .example-card {
      display: grid;
      gap: 10px;
      border: 1px solid #d9e0ea;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .example-question {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      line-height: 1.5;
    }

    .example-output {
      min-height: 44px;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f3f7fb;
      color: #263247;
      line-height: 1.6;
    }

    .example-answer {
      color: #1d6b48;
      font-weight: 800;
    }

    #feedback {
      min-height: 24px;
      color: #1d6b48;
      font-weight: 700;
    }

    .controls {
      display: grid;
      gap: 14px;
      padding: 16px;
      border: 1px solid #d9e0ea;
      border-radius: 8px;
      background: #ffffff;
    }

    .control-row {
      display: grid;
      gap: 8px;
    }

    .control-row label {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #4d5a6e;
      font-weight: 700;
    }

    input[type="range"] {
      width: 100%;
      accent-color: #2f78c4;
    }

    .function-svg {
      width: min(640px, 100%);
      height: auto;
    }

    .grid-line {
      stroke: #dfe5ef;
      stroke-width: 1;
    }

    .axis-line {
      stroke: #263247;
      stroke-width: 2.4;
    }

    #function-line {
      stroke: #e85555;
      stroke-width: 4;
      stroke-linecap: round;
    }

    .moving-point {
      fill: #2f78c4;
      stroke: #ffffff;
      stroke-width: 3;
    }

    .balance-board {
      width: min(650px, 100%);
      display: grid;
      gap: 22px;
      justify-items: center;
    }

    .beam {
      width: min(560px, 100%);
      height: 10px;
      border-radius: 999px;
      background: #263247;
      transform-origin: center;
      transition: transform 260ms ease;
    }

    .pans {
      width: min(620px, 100%);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
    }

    .pan {
      min-height: 130px;
      padding: 16px;
      border: 2px solid #9aa8ba;
      border-radius: 8px;
      background: #ffffff;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 10px;
      font-size: 24px;
      font-weight: 800;
    }

    .weight-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .weight {
      min-width: 34px;
      padding: 7px 9px;
      border-radius: 6px;
      background: #f2c94c;
      color: #3a2b00;
      font-size: 14px;
    }

    .number-line-board {
      width: min(680px, 100%);
      display: grid;
      gap: 24px;
      align-content: center;
    }

    .number-line {
      position: relative;
      height: 120px;
      margin: 0 24px;
    }

    .number-line::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 58px;
      height: 4px;
      background: #263247;
      border-radius: 999px;
    }

    .jump {
      position: absolute;
      top: 28px;
      height: 48px;
      border: 3px solid #2f78c4;
      border-bottom: 0;
      border-radius: 999px 999px 0 0;
      transition: left 220ms ease, width 220ms ease;
    }

    .jump.second {
      border-color: #e85555;
      top: 16px;
    }

    #number-marker {
      position: absolute;
      top: 46px;
      width: 24px;
      height: 24px;
      margin-left: -12px;
      border-radius: 50%;
      background: #1d6b48;
      border: 3px solid #ffffff;
      box-shadow: 0 4px 16px rgba(29, 107, 72, 0.22);
      transition: left 220ms ease;
    }

    .ticks {
      display: grid;
      grid-template-columns: repeat(11, 1fr);
      color: #687589;
      font-size: 13px;
      text-align: center;
    }

    @media (max-width: 900px) {
      body {
        padding: 12px;
      }

      .hero,
      .layout {
        grid-template-columns: 1fr;
      }

      .toolbar {
        justify-content: start;
      }

      .stage {
        min-height: auto;
      }
    }
  </style>
</head>
<body>
  <main class="interactive-courseware" data-template="${template}">
    <section class="hero">
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${coursewareSummary ? `<p class="prompt">${escapeHtml(coursewareSummary)}</p>` : ""}
      </div>
      <nav class="toolbar" aria-label="课件控制">
        <button id="prev-step" type="button">上一步</button>
        <button id="next-step" type="button">下一步</button>
        <button id="reset-demo" type="button">重置</button>
        <button id="autoplay-demo" type="button">自动播放</button>
      </nav>
    </section>
    <section class="layout">
      <section class="stage" aria-label="互动演示区">
        <div id="step-list">
          ${steps.map((step, index) => renderStep(step, index)).join("\n          ")}
        </div>
        ${renderTemplate(template)}
        <div class="controls">
          ${renderTemplateControls(template)}
        </div>
        ${renderInteractiveExamples(interactiveExamples)}
      </section>
      <aside class="side-panel">
        <h2>教师提示</h2>
        <p id="teacher-note">${escapeHtml(createTeacherNote(template))}</p>
        <section class="quiz" aria-label="互动检查">
          <p>${escapeHtml(createQuizQuestion(template))}</p>
          <div class="quiz-options">
            ${renderQuizOptions(template)}
          </div>
          <div id="feedback" role="status"></div>
        </section>
      </aside>
    </section>
  </main>
  <script>
    const exampleData = ${serializeScriptJson(interactiveExamples)};
    const exampleStepIndexes = exampleData.map(() => 0);
    const steps = Array.from(document.querySelectorAll(".step-card"));
    let currentStep = 0;
    let autoplayTimer = null;

    function showStep(index) {
      currentStep = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((step, stepIndex) => {
        step.classList.toggle("is-active", stepIndex === currentStep);
      });
      const note = document.getElementById("teacher-note");
      if (note) {
        note.textContent = steps[currentStep]?.dataset.teacherNote || note.textContent;
      }
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        window.clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    document.getElementById("prev-step")?.addEventListener("click", () => {
      stopAutoplay();
      showStep(currentStep - 1);
    });
    document.getElementById("next-step")?.addEventListener("click", () => {
      stopAutoplay();
      showStep(currentStep + 1);
    });
    document.getElementById("reset-demo")?.addEventListener("click", () => {
      stopAutoplay();
      showStep(0);
      resetTemplate();
    });
    document.getElementById("autoplay-demo")?.addEventListener("click", () => {
      stopAutoplay();
      autoplayTimer = window.setInterval(() => {
        showStep(currentStep >= steps.length - 1 ? 0 : currentStep + 1);
      }, 2400);
    });

    document.querySelectorAll(".quiz-option").forEach((button) => {
      button.addEventListener("click", () => {
        const feedback = document.getElementById("feedback");
        if (!feedback) return;
        feedback.textContent = button.dataset.correct === "true" || button.dataset.correct === "positive-slope" ? "判断正确，可以追问学生为什么。" : "还不对，回到演示区再观察一次。";
      });
    });

    function updateExampleCard(index) {
      const example = exampleData[index];
      const card = document.querySelector("[data-example-card='" + index + "']");
      if (!example || !card) return;

      const stepOutput = card.querySelector("[data-example-step-output]");
      const answerOutput = card.querySelector("[data-example-answer-output]");
      const stepIndex = exampleStepIndexes[index] || 0;
      if (stepOutput) {
        if (stepIndex <= 0) {
          stepOutput.textContent = "点击“下一步”逐步讲解这道例题。";
        } else {
          stepOutput.textContent = "第 " + stepIndex + " 步：" + example.steps[stepIndex - 1];
        }
      }
      if (answerOutput && !answerOutput.dataset.visible) {
        answerOutput.textContent = "";
      }
    }

    document.querySelectorAll("[data-example-next]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.exampleNext);
        const example = exampleData[index];
        if (!example) return;

        exampleStepIndexes[index] = Math.min((exampleStepIndexes[index] || 0) + 1, example.steps.length);
        updateExampleCard(index);
      });
    });

    document.querySelectorAll("[data-example-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.exampleAnswer);
        const example = exampleData[index];
        const card = document.querySelector("[data-example-card='" + index + "']");
        const answerOutput = card?.querySelector("[data-example-answer-output]");
        if (!example || !answerOutput) return;

        answerOutput.dataset.visible = "true";
        answerOutput.textContent = "答案：" + example.answer;
      });
    });

    document.querySelectorAll("[data-example-reset]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.exampleReset);
        const card = document.querySelector("[data-example-card='" + index + "']");
        const answerOutput = card?.querySelector("[data-example-answer-output]");
        exampleStepIndexes[index] = 0;
        if (answerOutput) {
          delete answerOutput.dataset.visible;
          answerOutput.textContent = "";
        }
        updateExampleCard(index);
      });
    });

    function updateFunctionPlot() {
      const slope = Number(document.getElementById("slope-slider")?.value || 1);
      const intercept = Number(document.getElementById("intercept-slider")?.value || 0);
      const slopeValue = document.getElementById("slope-value");
      const interceptValue = document.getElementById("intercept-value");
      if (slopeValue) slopeValue.textContent = String(slope);
      if (interceptValue) interceptValue.textContent = String(intercept);
      const x1 = -5;
      const x2 = 5;
      const y1 = slope * x1 + intercept;
      const y2 = slope * x2 + intercept;
      const toPoint = (x, y) => [300 + x * 40, 260 - y * 28];
      const start = toPoint(x1, y1);
      const end = toPoint(x2, y2);
      document.getElementById("function-line")?.setAttribute("x1", String(start[0]));
      document.getElementById("function-line")?.setAttribute("y1", String(start[1]));
      document.getElementById("function-line")?.setAttribute("x2", String(end[0]));
      document.getElementById("function-line")?.setAttribute("y2", String(end[1]));
      const point = toPoint(1, slope + intercept);
      document.getElementById("moving-function-point")?.setAttribute("cx", String(point[0]));
      document.getElementById("moving-function-point")?.setAttribute("cy", String(point[1]));
    }

    function updateBalance() {
      const phase = Number(document.getElementById("balance-phase")?.value || 0);
      const beam = document.getElementById("balance-beam");
      const left = document.getElementById("left-expression");
      const right = document.getElementById("right-expression");
      if (beam) beam.style.transform = phase === 0 ? "rotate(-4deg)" : "rotate(0deg)";
      if (left) left.textContent = phase === 0 ? "3x + 2" : phase === 1 ? "3x" : "x";
      if (right) right.textContent = phase === 0 ? "11" : phase === 1 ? "9" : "3";
    }

    function updateNumberLine() {
      const first = Number(document.getElementById("first-jump")?.value || 3);
      const second = Number(document.getElementById("second-jump")?.value || 2);
      const total = first + second;
      const percent = (value) => 8 + value * 8.4;
      const firstArc = document.getElementById("first-arc");
      const secondArc = document.getElementById("second-arc");
      const marker = document.getElementById("number-marker");
      const firstValue = document.getElementById("first-jump-value");
      const secondValue = document.getElementById("second-jump-value");
      if (firstValue) firstValue.textContent = String(first);
      if (secondValue) secondValue.textContent = String(second);
      if (firstArc) {
        firstArc.style.left = percent(0) + "%";
        firstArc.style.width = Math.max(4, percent(first) - percent(0)) + "%";
      }
      if (secondArc) {
        secondArc.style.left = percent(first) + "%";
        secondArc.style.width = Math.max(4, percent(second) - percent(0)) + "%";
      }
      if (marker) marker.style.left = percent(total) + "%";
    }

    function resetTemplate() {
      const slope = document.getElementById("slope-slider");
      const intercept = document.getElementById("intercept-slider");
      const phase = document.getElementById("balance-phase");
      const first = document.getElementById("first-jump");
      const second = document.getElementById("second-jump");
      if (slope) slope.value = "1";
      if (intercept) intercept.value = "0";
      if (phase) phase.value = "0";
      if (first) first.value = "3";
      if (second) second.value = "2";
      updateFunctionPlot();
      updateBalance();
      updateNumberLine();
      const feedback = document.getElementById("feedback");
      if (feedback) feedback.textContent = "";
    }

    document.getElementById("slope-slider")?.addEventListener("input", updateFunctionPlot);
    document.getElementById("intercept-slider")?.addEventListener("input", updateFunctionPlot);
    document.getElementById("balance-phase")?.addEventListener("input", updateBalance);
    document.getElementById("subtract-weight")?.addEventListener("click", () => {
      const phase = document.getElementById("balance-phase");
      if (phase) phase.value = "1";
      updateBalance();
    });
    document.getElementById("divide-weight")?.addEventListener("click", () => {
      const phase = document.getElementById("balance-phase");
      if (phase) phase.value = "2";
      updateBalance();
    });
    document.getElementById("first-jump")?.addEventListener("input", updateNumberLine);
    document.getElementById("second-jump")?.addEventListener("input", updateNumberLine);

    showStep(0);
    resetTemplate();
    exampleData.forEach((_, index) => updateExampleCard(index));
  </script>
</body>
</html>`;
}

function renderStep(step: string, index: number): string {
  return `<article class="step-card${index === 0 ? " is-active" : ""}" data-step="${index + 1}" data-teacher-note="${escapeHtmlAttribute(createStepTeacherNote(step, index))}">
            <div class="step-label">步骤 ${index + 1}</div>
            <p class="step-text">${escapeHtml(step)}</p>
          </article>`;
}

function renderTemplate(template: CoursewareTemplate): string {
  if (template === "function") {
    return `<div class="visual-panel" aria-label="函数互动图像">
            <svg class="function-svg" viewBox="0 0 600 520" role="img" aria-label="一次函数坐标系">
              ${Array.from({ length: 11 }, (_, index) => {
                const pos = 100 + index * 40;
                return `<line class="grid-line" x1="${pos}" y1="60" x2="${pos}" y2="460"></line><line class="grid-line" x1="100" y1="${60 + index * 40}" x2="500" y2="${60 + index * 40}"></line>`;
              }).join("")}
              <line class="axis-line" x1="100" y1="260" x2="500" y2="260"></line>
              <line class="axis-line" x1="300" y1="60" x2="300" y2="460"></line>
              <line id="function-line" x1="100" y1="400" x2="500" y2="120"></line>
              <circle id="moving-function-point" class="moving-point" cx="340" cy="232" r="9"></circle>
              <text x="508" y="266" fill="#263247">x</text>
              <text x="308" y="54" fill="#263247">y</text>
            </svg>
          </div>`;
  }

  if (template === "balance") {
    return `<div class="visual-panel" aria-label="方程天平互动">
            <div class="balance-board">
              <div id="balance-beam" class="beam"></div>
              <div class="pans">
                <div class="pan">
                  <div id="left-expression">3x + 2</div>
                  <div class="weight-row"><span class="weight">x</span><span class="weight">x</span><span class="weight">x</span><span class="weight">+2</span></div>
                </div>
                <div class="pan">
                  <div id="right-expression">11</div>
                  <div class="weight-row"><span class="weight">11</span></div>
                </div>
              </div>
            </div>
          </div>`;
  }

  if (template === "number-line") {
    return `<div class="visual-panel" aria-label="数轴互动">
            <div class="number-line-board">
              <div class="number-line">
                <div id="first-arc" class="jump"></div>
                <div id="second-arc" class="jump second"></div>
                <div id="number-marker"></div>
              </div>
              <div class="ticks">${Array.from({ length: 11 }, (_, index) => `<span>${index}</span>`).join("")}</div>
            </div>
          </div>`;
  }

  return `<div class="visual-panel" aria-label="通用互动板书">
            <div class="balance-board">
              <p class="step-text">按步骤推进，先让学生判断，再揭示结论。</p>
              <button class="action-button" type="button" onclick="document.getElementById('feedback').textContent='请学生说出理由，再进入下一步。'">揭示教师追问</button>
            </div>
          </div>`;
}

function renderTemplateControls(template: CoursewareTemplate): string {
  if (template === "function") {
    return `<div class="control-row">
              <label for="slope-slider">斜率 k <span id="slope-value">1</span></label>
              <input id="slope-slider" type="range" min="-3" max="3" step="0.5" value="1" />
            </div>
            <div class="control-row">
              <label for="intercept-slider">截距 b <span id="intercept-value">0</span></label>
              <input id="intercept-slider" type="range" min="-4" max="4" step="0.5" value="0" />
            </div>`;
  }

  if (template === "balance") {
    return `<div class="control-row">
              <label for="balance-phase">等式变形阶段 <span>观察 → 减 2 → 除以 3</span></label>
              <input id="balance-phase" type="range" min="0" max="2" step="1" value="0" />
            </div>
            <div class="toolbar">
              <button id="subtract-weight" type="button">两边同时减 2</button>
              <button id="divide-weight" type="button">两边同时除以 3</button>
            </div>`;
  }

  if (template === "number-line") {
    return `<div class="control-row">
              <label for="first-jump">第一段 A <span id="first-jump-value">3</span></label>
              <input id="first-jump" type="range" min="0" max="6" step="1" value="3" />
            </div>
            <div class="control-row">
              <label for="second-jump">第二段 B <span id="second-jump-value">2</span></label>
              <input id="second-jump" type="range" min="0" max="5" step="1" value="2" />
            </div>`;
  }

  return `<button class="action-button" type="button" onclick="document.getElementById('feedback').textContent='先让学生回答，再点击下一步。'">生成课堂追问</button>`;
}

function renderInteractiveExamples(examples: InteractiveExample[]): string {
  if (examples.length === 0) {
    return "";
  }

  return `<section class="example-lab" aria-label="例题互动">
          <h2>例题互动</h2>
          <div class="example-grid">
            ${examples.map((example, index) => renderInteractiveExample(example, index)).join("\n            ")}
          </div>
        </section>`;
}

function renderInteractiveExample(example: InteractiveExample, index: number): string {
  return `<article class="example-card" data-example-card="${index}">
              <p class="example-question">${escapeHtml(example.question)}</p>
              <div class="example-output" data-example-step-output></div>
              <div class="example-output example-answer" data-example-answer-output></div>
              <div class="toolbar">
                <button type="button" data-example-next="${index}">下一步</button>
                <button type="button" data-example-answer="${index}">显示答案</button>
                <button type="button" data-example-reset="${index}">重做</button>
              </div>
            </article>`;
}

function renderQuizOptions(template: CoursewareTemplate): string {
  if (template === "function") {
    return `<button class="quiz-option" type="button" data-correct="positive-slope">k &gt; 0 时图像从左到右上升</button>
            <button class="quiz-option" type="button" data-correct="false">b 只改变图像倾斜程度</button>`;
  }

  if (template === "balance") {
    return `<button class="quiz-option" type="button" data-correct="true">等式两边做同样操作，平衡不变</button>
            <button class="quiz-option" type="button" data-correct="false">只改变左边也能保持平衡</button>`;
  }

  if (template === "number-line") {
    return `<button class="quiz-option" type="button" data-correct="true">第二段要从第一段终点继续走</button>
            <button class="quiz-option" type="button" data-correct="false">两段都从 0 开始走</button>`;
  }

  return `<button class="quiz-option" type="button" data-correct="true">先观察，再解释理由</button>
          <button class="quiz-option" type="button" data-correct="false">直接给出答案即可</button>`;
}

function chooseTemplate(value: string): CoursewareTemplate {
  const text = value.toLowerCase();
  if (/一次函数|函数|y\s*=|kx|slope|intercept|坐标/.test(text)) return "function";
  if (/方程|天平|等式|balance|equation|x\s*[+\-*/=]/.test(text)) return "balance";
  if (/数轴|number line|a\s*\+\s*b|跳跃|有理数/.test(text)) return "number-line";
  return "generic";
}

function createTeacherNote(template: CoursewareTemplate): string {
  if (template === "function") return "先让学生拖动 k 和 b，描述图像怎样变化，再追问哪个参数控制倾斜、哪个参数控制截距。";
  if (template === "balance") return "强调等式两边必须做同样操作。每一步操作前先问学生：天平会不会继续平衡？";
  if (template === "number-line") return "让学生先预测终点，再拖动 A 和 B 验证。重点追问第二段为什么从第一段终点出发。";
  return "把每一步变成提问：先预测、再操作、最后解释理由。";
}

function createQuizQuestion(template: CoursewareTemplate): string {
  if (template === "function") return "拖动后你能判断 k 的作用吗？";
  if (template === "balance") return "哪种操作能保持等式成立？";
  if (template === "number-line") return "A+B 的第二段应该从哪里开始？";
  return "这一页最适合先问学生什么？";
}

function createCoursewareSummary(steps: string[], prompt: string): string {
  const firstChineseStep = steps.find((step) => /[\u3400-\u9fff]/u.test(step));
  if (firstChineseStep) {
    return `课堂任务：${firstChineseStep}`;
  }

  if (/[\u3400-\u9fff]/u.test(prompt)) {
    return `课堂任务：${prompt}`;
  }

  return "";
}

function createStepTeacherNote(step: string, index: number): string {
  return `第 ${index + 1} 步：先让学生观察，再追问“为什么”。当前板书：${step}`;
}

function splitScriptIntoSteps(value: string): string[] {
  const lines = value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const segments = lines.length > 1
    ? lines
    : Array.from(value.matchAll(/[^。！？.!?\r\n]+[。！？.!?]?/gu), (match) => match[0].trim()).filter(Boolean);

  return (segments.length ? segments : ["观察题意", "分步推理", "得到结论"]).slice(0, 6);
}

function createInteractiveExamples(input: RenderTeachingDemoInput): InteractiveExample[] {
  const workedSolutions = input.workedSolutions ?? [];
  const examplesFromWorkedSolutions = workedSolutions
    .map((item) => normalizeInteractiveExample({
      question: item.question,
      steps: item.steps,
      answer: item.answer
    }))
    .filter((item): item is InteractiveExample => Boolean(item));

  const workedQuestions = new Set(examplesFromWorkedSolutions.map((item) => item.question));
  const examplesFromQuestions = (input.exampleQuestions ?? [])
    .filter((item) => !workedQuestions.has(item.question))
    .map((item) => normalizeInteractiveExample({
      question: item.question,
      steps: createFallbackExampleSteps(item.question, item.answer),
      answer: item.answer
    }))
    .filter((item): item is InteractiveExample => Boolean(item));

  return [...examplesFromWorkedSolutions, ...examplesFromQuestions].slice(0, 4);
}

function normalizeInteractiveExample(value: InteractiveExample): InteractiveExample | undefined {
  const question = value.question.trim();
  const answer = value.answer.trim();
  const steps = value.steps.map((step) => step.trim()).filter(Boolean);

  if (!question || !answer) {
    return undefined;
  }

  return {
    question,
    answer,
    steps: steps.length > 0 ? steps : createFallbackExampleSteps(question, answer)
  };
}

function createFallbackExampleSteps(question: string, answer: string): string[] {
  return [
    `读题并圈出关键信息：${question}`,
    "让学生先独立写出第一步，再观察是否使用了本节课方法。",
    `核对结果：${answer}`
  ];
}

function serializeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/\n/g, " ");
}
