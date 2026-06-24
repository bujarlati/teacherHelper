import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { ProblemDemoPlan } from "../../shared/types";
import type { HistoryListResult } from "../api";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

type DemoResult = {
  id: string;
  plan: ProblemDemoPlan;
  url: string;
};

type DemoHistoryItem = HistoryListResult["demos"][number];

type GenerationProgress = {
  phase: string;
  elapsedSeconds: number;
  percent: number;
  isSlow: boolean;
};

export function DemoPage(): ReactElement {
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<DemoResult | undefined>();
  const [demoFeedback, setDemoFeedback] = useState("");
  const [demoHistory, setDemoHistory] = useState<DemoHistoryItem[]>([]);
  const [openingDemoIds, setOpeningDemoIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "输入题目后生成课堂演示。" });
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    void refreshDemoHistory();
  }, []);

  useEffect(() => {
    if (!isGenerating) return undefined;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setGenerationProgress(createDemoGenerationProgress(elapsedSeconds));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isGenerating]);

  async function refreshDemoHistory(): Promise<void> {
    try {
      const history = await api.listHistory();
      setDemoHistory((history?.demos ?? []).slice(0, 6));
    } catch {
      // History is helpful context, but it must not block creating a new demo.
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedProblem = problem.trim();
    if (!trimmedProblem) {
      setStatus({ tone: "error", text: "请先输入题目。" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(createDemoGenerationProgress(0));
    setStatus({ tone: "muted", text: "正在生成演示..." });

    try {
      const nextResult = await api.generateDemo(trimmedProblem);
      setResult(nextResult);
      await refreshDemoHistory();
      setStatus({ tone: "success", text: "演示已生成并打开。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "生成演示失败，请检查设置后重试。") });
    } finally {
      setGenerationProgress(undefined);
      setIsGenerating(false);
    }
  }

  async function handleRefine(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!result) return;

    const feedback = demoFeedback.trim();
    if (!feedback) {
      setStatus({ tone: "error", text: "请先输入修改要求。" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(createDemoGenerationProgress(0));
    setStatus({ tone: "muted", text: "正在根据修改要求更新演示..." });

    try {
      const nextResult = await api.generateDemo(createDemoRefinementProblem(problem, result.plan, feedback));
      setResult(nextResult);
      setDemoFeedback("");
      await refreshDemoHistory();
      setStatus({ tone: "success", text: "演示已按修改要求重新生成并打开。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "修改演示失败，请检查设置后重试。") });
    } finally {
      setGenerationProgress(undefined);
      setIsGenerating(false);
    }
  }

  async function handleOpenDemo(demo: DemoHistoryItem): Promise<void> {
    setOpeningDemoIds((current) => new Set(current).add(demo.id));
    setStatus({ tone: "muted", text: "正在打开历史演示..." });

    try {
      const url = await api.openDemo(demo.id);
      setStatus({ tone: "success", text: `历史演示已打开：${url}` });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "打开历史演示失败。") });
    } finally {
      setOpeningDemoIds((current) => {
        const next = new Set(current);
        next.delete(demo.id);
        return next;
      });
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="demo-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">题目演示</p>
          <h1 id="demo-title">课堂演示生成</h1>
        </div>
        <p className={`status-text status-${status.tone}`} role="status">{status.text}</p>
      </div>

      <form className="workflow-form" onSubmit={(event) => void handleGenerate(event)}>
        <label>
          <span>题目</span>
          <textarea
            rows={5}
            disabled={isGenerating}
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            placeholder="粘贴一道需要动态演示的题目"
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={isGenerating}>生成演示</button>
        </div>
      </form>

      {generationProgress ? (
        <section className="generation-progress" aria-label="题目演示生成进度说明">
          <div className="progress-heading">
            <strong>{generationProgress.phase}</strong>
            <span>已等待 {generationProgress.elapsedSeconds} 秒</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="题目演示生成进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={generationProgress.percent}
          >
            <span style={{ width: `${generationProgress.percent}%` }} />
          </div>
          {generationProgress.isSlow ? (
            <p>正在进行高强度思考和可交互网页生成，复杂题目可能需要 1 到 3 分钟。</p>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section className="result-section" aria-labelledby="demo-result-title">
          <h2 id="demo-result-title">{result.plan.title}</h2>
          <dl className="metadata-list">
            <div>
              <dt>类型</dt>
              <dd>{result.plan.kind}</dd>
            </div>
            <div>
              <dt>地址</dt>
              <dd>{result.url}</dd>
            </div>
          </dl>
          <form className="refinement-form" onSubmit={(event) => void handleRefine(event)}>
            <label>
              <span>演示修改要求</span>
              <textarea
                rows={3}
                disabled={isGenerating}
                value={demoFeedback}
                onChange={(event) => setDemoFeedback(event.target.value)}
                placeholder="例如：放慢动画、突出关键数量关系、加入互动提问"
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="secondary-button" disabled={isGenerating}>根据要求修改演示</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="result-section" aria-labelledby="demo-history-title">
        <h2 id="demo-history-title">最近演示记录</h2>
        {demoHistory.length > 0 ? (
          <ul className="record-list">
            {demoHistory.map((demo) => (
              <li key={demo.id}>
                <strong>{demo.title}</strong>
                <span>类型：{demo.kind}</span>
                <span>{demo.problem}</span>
                <span>{formatDate(demo.createdAt)}</span>
                <div className="record-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={openingDemoIds.has(demo.id)}
                    onClick={() => void handleOpenDemo(demo)}
                  >
                    打开演示
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">暂无题目演示记录。</p>
        )}
      </section>
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function createDemoRefinementProblem(problem: string, plan: ProblemDemoPlan, feedback: string): string {
  return [
    "请基于以下已有课堂演示进行二次修改，并重新生成完整可交互网页方案。",
    `原始题目：${problem.trim() || plan.originalProblem}`,
    `当前演示标题：${plan.title}`,
    `当前演示类型：${plan.kind}`,
    `当前目标：${plan.target}`,
    `当前步骤：${plan.steps.join("；")}`,
    `修改要求：${feedback}`
  ].join("\n\n");
}

function createDemoGenerationProgress(elapsedSeconds: number): GenerationProgress {
  const phase = elapsedSeconds < 4
    ? "生成教学设计预案"
    : elapsedSeconds < 16
      ? "等待模型完成深度思考"
      : "生成互动网页结构";

  return {
    phase,
    elapsedSeconds,
    percent: Math.min(94, 12 + elapsedSeconds * 3),
    isSlow: elapsedSeconds >= 30
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
