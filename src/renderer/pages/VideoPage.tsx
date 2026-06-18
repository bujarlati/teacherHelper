import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { LocalTeachingDemoResult, VideoImageSize } from "../../shared/types";
import type { VideoRecord } from "../../main/historyStore";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

const imageSizes: VideoImageSize[] = ["1280x720", "720x1280", "960x960"];
const videoAutoRefreshMs = 30_000;
const queueClockRefreshMs = 60_000;
const longQueueWarningMinutes = 30;

export function VideoPage(): ReactElement {
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [imageSize, setImageSize] = useState<VideoImageSize>("1280x720");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [video, setVideo] = useState<VideoRecord | undefined>();
  const [localDemo, setLocalDemo] = useState<LocalTeachingDemoResult | undefined>();
  const [videoFeedback, setVideoFeedback] = useState("");
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "输入提示词后生成视频。" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingLocalDemo, setIsGeneratingLocalDemo] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isBusy = isGenerating || isGeneratingLocalDemo || isRefreshing;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), queueClockRefreshMs);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!video || !canAutoRefreshVideo(video.status) || isGenerating || isRefreshing) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void refreshVideoById(video.id, true);
    }, videoAutoRefreshMs);

    return () => window.clearTimeout(timer);
  }, [video?.id, video?.status, video?.updatedAt, isGenerating, isRefreshing]);

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setStatus({ tone: "error", text: "请先输入视频提示词。" });
      return;
    }

    setIsGenerating(true);
    setStatus({ tone: "muted", text: "正在提交视频任务..." });

    try {
      const imageDataUrl = imageFile ? await readFileAsDataUrl(imageFile) : undefined;
      const nextVideo = await api.generateVideo({
        prompt: trimmedPrompt,
        script: script.trim(),
        imageSize,
        negativePrompt: negativePrompt.trim() || undefined,
        imageDataUrl
      });

      setVideo(nextVideo);
      setStatus({ tone: "success", text: `视频任务已提交：${nextVideo.status}` });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "生成视频失败，请检查设置后重试。") });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefresh(): Promise<void> {
    if (!video) return;

    await refreshVideoById(video.id, false);
  }

  async function handleGenerateLocalDemo(): Promise<void> {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setStatus({ tone: "error", text: "请先输入视频提示词。" });
      return;
    }

    setIsGeneratingLocalDemo(true);
    setStatus({ tone: "muted", text: "正在生成本地教学演示..." });

    try {
      const nextDemo = await api.generateLocalTeachingDemo({
        prompt: trimmedPrompt,
        script: script.trim() || undefined
      });

      setLocalDemo(nextDemo);
      setStatus({ tone: "success", text: "本地教学演示已生成并打开。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "生成本地教学演示失败。") });
    } finally {
      setIsGeneratingLocalDemo(false);
    }
  }

  async function handleRefineVideo(): Promise<void> {
    if (!video && !localDemo) return;

    const feedback = videoFeedback.trim();
    if (!feedback) {
      setStatus({ tone: "error", text: "请先输入修改要求。" });
      return;
    }

    setIsGenerating(true);
    setStatus({ tone: "muted", text: "正在根据修改要求重新提交视频任务..." });

    try {
      const imageDataUrl = imageFile ? await readFileAsDataUrl(imageFile) : undefined;
      const refinedInput = createVideoRefinementInput({
        prompt,
        script,
        feedback,
        video,
        localDemo
      });
      const nextVideo = await api.generateVideo({
        prompt: refinedInput.prompt,
        script: refinedInput.script,
        imageSize,
        negativePrompt: negativePrompt.trim() || undefined,
        imageDataUrl
      });

      setVideo(nextVideo);
      setVideoFeedback("");
      setStatus({ tone: "success", text: `视频任务已按修改要求提交：${nextVideo.status}` });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "修改视频失败，请检查设置后重试。") });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRefineLocalDemo(): Promise<void> {
    if (!video && !localDemo) return;

    const feedback = videoFeedback.trim();
    if (!feedback) {
      setStatus({ tone: "error", text: "请先输入修改要求。" });
      return;
    }

    setIsGeneratingLocalDemo(true);
    setStatus({ tone: "muted", text: "正在根据修改要求更新本地演示..." });

    try {
      const refinedInput = createVideoRefinementInput({
        prompt,
        script,
        feedback,
        video,
        localDemo
      });
      const nextDemo = await api.generateLocalTeachingDemo(refinedInput);

      setLocalDemo(nextDemo);
      setVideoFeedback("");
      setStatus({ tone: "success", text: "本地教学演示已按修改要求生成并打开。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "修改本地教学演示失败。") });
    } finally {
      setIsGeneratingLocalDemo(false);
    }
  }

  async function refreshVideoById(videoId: string, automatic: boolean): Promise<void> {
    setIsRefreshing(true);
    setStatus({ tone: "muted", text: automatic ? "正在自动刷新视频状态..." : "正在刷新视频状态..." });

    try {
      const nextVideo = await api.refreshVideo(videoId);
      setVideo(nextVideo);
      setStatus({
        tone: nextVideo.status === "Failed" ? "error" : "success",
        text: getVideoRefreshStatus(nextVideo, automatic)
      });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "刷新视频状态失败。") });
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>): void {
    setImageFile(event.target.files?.[0]);
  }

  return (
    <section className="workspace-panel" aria-labelledby="video-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">视频生成</p>
          <h1 id="video-title">视频生成</h1>
        </div>
        <p className={`status-text status-${status.tone}`} role="status">{status.text}</p>
      </div>

      <form className="workflow-form" onSubmit={(event) => void handleGenerate(event)}>
        <label>
          <span>提示词</span>
          <textarea
            rows={4}
            disabled={isBusy}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：用简洁课堂动画展示数轴上 A+B 的过程"
          />
        </label>
        <label>
          <span>脚本/分镜</span>
          <textarea
            rows={5}
            disabled={isBusy}
            value={script}
            onChange={(event) => setScript(event.target.value)}
            placeholder="例如：先出现数轴，再显示 A 的跳跃，接着显示 B 的跳跃，最后高亮 A+B"
          />
        </label>
        <fieldset className="compact-fieldset">
          <label>
            <span>参考图片</span>
            <input type="file" accept="image/*" disabled={isBusy} onChange={handleImageChange} />
          </label>
          <label>
            <span>尺寸</span>
            <select
              disabled={isBusy}
              value={imageSize}
              onChange={(event) => setImageSize(event.target.value as VideoImageSize)}
            >
              {imageSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </fieldset>
        <label>
          <span>负面提示词</span>
          <textarea
            rows={2}
            disabled={isBusy}
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value)}
            placeholder="例如：blurry, distorted text, low quality"
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={isBusy}>生成视频</button>
          <button type="button" className="secondary-button" disabled={isBusy} onClick={() => void handleGenerateLocalDemo()}>
            生成本地演示
          </button>
          <button type="button" className="secondary-button" disabled={isBusy || !video} onClick={() => void handleRefresh()}>
            刷新状态
          </button>
        </div>
      </form>

      {imageFile ? <p className="path-output">参考图片：{imageFile.name}</p> : null}

      {video || localDemo ? (
        <section className="result-section" aria-labelledby="video-refinement-title">
          <h2 id="video-refinement-title">二次修改</h2>
          <form className="refinement-form">
            <label>
              <span>视频修改要求</span>
              <textarea
                rows={3}
                disabled={isBusy}
                value={videoFeedback}
                onChange={(event) => setVideoFeedback(event.target.value)}
                placeholder="例如：放慢节奏、加入停顿提问、改成竖屏、突出关键公式"
              />
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={isBusy}
                onClick={() => void handleRefineVideo()}
              >
                根据要求重新生成视频
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={isBusy}
                onClick={() => void handleRefineLocalDemo()}
              >
                根据要求修改本地演示
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {localDemo ? (
        <section className="result-section" aria-labelledby="local-demo-result-title">
          <h2 id="local-demo-result-title">本地教学演示</h2>
          <dl className="metadata-list">
            <div>
              <dt>标题</dt>
              <dd>{localDemo.title}</dd>
            </div>
            <div>
              <dt>预览</dt>
              <dd>
                <a className="secondary-link" href={localDemo.url} target="_blank" rel="noreferrer">打开本地演示</a>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {video ? (
        <section className="result-section" aria-labelledby="video-result-title">
          <h2 id="video-result-title">视频任务</h2>
          <dl className="metadata-list">
            <div>
              <dt>状态</dt>
              <dd>状态：{video.status}</dd>
            </div>
            <div>
              <dt>请求</dt>
              <dd>请求：{video.requestId}</dd>
            </div>
            <div>
              <dt>尺寸</dt>
              <dd>{video.imageSize ?? imageSize}</dd>
            </div>
            {canAutoRefreshVideo(video.status) ? (
              <div>
                <dt>排队</dt>
                <dd>
                  {formatQueueDuration(video.createdAt, nowMs)}
                  {isLongQueued(video.createdAt, nowMs) ? (
                    <span className="inline-warning">排队超过 30 分钟，可能服务商拥堵，建议重试或换模型。</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {video.videoUrl ? (
              <div>
                <dt>视频</dt>
                <dd>
                  <VideoPreview video={video} />
                </dd>
              </div>
            ) : null}
            {video.localVideoPath ? (
              <div>
                <dt>本地</dt>
                <dd>{video.localVideoPath}</dd>
              </div>
            ) : null}
            {video.reason ? (
              <div>
                <dt>说明</dt>
                <dd>{video.reason}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </section>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("读取参考图片失败。"));
    });
    reader.addEventListener("error", () => reject(new Error("读取参考图片失败。")));
    reader.readAsDataURL(file);
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getVideoRefreshStatus(video: VideoRecord, automatic = false): string {
  if (video.status === "Succeed") return video.localVideoPath ? "视频已生成并保存到本地。" : "视频已生成。";
  if (video.status === "Failed") return "视频生成失败。";

  return `${automatic ? "自动刷新" : "视频状态已刷新"}：${video.status}`;
}

function VideoPreview({ video }: { video: VideoRecord }): ReactElement {
  const url = getVideoPlaybackUrl(video);

  return (
    <div className="video-preview-block">
      <video className="video-preview" controls preload="metadata" src={url} aria-label="生成视频预览" />
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

function getVideoPlaybackUrl(video: VideoRecord): string {
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

function createVideoRefinementInput(input: {
  prompt: string;
  script: string;
  feedback: string;
  video?: VideoRecord;
  localDemo?: LocalTeachingDemoResult;
}): { prompt: string; script: string } {
  const currentScript = input.script.trim();
  const currentPrompt = input.prompt.trim();
  const videoContext = input.video
    ? `当前视频任务：${input.video.id}，状态：${input.video.status}，请求：${input.video.requestId}`
    : "当前视频任务：暂无";
  const localDemoContext = input.localDemo
    ? `当前本地演示：${input.localDemo.title}，地址：${input.localDemo.url}`
    : "当前本地演示：暂无";

  return {
    prompt: [
      "请基于以下已有视频/本地演示方案进行二次修改，并输出更符合修改要求的新方案。",
      `原提示词：${currentPrompt}`,
      `原脚本/分镜：${currentScript || "暂无"}`,
      videoContext,
      localDemoContext,
      `修改要求：${input.feedback}`
    ].join("\n\n"),
    script: currentScript
      ? `${currentScript}\n\n二次修改要求：${input.feedback}`
      : `二次修改要求：${input.feedback}`
  };
}
