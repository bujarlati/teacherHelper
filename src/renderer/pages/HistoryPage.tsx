import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { HistoryListResult } from "../api";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

export function HistoryPage(): ReactElement {
  const [history, setHistory] = useState<HistoryListResult | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "正在读取历史记录..." });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingVideoId, setRefreshingVideoId] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const nextHistory = await api.listHistory();
        if (!isMounted) return;

        setHistory(nextHistory);
        setStatus({ tone: "success", text: "历史记录已加载。" });
      } catch (error) {
        if (isMounted) {
          setStatus({ tone: "error", text: getErrorMessage(error, "读取历史记录失败。") });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const isEmpty = history
    ? history.lessons.length === 0 && history.demos.length === 0 && history.videos.length === 0
    : false;

  async function handleRefreshVideo(videoId: string): Promise<void> {
    setRefreshingVideoId(videoId);
    setStatus({ tone: "muted", text: "正在刷新视频状态..." });

    try {
      const updatedVideo = await api.refreshVideo(videoId);
      setHistory((currentHistory) => {
        if (!currentHistory) return currentHistory;

        return {
          ...currentHistory,
          videos: currentHistory.videos.map((video) => (video.id === updatedVideo.id ? updatedVideo : video))
        };
      });
      setStatus({
        tone: updatedVideo.status === "Failed" ? "error" : "success",
        text: getVideoRefreshStatus(updatedVideo.status)
      });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "刷新视频状态失败。") });
    } finally {
      setRefreshingVideoId(undefined);
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="history-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">历史记录</p>
          <h1 id="history-title">生成记录</h1>
        </div>
        <p className={`status-text status-${status.tone}`} role="status">{status.text}</p>
      </div>

      {isLoading ? <p className="empty-state">正在加载...</p> : null}
      {!isLoading && isEmpty ? <p className="empty-state">暂无生成记录。</p> : null}

      {history && !isEmpty ? (
        <div className="history-grid">
          <section aria-labelledby="lesson-history-title">
            <h2 id="lesson-history-title">教案</h2>
            <ul className="record-list">
              {history.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <strong>{lesson.title}</strong>
                  <span>课题：{lesson.topic}</span>
                  <span>{formatDate(lesson.createdAt)}</span>
                  {lesson.wordPath ? <span>{lesson.wordPath}</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="demo-history-title">
            <h2 id="demo-history-title">演示</h2>
            <ul className="record-list">
              {history.demos.map((demo) => (
                <li key={demo.id}>
                  <strong>{demo.title}</strong>
                  <span>类型：{demo.kind}</span>
                  <span>{demo.problem}</span>
                  <span>{demo.demoPath}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="video-history-title">
            <h2 id="video-history-title">视频</h2>
            <ul className="record-list">
              {history.videos.map((video) => (
                <li key={video.id}>
                  <strong>视频任务 {video.id}</strong>
                  <span>状态：{video.status}</span>
                  <span>请求：{video.requestId}</span>
                  {video.videoUrl ? <span>{video.videoUrl}</span> : null}
                  {video.reason ? <span>{video.reason}</span> : null}
                  {canRefreshVideo(video.status) ? (
                    <div className="record-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={refreshingVideoId === video.id}
                        onClick={() => void handleRefreshVideo(video.id)}
                      >
                        刷新状态
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function canRefreshVideo(status: string): boolean {
  return status === "InQueue" || status === "InProgress";
}

function getVideoRefreshStatus(status: string): string {
  if (status === "Succeed") return "视频已生成。";
  if (status === "Failed") return "视频生成失败。";

  return `视频状态已刷新：${status}`;
}
