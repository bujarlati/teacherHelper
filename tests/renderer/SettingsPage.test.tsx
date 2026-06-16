// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppSettings } from "../../src/shared/types";

const storedSettings: AppSettings = {
  textModel: {
    apiKey: "text-key",
    modelName: "deepseek-ai/DeepSeek-V3"
  },
  videoModel: {
    apiKey: "video-key",
    modelName: "Wan-AI/Wan2.2-T2V-A14B"
  },
  embeddingModel: {
    apiKey: "embedding-key",
    modelName: "Qwen/Qwen3-VL-Embedding-8B"
  },
  qdrant: {
    url: "http://localhost:6333",
    apiKey: "qdrant-key",
    collectionPrefix: "teacherhelper"
  }
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.resetModules();

    Object.defineProperty(window, "teacherHelper", {
      configurable: true,
      value: {
        loadSettings: vi.fn().mockResolvedValue(storedSettings),
        saveSettings: vi.fn().mockResolvedValue(undefined),
        clearSettings: vi.fn().mockResolvedValue(undefined),
        testKnowledgeConnections: vi.fn().mockResolvedValue({ embedding: "ok", qdrant: "ok" })
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("loads, saves, and clears local model settings", async () => {
    const { SettingsPage } = await import("../../src/renderer/pages/SettingsPage");

    render(<SettingsPage />);

    expect(await screen.findByDisplayValue("text-key")).toBeTruthy();
    expect(screen.getByDisplayValue("deepseek-ai/DeepSeek-V3")).toBeTruthy();
    expect(screen.getByDisplayValue("video-key")).toBeTruthy();
    expect(screen.getByDisplayValue("Wan-AI/Wan2.2-T2V-A14B")).toBeTruthy();
    expect(screen.getByDisplayValue("embedding-key")).toBeTruthy();
    expect(screen.getByDisplayValue("Qwen/Qwen3-VL-Embedding-8B")).toBeTruthy();
    expect(screen.getByDisplayValue("http://localhost:6333")).toBeTruthy();
    expect(screen.getByDisplayValue("qdrant-key")).toBeTruthy();
    expect(screen.getByLabelText("文本 API Key")).toHaveProperty("type", "password");
    expect(screen.getByLabelText("视频 API Key")).toHaveProperty("type", "password");
    expect(screen.getByLabelText("嵌入 API Key")).toHaveProperty("type", "password");
    expect(screen.getByLabelText("Qdrant API Key")).toHaveProperty("type", "password");

    fireEvent.change(screen.getByLabelText("文本 API Key"), {
      target: { value: "updated-text-key" }
    });
    fireEvent.change(screen.getByLabelText("视频模型名"), {
      target: { value: "updated-video-model" }
    });
    fireEvent.change(screen.getByLabelText("集合前缀"), {
      target: { value: "teacherhelper-math" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(window.teacherHelper.saveSettings).toHaveBeenCalledWith({
        textModel: {
          apiKey: "updated-text-key",
          modelName: "deepseek-ai/DeepSeek-V3"
        },
        videoModel: {
          apiKey: "video-key",
          modelName: "updated-video-model"
        },
        embeddingModel: {
          apiKey: "embedding-key",
          modelName: "Qwen/Qwen3-VL-Embedding-8B"
        },
        qdrant: {
          url: "http://localhost:6333",
          apiKey: "qdrant-key",
          collectionPrefix: "teacherhelper-math"
        }
      });
    });
    expect(await screen.findByText("设置已保存到本机。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "清空本地设置" }));

    await waitFor(() => {
      expect(window.teacherHelper.clearSettings).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText("文本 API Key")).toHaveProperty("value", "");
    expect(screen.getByLabelText("文本模型名")).toHaveProperty("value", "");
    expect(screen.getByLabelText("视频 API Key")).toHaveProperty("value", "");
    expect(screen.getByLabelText("视频模型名")).toHaveProperty("value", "");
    expect(screen.getByLabelText("嵌入 API Key")).toHaveProperty("value", "");
    expect(screen.getByLabelText("嵌入模型名")).toHaveProperty("value", "Qwen/Qwen3-VL-Embedding-8B");
    expect(screen.getByLabelText("Qdrant 地址")).toHaveProperty("value", "http://localhost:6333");
    expect(screen.getByLabelText("Qdrant API Key")).toHaveProperty("value", "");
    expect(screen.getByLabelText("集合前缀")).toHaveProperty("value", "teacherhelper");
    expect(await screen.findByText("本地设置已清空。")).toBeTruthy();
  });

  test("saves current settings before testing knowledge connections", async () => {
    const { SettingsPage } = await import("../../src/renderer/pages/SettingsPage");

    render(<SettingsPage />);

    expect(await screen.findByDisplayValue("embedding-key")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "测试知识库连接" }));

    await waitFor(() => {
      expect(window.teacherHelper.saveSettings).toHaveBeenCalledWith(storedSettings);
      expect(window.teacherHelper.testKnowledgeConnections).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("知识库连接测试通过。")).toBeTruthy();
  });

  test("shows a read failure when the preload api is missing", async () => {
    Reflect.deleteProperty(window, "teacherHelper");

    const { SettingsPage } = await import("../../src/renderer/pages/SettingsPage");

    render(<SettingsPage />);

    expect(await screen.findByText("读取本机设置失败。")).toBeTruthy();
  });

  test("keeps controls disabled until local settings finish loading", async () => {
    let resolveLoadSettings!: (settings: AppSettings) => void;
    const loadSettingsPromise = new Promise<AppSettings>((resolve) => {
      resolveLoadSettings = resolve;
    });

    Object.defineProperty(window, "teacherHelper", {
      configurable: true,
      value: {
        loadSettings: vi.fn().mockReturnValue(loadSettingsPromise),
        saveSettings: vi.fn().mockResolvedValue(undefined),
        clearSettings: vi.fn().mockResolvedValue(undefined),
        testKnowledgeConnections: vi.fn().mockResolvedValue({ embedding: "ok", qdrant: "ok" })
      }
    });

    const { SettingsPage } = await import("../../src/renderer/pages/SettingsPage");

    render(<SettingsPage />);

    expect(screen.getByLabelText("文本 API Key")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "保存设置" })).toHaveProperty("disabled", true);

    await act(async () => {
      resolveLoadSettings(storedSettings);
      await loadSettingsPromise;
    });

    expect(await screen.findByDisplayValue("text-key")).toBeTruthy();
    expect(screen.getByLabelText("文本 API Key")).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "保存设置" })).toHaveProperty("disabled", false);
  });
});
