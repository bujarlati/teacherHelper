import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { HistoryDeleteInput, HistoryListResult } from "../api";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

type LessonHistoryItem = HistoryListResult["lessons"][number];
type DemoHistoryItem = HistoryListResult["demos"][number];
type VideoHistoryItem = HistoryListResult["videos"][number];

const videoAutoRefreshMs = 30_000;
const queueClockRefreshMs = 60_000;
const longQueueWarningMinutes = 30;

export function HistoryPage(): ReactElement {
  const [history, setHistory] = useState<HistoryListResult | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "正在读取历史记录..." });
  const [isLoading, setIsLoading] = useState(true);
  const [openingDemoIds, setOpeningDemoIds] = useState<Set<string>>(() => new Set());
  const [refreshingVideoIds, setRefreshingVideoIds] = useState<Set<string>>(() => new Set());
  const [deletingRecordKeys, setDeletingRecordKeys] = useState<Set<string>>(() => new Set());
  const [selectedLesson, setSelectedLesson] = useState<LessonHistoryItem | undefined>();
  const [isCopyingLesson, setIsCopyingLesson] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

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

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), queueClockRefreshMs);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshableVideos = history?.videos.filter((video) => canAutoRefreshVideo(video.status)) ?? [];
    if (refreshableVideos.length === 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      for (const video of refreshableVideos) {
        if (!refreshingVideoIds.has(video.id)) {
          void handleRefreshVideo(video.id, true);
        }
      }
    }, videoAutoRefreshMs);

    return () => window.clearTimeout(timer);
  }, [history, refreshingVideoIds]);

  const isEmpty = history
    ? history.lessons.length === 0 && history.demos.length === 0 && history.videos.length === 0
    : false;
  const selectedLessonDemo = selectedLesson && history
    ? findLinkedDemoForLesson(selectedLesson, history.demos)
    : undefined;

  async function handleRefreshVideo(videoId: string, automatic = false): Promise<void> {
    setRefreshingVideoIds((current) => new Set(current).add(videoId));
    setStatus({ tone: "muted", text: automatic ? "正在自动刷新视频状态..." : "正在刷新视频状态..." });

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
        text: getVideoRefreshStatus(updatedVideo)
      });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "刷新视频状态失败。") });
    } finally {
      setRefreshingVideoIds((current) => {
        const next = new Set(current);
        next.delete(videoId);
        return next;
      });
    }
  }

  function handleOpenLesson(lesson: LessonHistoryItem): void {
    setSelectedLesson(lesson);
    setStatus({
      tone: lesson.markdown ? "success" : "error",
      text: lesson.markdown ? "历史教案已打开。" : "这条历史记录没有保存教案正文。"
    });
  }

  async function handleOpenDemo(demo: DemoHistoryItem): Promise<void> {
    setOpeningDemoIds((current) => new Set(current).add(demo.id));
    setStatus({ tone: "muted", text: "正在打开历史演示..." });

    try {
      const url = await api.openDemo(demo.id);
      setStatus({ tone: "success", text: `演示已打开：${url}` });
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

  async function handleDeleteHistoryRecord(kind: HistoryDeleteInput["kind"], id: string): Promise<void> {
    const recordKey = createRecordKey(kind, id);
    setDeletingRecordKeys((current) => new Set(current).add(recordKey));
    setStatus({ tone: "muted", text: "正在删除历史记录..." });

    try {
      const nextHistory = await api.deleteHistoryRecord({ kind, id });
      setHistory(nextHistory);
      setSelectedLesson((currentLesson) => {
        if (!currentLesson) return currentLesson;
        const nextSelectedLesson = nextHistory.lessons.find((lesson) => lesson.id === currentLesson.id);
        return nextSelectedLesson;
      });
      setStatus({ tone: "success", text: "历史记录已删除。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "删除历史记录失败。") });
    } finally {
      setDeletingRecordKeys((current) => {
        const next = new Set(current);
        next.delete(recordKey);
        return next;
      });
    }
  }

  async function handleCopyLessonMarkdown(): Promise<void> {
    if (!selectedLesson?.markdown) return;

    setIsCopyingLesson(true);
    try {
      await navigator.clipboard.writeText(selectedLesson.markdown);
      setStatus({ tone: "success", text: "历史教案 Markdown 已复制。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "复制历史教案失败。") });
    } finally {
      setIsCopyingLesson(false);
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
              {history.lessons.map((lesson) => {
                const linkedDemo = findLinkedDemoForLesson(lesson, history.demos);

                return (
                  <li key={lesson.id} className={selectedLesson?.id === lesson.id ? "selected-record" : ""}>
                    <strong>{lesson.title}</strong>
                    <span>课题：{lesson.topic}</span>
                    <span>{formatDate(lesson.createdAt)}</span>
                    {lesson.wordPath ? <span>{lesson.wordPath}</span> : null}
                    {linkedDemo ? <span>课件：{linkedDemo.demoPath}</span> : null}
                    <div className="record-actions">
                      <button type="button" className="secondary-button" onClick={() => handleOpenLesson(lesson)}>
                        查看教案
                      </button>
                      {linkedDemo ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={openingDemoIds.has(linkedDemo.id)}
                          onClick={() => void handleOpenDemo(linkedDemo)}
                        >
                          打开课件
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={`删除教案 ${lesson.title}`}
                        disabled={deletingRecordKeys.has(createRecordKey("lesson", lesson.id))}
                        onClick={() => void handleDeleteHistoryRecord("lesson", lesson.id)}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
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
                  <div className="record-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={openingDemoIds.has(demo.id)}
                      onClick={() => void handleOpenDemo(demo)}
                    >
                      打开演示
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`删除演示 ${demo.title}`}
                      disabled={deletingRecordKeys.has(createRecordKey("demo", demo.id))}
                      onClick={() => void handleDeleteHistoryRecord("demo", demo.id)}
                    >
                      删除
                    </button>
                  </div>
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
                  {canAutoRefreshVideo(video.status) ? (
                    <>
                      <span>{formatQueueDuration(video.createdAt, nowMs)}</span>
                      {isLongQueued(video.createdAt, nowMs) ? (
                        <span className="inline-warning">排队超过 30 分钟，可能服务商拥堵，建议重试或换模型。</span>
                      ) : null}
                    </>
                  ) : null}
                  {video.videoUrl ? (
                    <VideoPreview video={video} label={`视频任务 ${video.id} 预览`} />
                  ) : null}
                  {video.localVideoPath ? <span>本地保存：{video.localVideoPath}</span> : null}
                  {video.reason ? <span>{video.reason}</span> : null}
                  <div className="record-actions">
                    {canRefreshVideo(video.status) ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={refreshingVideoIds.has(video.id)}
                        onClick={() => void handleRefreshVideo(video.id)}
                      >
                        刷新状态
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`删除视频 ${video.id}`}
                      disabled={deletingRecordKeys.has(createRecordKey("video", video.id))}
                      onClick={() => void handleDeleteHistoryRecord("video", video.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {selectedLesson ? (
        <section className="result-section" aria-labelledby="history-lesson-detail-title">
          <div className="detail-heading">
            <div>
              <p className="eyebrow">历史教案</p>
              <h2 id="history-lesson-detail-title">{selectedLesson.title}</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={isCopyingLesson || !selectedLesson.markdown}
              onClick={() => void handleCopyLessonMarkdown()}
            >
              复制 Markdown
            </button>
            {selectedLessonDemo ? (
              <button
                type="button"
                className="secondary-button"
                disabled={openingDemoIds.has(selectedLessonDemo.id)}
                onClick={() => void handleOpenDemo(selectedLessonDemo)}
              >
                打开课件
              </button>
            ) : null}
          </div>
          {selectedLesson.markdown ? (
            <pre className="markdown-output">{selectedLesson.markdown}</pre>
          ) : (
            <p className="empty-state">这条历史记录没有保存教案正文。</p>
          )}
        </section>
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

function findLinkedDemoForLesson(
  lesson: LessonHistoryItem,
  demos: DemoHistoryItem[]
): DemoHistoryItem | undefined {
  return demos.find((demo) => demo.id === lesson.demoId) ?? demos.find((demo) => demo.id === lesson.id);
}

function createRecordKey(kind: HistoryDeleteInput["kind"], id: string): string {
  return `${kind}:${id}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function canRefreshVideo(status: string): boolean {
  return status === "InQueue" || status === "InProgress" || status === "Succeed";
}

function getVideoRefreshStatus(video: VideoHistoryItem): string {
  if (video.status === "Succeed") return video.localVideoPath ? "视频已生成并保存到本地。" : "视频已生成。";
  if (video.status === "Failed") return "视频生成失败。";

  return `视频状态已刷新：${video.status}`;
}

function VideoPreview({ video, label }: { video: VideoHistoryItem; label: string }): ReactElement {
  const url = getVideoPlaybackUrl(video);

  return (
    <div className="video-preview-block">
      <video className="video-preview" controls preload="metadata" src={url} aria-label={label} />
      <div className="record-actions">
        <a className="secondary-link" href={url} target="_blank" rel="noreferrer">打开视频</a>
      </div>
    </div>
  );
}

function canAutoRefreshVideo(status: string): boolean {
  return status === "InQueue" || status === "InProgress";
}

function formatQueueDuration(createdAt: string, nowMs: number): string {
  const minutes = getQueueMinutes(createdAt, nowMs);
  if (minutes < 1) return "排队：不足 1 分钟";
  if (minutes < 60) return `排队：${minutes} 分钟`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `排队：${hours} 小时` : `排队：${hours} 小时 ${remainingMinutes} 分钟`;
}

function isLongQueued(createdAt: string, nowMs: number): boolean {
  return getQueueMinutes(createdAt, nowMs) >= longQueueWarningMinutes;
}

function getQueueMinutes(createdAt: string, nowMs: number): number {
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowMs - createdMs) / 60_000));
}

function getVideoPlaybackUrl(video: VideoHistoryItem): string {
  return video.localVideoPath ? toFileUrl(video.localVideoPath) : video.videoUrl ?? "";
}

function toFileUrl(filePath: string): string {
  if (filePath.startsWith("file://")) {
    return filePath;
  }

  const normalized = filePath.replace(/\\/g, "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";
  const encoded = normalized
    .split("/")
    .map((segment, index) => (index === 0 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)))
    .join("/");

  return `${prefix}${encoded}`;
}
