import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  defaultEmbeddingModelName,
  defaultImageModelName,
  defaultQdrantCollectionPrefix,
  defaultQdrantUrl,
  defaultRerankerModelName,
  defaultVideoStorageDirectory
} from "../../shared/schemas";
import type { AppSettings, LocalQdrantStatus } from "../../shared/types";
import { api } from "../api";

function createEmptySettings(): AppSettings {
  return {
    textModel: {
      apiKey: "",
      modelName: ""
    },
    videoModel: {
      apiKey: "",
      modelName: ""
    },
    imageModel: {
      apiKey: "",
      modelName: defaultImageModelName
    },
    embeddingModel: {
      apiKey: "",
      modelName: defaultEmbeddingModelName
    },
    rerankerModel: {
      apiKey: "",
      modelName: defaultRerankerModelName
    },
    qdrant: {
      mode: "local",
      url: defaultQdrantUrl,
      apiKey: "",
      collectionPrefix: defaultQdrantCollectionPrefix
    },
    demoGeneration: {
      mode: "template"
    },
    videoStorage: {
      directory: defaultVideoStorageDirectory
    }
  };
}

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

export function SettingsPage(): ReactElement {
  const [settings, setSettings] = useState<AppSettings>(() => createEmptySettings());
  const [qdrantStatus, setQdrantStatus] = useState<LocalQdrantStatus | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "正在读取本机设置..." });
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const controlsDisabled = isLoading || isBusy;
  const isLocalQdrant = settings.qdrant.mode === "local";

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const loadedSettings = await api.loadSettings();

        if (!isMounted) {
          return;
        }

        setSettings(loadedSettings);
        setStatus({ tone: "muted", text: "设置仅保存在本机。" });
        void refreshQdrantStatus();
      } catch {
        if (isMounted) {
          setStatus({ tone: "error", text: "读取本机设置失败。" });
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

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    setStatus({ tone: "muted", text: "正在保存..." });

    try {
      await api.saveSettings(settings);
      setStatus({ tone: "success", text: "设置已保存到本机。" });
    } catch {
      setStatus({ tone: "error", text: "保存失败，请稍后重试。" });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClear(): Promise<void> {
    setIsBusy(true);
    setStatus({ tone: "muted", text: "正在清空..." });

    try {
      await api.clearSettings();
      setSettings(createEmptySettings());
      setStatus({ tone: "success", text: "本地设置已清空。" });
    } catch {
      setStatus({ tone: "error", text: "清空失败，请稍后重试。" });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTestKnowledgeConnections(): Promise<void> {
    setIsBusy(true);
    setStatus({ tone: "muted", text: "正在测试知识库连接..." });

    try {
      await api.saveSettings(settings);
      await api.testKnowledgeConnections();
      await refreshQdrantStatus();
      setStatus({ tone: "success", text: "知识库连接测试通过。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "知识库连接测试失败，请检查 API Key、模型名和 Qdrant 地址。") });
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshQdrantStatus(): Promise<void> {
    try {
      setQdrantStatus(await api.getQdrantStatus());
    } catch {
      setQdrantStatus(undefined);
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="settings-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">本机配置</p>
          <h1 id="settings-title">设置</h1>
        </div>
        <p className={`status-text status-${status.tone}`} role="status">{status.text}</p>
      </div>

      <form className="settings-form" onSubmit={(event) => void handleSave(event)}>
        <fieldset>
          <legend>文本模型</legend>
          <label>
            <span>文本 API Key</span>
            <input
              type="password"
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.textModel.apiKey}
              onChange={(event) => setSettings({
                ...settings,
                textModel: { ...settings.textModel, apiKey: event.target.value }
              })}
            />
          </label>
          <label>
            <span>文本模型名</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.textModel.modelName}
              onChange={(event) => setSettings({
                ...settings,
                textModel: { ...settings.textModel, modelName: event.target.value }
              })}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>题目演示</legend>
          <label>
            <span>题目演示模式</span>
            <select
              disabled={controlsDisabled}
              value={settings.demoGeneration.mode}
              onChange={(event) => setSettings({
                ...settings,
                demoGeneration: {
                  mode: event.target.value === "ai_html" ? "ai_html" : "template"
                }
              })}
            >
              <option value="template">稳定模板生成</option>
              <option value="ai_html">AI 独立生成完整网页</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>视频模型</legend>
          <label>
            <span>视频 API Key</span>
            <input
              type="password"
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.videoModel.apiKey}
              onChange={(event) => setSettings({
                ...settings,
                videoModel: { ...settings.videoModel, apiKey: event.target.value }
              })}
            />
          </label>
          <label>
            <span>视频模型名</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.videoModel.modelName}
              onChange={(event) => setSettings({
                ...settings,
                videoModel: { ...settings.videoModel, modelName: event.target.value }
              })}
            />
          </label>
          <label>
            <span>视频保存目录</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.videoStorage.directory}
              onChange={(event) => setSettings({
                ...settings,
                videoStorage: { directory: event.target.value }
              })}
              placeholder="留空则保存到本机应用数据目录"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>图片模型</legend>
          <label>
            <span>图片 API Key</span>
            <input
              type="password"
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.imageModel.apiKey}
              onChange={(event) => setSettings({
                ...settings,
                imageModel: { ...settings.imageModel, apiKey: event.target.value }
              })}
            />
          </label>
          <label>
            <span>图片模型名</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.imageModel.modelName}
              onChange={(event) => setSettings({
                ...settings,
                imageModel: { ...settings.imageModel, modelName: event.target.value }
              })}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>嵌入模型</legend>
          <label>
            <span>嵌入 API Key</span>
            <input
              type="password"
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.embeddingModel.apiKey}
              onChange={(event) => setSettings({
                ...settings,
                embeddingModel: { ...settings.embeddingModel, apiKey: event.target.value }
              })}
            />
          </label>
          <label>
            <span>嵌入模型名</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.embeddingModel.modelName}
              onChange={(event) => setSettings({
                ...settings,
                embeddingModel: { ...settings.embeddingModel, modelName: event.target.value }
              })}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>重排序模型</legend>
          <label>
            <span>重排序 API Key</span>
            <input
              type="password"
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.rerankerModel.apiKey}
              onChange={(event) => setSettings({
                ...settings,
                rerankerModel: { ...settings.rerankerModel, apiKey: event.target.value }
              })}
            />
          </label>
          <label>
            <span>重排序模型名</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.rerankerModel.modelName}
              onChange={(event) => setSettings({
                ...settings,
                rerankerModel: { ...settings.rerankerModel, modelName: event.target.value }
              })}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Qdrant 向量库</legend>
          <p className="field-note">{describeQdrantStatus(qdrantStatus)}</p>
          <label>
            <span>Qdrant 模式</span>
            <select
              disabled={controlsDisabled}
              value={settings.qdrant.mode}
              onChange={(event) => {
                const mode = event.target.value === "remote" ? "remote" : "local";
                setSettings({
                  ...settings,
                  qdrant: {
                    ...settings.qdrant,
                    mode,
                    url: mode === "local" ? defaultQdrantUrl : settings.qdrant.url,
                    apiKey: mode === "local" ? "" : settings.qdrant.apiKey
                  }
                });
              }}
            >
              <option value="local">本地自动启动</option>
              <option value="remote">远程服务</option>
            </select>
          </label>
          <label>
            <span>Qdrant 地址</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled || isLocalQdrant}
              value={settings.qdrant.url}
              onChange={(event) => setSettings({
                ...settings,
                qdrant: { ...settings.qdrant, url: event.target.value }
              })}
            />
          </label>
          <label>
            <span>Qdrant API Key</span>
            <input
              type="password"
              autoComplete="off"
              disabled={controlsDisabled || isLocalQdrant}
              value={settings.qdrant.apiKey}
              onChange={(event) => setSettings({
                ...settings,
                qdrant: { ...settings.qdrant, apiKey: event.target.value }
              })}
            />
          </label>
          <label>
            <span>集合前缀</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
              value={settings.qdrant.collectionPrefix}
              onChange={(event) => setSettings({
                ...settings,
                qdrant: { ...settings.qdrant, collectionPrefix: event.target.value }
              })}
            />
          </label>
        </fieldset>

        <div className="form-actions">
          <button type="submit" disabled={controlsDisabled}>保存设置</button>
          <button
            type="button"
            className="secondary-button"
            disabled={controlsDisabled}
            onClick={() => void handleTestKnowledgeConnections()}
          >
            测试知识库连接
          </button>
          <button type="button" className="secondary-button" disabled={controlsDisabled} onClick={() => void handleClear()}>
            清空本地设置
          </button>
        </div>
      </form>
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function describeQdrantStatus(status: LocalQdrantStatus | undefined): string {
  if (!status) return "正在读取本地向量库状态...";
  if (status.mode === "remote") return "正在使用远程向量库";
  if (status.status === "running") return "本地向量库运行中";
  if (status.status === "starting") return "本地向量库正在启动";
  if (status.status === "missing") return "未找到内置 Qdrant";
  if (status.status === "failed") return status.message ?? "本地向量库启动失败";

  return "本地向量库未启动";
}
