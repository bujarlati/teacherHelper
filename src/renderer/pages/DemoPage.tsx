import { FormEvent, useState } from "react";
import type { ReactElement } from "react";
import type { ProblemDemoPlan } from "../../shared/types";
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

export function DemoPage(): ReactElement {
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<DemoResult | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "输入题目后生成课堂演示。" });
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedProblem = problem.trim();
    if (!trimmedProblem) {
      setStatus({ tone: "error", text: "请先输入题目。" });
      return;
    }

    setIsGenerating(true);
    setStatus({ tone: "muted", text: "正在生成演示..." });

    try {
      const nextResult = await api.generateDemo(trimmedProblem);
      setResult(nextResult);
      setStatus({ tone: "success", text: "演示已生成并打开。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "生成演示失败，请检查设置后重试。") });
    } finally {
      setIsGenerating(false);
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
        </section>
      ) : null}
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
