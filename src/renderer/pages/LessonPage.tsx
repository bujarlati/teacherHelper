import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { LessonPlan, VideoTask } from "../../shared/types";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

type LessonResult = {
  id: string;
  lesson: LessonPlan;
  videoTask?: VideoTask;
  videoError?: string;
};

type GenerationProgress = {
  phase: string;
  elapsedSeconds: number;
  percent: number;
  isSlow: boolean;
};

export function LessonPage(): ReactElement {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<LessonResult | undefined>();
  const [exportPath, setExportPath] = useState("");
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "输入课题后生成教案。" });
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const hasLesson = Boolean(result);
  const isBusy = isGenerating || isExporting || isCopying;

  useEffect(() => {
    if (!isGenerating) return undefined;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setGenerationProgress(createGenerationProgress(elapsedSeconds));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isGenerating]);

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setStatus({ tone: "error", text: "请先输入课题。" });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(createGenerationProgress(0));
    setExportPath("");
    setStatus({ tone: "muted", text: "正在生成教案..." });

    try {
      const nextResult = await api.generateLesson(trimmedTopic);
      setResult(nextResult);
      setStatus({
        tone: nextResult.videoError ? "error" : "success",
        text: getLessonGenerateStatus(nextResult)
      });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "生成教案失败，请检查设置后重试。") });
    } finally {
      setGenerationProgress(undefined);
      setIsGenerating(false);
    }
  }

  async function handleCopy(): Promise<void> {
    if (!result) return;

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(result.lesson.markdown);
      setStatus({ tone: "success", text: "Markdown 已复制。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "复制失败。") });
    } finally {
      setIsCopying(false);
    }
  }

  async function handleExport(): Promise<void> {
    if (!result) return;

    setIsExporting(true);
    setStatus({ tone: "muted", text: "正在导出 Word..." });

    try {
      const filePath = await api.exportLessonDocx({
        id: result.id,
        title: result.lesson.title,
        lesson: result.lesson
      });
      setExportPath(filePath);
      setStatus({ tone: "success", text: "Word 已导出。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "导出 Word 失败。") });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="lesson-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">今日备课</p>
          <h1 id="lesson-title">教案生成</h1>
        </div>
        <p className={`status-text status-${status.tone}`} role="status">{status.text}</p>
      </div>

      <form className="workflow-form" onSubmit={(event) => void handleGenerate(event)}>
        <label>
          <span>课题</span>
          <textarea
            rows={4}
            disabled={isBusy}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="例如：八年级数学一次函数复习"
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={isBusy}>生成教案</button>
          <button type="button" className="secondary-button" disabled={isBusy || !hasLesson} onClick={() => void handleCopy()}>
            复制 Markdown
          </button>
          <button type="button" className="secondary-button" disabled={isBusy || !hasLesson} onClick={() => void handleExport()}>
            导出 Word
          </button>
        </div>
      </form>

      {generationProgress ? (
        <section className="generation-progress" aria-label="教案生成进度说明">
          <div className="progress-heading">
            <strong>{generationProgress.phase}</strong>
            <span>已等待 {generationProgress.elapsedSeconds} 秒</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="教案生成进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={generationProgress.percent}
          >
            <span style={{ width: `${generationProgress.percent}%` }} />
          </div>
          {generationProgress.isSlow ? (
            <p>模型仍在生成，可能是网络或模型排队较慢。</p>
          ) : null}
        </section>
      ) : null}

      {exportPath ? (
        <p className="path-output" aria-label="导出路径">{exportPath}</p>
      ) : null}

      {result ? (
        <section className="result-section" aria-labelledby="lesson-result-title">
          <h2 id="lesson-result-title">{result.lesson.title}</h2>
          <pre className="markdown-output">{result.lesson.markdown}</pre>
        </section>
      ) : null}
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getLessonGenerateStatus(result: LessonResult): string {
  if (result.videoTask) {
    return `视频任务已提交：${result.videoTask.status}`;
  }
  if (result.videoError) {
    return `教案已生成，视频任务提交失败：${result.videoError}`;
  }

  return "未配置视频模型，仅保留视频脚本和提示词。";
}

function createGenerationProgress(elapsedSeconds: number): GenerationProgress {
  return {
    phase: elapsedSeconds < 3 ? "准备请求" : "等待硅基流动模型返回",
    elapsedSeconds,
    percent: Math.min(92, 8 + elapsedSeconds * 2),
    isSlow: elapsedSeconds >= 60
  };
}
