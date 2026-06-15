import type { ProblemDemoPlan } from "../../shared/types.js";

export function renderEquationDemoHtml(plan: ProblemDemoPlan): string {
  const equation = plan.equation;
  if (!equation) {
    throw new Error("equation demo requires equation data");
  }

  const knownValues = plan.knownValues
    .map((item) => {
      const unit = item.unit ? escapeHtml(item.unit) : "";
      return `<li><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}${unit}</strong></li>`;
    })
    .join("");
  const workedSteps = plan.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const cards = [
    {
      label: "设未知量",
      title: "设未知量",
      body: equation.variable,
      badge: "x"
    },
    {
      label: "找关系",
      title: "找等量关系",
      body: equation.relationship,
      badge: "="
    },
    {
      label: "列方程",
      title: "列方程",
      body: equation.expression,
      badge: "fx"
    },
    {
      label: "求解",
      title: "求解",
      body: equation.solution,
      badge: "✓"
    },
    {
      label: "检验",
      title: "检验",
      body: equation.verification,
      badge: "?"
    }
  ];
  const stepCards = cards
    .map((card, index) => {
      const hidden = index === 0 ? "" : " hidden";
      return `<article id="card-${index}" class="step-card"${hidden} aria-labelledby="card-title-${index}">
          <div class="step-badge" aria-hidden="true">${escapeHtml(card.badge)}</div>
          <div>
            <p class="step-label">第 ${index + 1} 步 · ${escapeHtml(card.label)}</p>
            <h3 id="card-title-${index}">${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.body)}</p>
          </div>
        </article>`;
    })
    .join("");
  const dots = cards
    .map((card, index) => {
      const current = index === 0 ? ' aria-current="step"' : "";
      return `<button id="dot-${index}" class="dot" type="button" data-step="${index}" aria-label="${escapeHtml(card.title)}"${current}></button>`;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(plan.title)}</title>
  <style>
    :root {
      color: #172033;
      background: #f6f7f9;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #f6f7f9;
    }

    main {
      width: min(1040px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    h2 {
      margin: 0 0 14px;
      font-size: 18px;
      line-height: 1.35;
    }

    h3 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .problem {
      margin: 0 0 22px;
      color: #45536a;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
      gap: 20px;
      align-items: start;
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
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .facts li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid #e5e9f2;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fbfcff;
    }

    .facts span,
    .facts strong {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .balance {
      display: grid;
      gap: 16px;
    }

    .beam {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr);
      align-items: end;
      gap: 16px;
      min-height: 210px;
      padding: 18px 0 0;
    }

    .beam::before {
      content: "";
      position: absolute;
      left: 9%;
      right: 9%;
      bottom: 74px;
      height: 8px;
      border-radius: 999px;
      background: #7f8ca3;
    }

    .stand {
      position: relative;
      height: 142px;
    }

    .stand::before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 24px;
      width: 8px;
      height: 106px;
      border-radius: 999px;
      background: #56657c;
      transform: translateX(-50%);
    }

    .stand::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 0;
      width: 64px;
      height: 12px;
      border-radius: 999px;
      background: #56657c;
      transform: translateX(-50%);
    }

    .pan {
      position: relative;
      min-height: 120px;
      border: 1px solid #d9dfeb;
      border-radius: 8px;
      background: #f9fbff;
      padding: 16px;
      display: grid;
      align-content: center;
      gap: 8px;
      text-align: center;
      box-shadow: inset 0 -10px 0 rgb(15 118 110 / 8%);
    }

    .pan::after {
      content: "";
      position: absolute;
      left: 18px;
      right: 18px;
      bottom: -13px;
      height: 14px;
      border: 2px solid #9aa6ba;
      border-top: 0;
      border-radius: 0 0 999px 999px;
    }

    .pan small {
      color: #5d6b80;
      font-weight: 700;
    }

    .pan strong {
      color: #0f766e;
      font-size: 24px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .relation {
      border: 1px solid #cbd7ea;
      border-radius: 8px;
      background: #f5f9ff;
      padding: 14px 16px;
      color: #253048;
      font-weight: 700;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .step-card {
      display: grid;
      grid-template-columns: 58px minmax(0, 1fr);
      gap: 14px;
      min-height: 168px;
      border: 1px solid #dfe4ee;
      border-radius: 8px;
      background: #ffffff;
      padding: 18px;
      box-shadow: 0 10px 30px rgb(23 32 51 / 8%);
    }

    .step-card[hidden] {
      display: none;
    }

    .step-badge {
      width: 58px;
      height: 58px;
      border-radius: 8px;
      background: #0f766e;
      color: #ffffff;
      display: grid;
      place-items: center;
      font-size: 22px;
      font-weight: 700;
    }

    .step-label {
      margin: 0 0 6px;
      color: #66748a;
      font-size: 14px;
      font-weight: 700;
    }

    .step-card p:last-child {
      margin: 0;
      color: #2d3a50;
      font-size: 18px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 14px;
    }

    .dots {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      flex: 1;
    }

    button {
      border: 1px solid #b8c3d6;
      border-radius: 8px;
      background: #ffffff;
      color: #172033;
      padding: 10px 14px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }

    button.primary {
      border-color: #0f766e;
      background: #0f766e;
      color: #ffffff;
    }

    .dot {
      width: 12px;
      height: 12px;
      min-width: 12px;
      border-radius: 999px;
      border: 0;
      padding: 0;
      background: #b8c3d6;
    }

    .dot[aria-current="step"] {
      width: 30px;
      background: #0f766e;
    }

    .steps {
      margin: 0;
      padding-left: 22px;
      line-height: 1.8;
    }

    @media (max-width: 780px) {
      main {
        padding: 24px 0;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      .beam {
        grid-template-columns: 1fr;
        min-height: 0;
      }

      .beam::before,
      .stand {
        display: none;
      }

      .controls {
        align-items: stretch;
        flex-wrap: wrap;
      }

      .dots {
        order: -1;
        flex-basis: 100%;
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
        <li><span>目标</span><strong>${escapeHtml(plan.target)}</strong></li>
      </ul>
    </section>

    <div class="grid">
      <section class="panel balance" aria-labelledby="balance-title">
        <h2 id="balance-title">方程天平</h2>
        <div class="beam">
          <div class="pan">
            <small>未知量</small>
            <strong>${escapeHtml(equation.variable)}</strong>
          </div>
          <div class="stand" aria-hidden="true"></div>
          <div class="pan">
            <small>方程</small>
            <strong>${escapeHtml(equation.expression)}</strong>
          </div>
        </div>
        <div class="relation">${escapeHtml(equation.relationship)}</div>
      </section>

      <section aria-labelledby="step-panel-title">
        <h2 id="step-panel-title">解题步骤</h2>
        ${stepCards}
        <div class="controls" aria-label="步骤控制">
          <button id="prev" type="button">上一步</button>
          <div class="dots" aria-label="步骤进度">
            ${dots}
          </div>
          <button id="next" class="primary" type="button">下一步</button>
        </div>
      </section>
    </div>

    <section class="panel" aria-labelledby="worked-steps-title">
      <h2 id="worked-steps-title">板书过程</h2>
      <ol class="steps">
        ${workedSteps}
      </ol>
    </section>
  </main>

  <script>
    const totalSteps = 5;
    let currentStep = 0;
    const prevButton = document.getElementById("prev");
    const nextButton = document.getElementById("next");
    const cards = Array.from({ length: totalSteps }, (_, index) => document.getElementById("card-" + index));
    const dots = Array.from({ length: totalSteps }, (_, index) => document.getElementById("dot-" + index));

    function showStep(index) {
      currentStep = Math.max(0, Math.min(index, totalSteps - 1));
      cards.forEach((card, cardIndex) => {
        if (card) {
          card.hidden = cardIndex !== currentStep;
        }
      });
      dots.forEach((dot, dotIndex) => {
        if (dot) {
          if (dotIndex === currentStep) {
            dot.setAttribute("aria-current", "step");
          } else {
            dot.removeAttribute("aria-current");
          }
        }
      });
      prevButton.disabled = currentStep === 0;
      nextButton.disabled = currentStep === totalSteps - 1;
    }

    prevButton.addEventListener("click", () => showStep(currentStep - 1));
    nextButton.addEventListener("click", () => showStep(currentStep + 1));
    dots.forEach((dot, dotIndex) => {
      if (dot) {
        dot.addEventListener("click", () => showStep(dotIndex));
      }
    });
    showStep(0);
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
