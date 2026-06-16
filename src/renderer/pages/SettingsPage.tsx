import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  defaultEmbeddingModelName,
  defaultQdrantCollectionPrefix,
  defaultQdrantUrl
} from "../../shared/schemas";
import type { AppSettings } from "../../shared/types";
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
    embeddingModel: {
      apiKey: "",
      modelName: defaultEmbeddingModelName
    },
    qdrant: {
      url: defaultQdrantUrl,
      apiKey: "",
      collectionPrefix: defaultQdrantCollectionPrefix
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
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "正在读取本机设置..." });
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const controlsDisabled = isLoading || isBusy;

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
      setStatus({ tone: "success", text: "知识库连接测试通过。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "知识库连接测试失败，请检查 API Key、模型名和 Qdrant 地址。") });
    } finally {
      setIsBusy(false);
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
          <legend>Qdrant 向量库</legend>
          <label>
            <span>Qdrant 地址</span>
            <input
              autoComplete="off"
              disabled={controlsDisabled}
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
              disabled={controlsDisabled}
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
