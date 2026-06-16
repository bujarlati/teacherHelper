import { ChangeEvent, FormEvent, useState } from "react";
import type { ReactElement } from "react";
import type { VideoImageSize } from "../../shared/types";
import type { VideoRecord } from "../../main/historyStore";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

const imageSizes: VideoImageSize[] = ["1280x720", "720x1280", "960x960"];

export function VideoPage(): ReactElement {
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [imageSize, setImageSize] = useState<VideoImageSize>("1280x720");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [video, setVideo] = useState<VideoRecord | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "输入提示词后生成视频。" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isBusy = isGenerating || isRefreshing;

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

    setIsRefreshing(true);
    setStatus({ tone: "muted", text: "正在刷新视频状态..." });

    try {
      const nextVideo = await api.refreshVideo(video.id);
      setVideo(nextVideo);
      setStatus({
        tone: nextVideo.status === "Failed" ? "error" : "success",
        text: getVideoRefreshStatus(nextVideo)
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
          <button type="button" className="secondary-button" disabled={isBusy || !video} onClick={() => void handleRefresh()}>
            刷新状态
          </button>
        </div>
      </form>

      {imageFile ? <p className="path-output">参考图片：{imageFile.name}</p> : null}

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
            {video.videoUrl ? (
              <div>
                <dt>视频</dt>
                <dd>{video.videoUrl}</dd>
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

function getVideoRefreshStatus(video: VideoRecord): string {
  if (video.status === "Succeed") return "视频已生成。";
  if (video.status === "Failed") return "视频生成失败。";

  return `视频状态已刷新：${video.status}`;
}
