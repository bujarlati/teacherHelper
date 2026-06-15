import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { AppSettings } from "../../shared/types";
import { api } from "../api";

const emptySettings: AppSettings = {
  textModel: {
    apiKey: "",
    modelName: ""
  },
  videoModel: {
    apiKey: "",
    modelName: ""
  }
};

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

export function SettingsPage(): ReactElement {
  const [settings, setSettings] = useState<AppSettings>(emptySettings);
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "正在读取本机设置..." });
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    api.loadSettings()
      .then((loadedSettings) => {
        if (!isMounted) {
          return;
        }

        setSettings(loadedSettings);
        setStatus({ tone: "muted", text: "设置仅保存在本机。" });
      })
      .catch(() => {
        if (isMounted) {
          setStatus({ tone: "error", text: "读取本机设置失败。" });
        }
      });

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
      setSettings(emptySettings);
      setStatus({ tone: "success", text: "本地设置已清空。" });
    } catch {
      setStatus({ tone: "error", text: "清空失败，请稍后重试。" });
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
              value={settings.videoModel.modelName}
              onChange={(event) => setSettings({
                ...settings,
                videoModel: { ...settings.videoModel, modelName: event.target.value }
              })}
            />
          </label>
        </fieldset>

        <div className="form-actions">
          <button type="submit" disabled={isBusy}>保存设置</button>
          <button type="button" className="secondary-button" disabled={isBusy} onClick={() => void handleClear()}>
            清空本地设置
          </button>
        </div>
      </form>
    </section>
  );
}
