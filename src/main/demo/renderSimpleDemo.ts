import type { ProblemDemoPlan } from "../../shared/types.js";

export function renderSimpleDemoHtml(plan: ProblemDemoPlan): string {
  const knownValues = plan.knownValues
    .map((item) => {
      const unit = item.unit ? escapeHtml(item.unit) : "";
      return `<li><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}${unit}</strong></li>`;
    })
    .join("");
  const steps = plan.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const kindLabel = getKindLabel(plan.kind);

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
      width: min(920px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0;
    }

    h1 {
      margin: 0 0 10px;
      font-size: 28px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    h2 {
      margin: 0 0 14px;
      font-size: 18px;
      line-height: 1.35;
    }

    .kind {
      display: inline-block;
      margin: 0 0 14px;
      border: 1px solid #b7c9df;
      border-radius: 8px;
      background: #eef5ff;
      color: #24466d;
      padding: 6px 10px;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.3;
    }

    .problem {
      margin: 0 0 22px;
      color: #45536a;
      line-height: 1.7;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
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
    .facts strong,
    .target,
    .steps li {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .target {
      margin: 0;
      color: #24324a;
      font-weight: 700;
      line-height: 1.7;
    }

    .steps {
      margin: 0;
      padding-left: 22px;
      line-height: 1.8;
    }

    @media (max-width: 640px) {
      main {
        width: min(100% - 24px, 920px);
        padding: 24px 0;
      }

      .panel {
        padding: 16px;
      }

      .facts {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(plan.title)}</h1>
    <div class="kind">${escapeHtml(kindLabel)}</div>
    <p class="problem">${escapeHtml(plan.originalProblem)}</p>

    <section class="panel" aria-labelledby="known-values-title">
      <h2 id="known-values-title">已知条件</h2>
      <ul class="facts">
        ${knownValues}
      </ul>
    </section>

    <section class="panel" aria-labelledby="target-title">
      <h2 id="target-title">目标</h2>
      <p class="target">${escapeHtml(plan.target)}</p>
    </section>

    <section class="panel" aria-labelledby="steps-title">
      <h2 id="steps-title">解题步骤</h2>
      <ol class="steps">
        ${steps}
      </ol>
    </section>
  </main>
</body>
</html>`;
}

function getKindLabel(kind: ProblemDemoPlan["kind"]): string {
  if (kind === "engineering") return "工程题";
  if (kind === "geometry") return "几何题";

  return "通用演示";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
