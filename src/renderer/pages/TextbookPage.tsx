import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { TextbookRecord, TextbookResource, TextbookResourceCatalog, TextbookSearchResult } from "../../shared/types";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

export function TextbookPage(): ReactElement {
  const [textbooks, setTextbooks] = useState<TextbookRecord[]>([]);
  const [resourceCatalog, setResourceCatalog] = useState<TextbookResourceCatalog | undefined>();
  const [searchResults, setSearchResults] = useState<TextbookSearchResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "请选择教材 PDF 建立本地索引。" });

  useEffect(() => {
    void refreshTextbooks();
    void refreshResources();
  }, []);

  async function refreshTextbooks(): Promise<void> {
    try {
      setTextbooks(await api.listTextbooks());
    } catch {
      setStatus({ tone: "error", text: "读取教材索引失败。" });
    }
  }

  async function refreshResources(): Promise<void> {
    try {
      setResourceCatalog(await api.listTextbookResources());
    } catch {
      setStatus({ tone: "error", text: "读取教材资源目录失败。" });
    }
  }

  async function handleIndex(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedFile) {
      setStatus({ tone: "error", text: "请先选择教材 PDF。" });
      return;
    }

    const nextTitle = title.trim() || selectedFile.name.replace(/\.pdf$/i, "");
    setIsBusy(true);

    try {
      await indexPdfFile(selectedFile, nextTitle, selectedFile.name);
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "教材索引失败。") });
    } finally {
      setIsBusy(false);
      setProgress(undefined);
    }
  }

  async function handleIndexResource(resource: TextbookResource): Promise<void> {
    setIsBusy(true);
    setStatus({ tone: "muted", text: "正在读取教材 PDF..." });

    try {
      const resourceFile = await api.readTextbookResource(resource.id);
      const file = createPdfFileFromBase64(resourceFile.dataBase64, resourceFile.resource.fileName);
      await indexPdfFile(file, resourceFile.resource.title, resourceFile.resource.fileName);
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "教材资源索引失败。") });
    } finally {
      setIsBusy(false);
      setProgress(undefined);
    }
  }

  async function indexPdfFile(file: File, nextTitle: string, sourceName: string): Promise<void> {
    setStatus({ tone: "muted", text: "正在渲染教材 PDF..." });
    const { renderPdfFileToIndexItems } = await import("../pdfRenderer");
    const items = await renderPdfFileToIndexItems(file, setProgress);
    setStatus({ tone: "muted", text: "正在写入本地向量库..." });
    const record = await api.indexTextbook({
      title: nextTitle,
      sourceName,
      items
    });
    setTextbooks((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    setStatus({ tone: "success", text: `教材索引完成：${record.itemCount} 个视觉条目。` });
  }

  async function handleOpenDownloadPage(): Promise<void> {
    try {
      await api.openTextbookDownloadPage();
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "打开教材下载页失败。") });
    }
  }

  async function handleOpenResourceFolder(): Promise<void> {
    try {
      await api.openTextbookResourceFolder();
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "打开教材目录失败。") });
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) {
      setStatus({ tone: "error", text: "请输入教材检索问题。" });
      return;
    }

    setIsBusy(true);
    setStatus({ tone: "muted", text: "正在检索教材索引..." });

    try {
      const results = await api.searchTextbooks({ query: nextQuery, limit: 6 });
      setSearchResults(results);
      setStatus({ tone: "success", text: results.length > 0 ? "教材检索完成。" : "没有找到相关教材页。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "教材检索失败。") });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="workspace-panel" aria-labelledby="textbook-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">本地知识库</p>
          <h1 id="textbook-title">教材索引</h1>
        </div>
        <p className={`status-text status-${status.tone}`} role="status">{status.text}</p>
      </div>

      <section className="resource-section" aria-labelledby="textbook-resource-title">
        <div className="detail-heading">
          <h2 id="textbook-resource-title">教材资源</h2>
          <div className="record-actions">
            <button type="button" className="secondary-button" disabled={isBusy} onClick={() => void handleOpenDownloadPage()}>
              打开下载页
            </button>
            <button type="button" className="secondary-button" disabled={isBusy} onClick={() => void handleOpenResourceFolder()}>
              打开教材目录
            </button>
            <button type="button" disabled={isBusy} onClick={() => void refreshResources()}>
              刷新目录
            </button>
          </div>
        </div>
        <dl className="metadata-list resource-metadata">
          <div>
            <dt>教材下载地址</dt>
            <dd>{resourceCatalog?.downloadUrl ?? "正在读取..."}</dd>
          </div>
          <div>
            <dt>本地教材目录</dt>
            <dd>{resourceCatalog?.libraryDir ?? "正在读取..."}</dd>
          </div>
        </dl>
        {resourceCatalog && resourceCatalog.resources.length === 0 ? (
          <p className="empty-state">暂无可索引的本地教材 PDF。</p>
        ) : null}
        {resourceCatalog && resourceCatalog.resources.length > 0 ? (
          <ul className="record-list resource-list">
            {resourceCatalog.resources.map((resource) => (
              <li key={resource.id}>
                <strong>{resource.title}</strong>
                <span>{resource.relativePath}</span>
                <span>{getSourceLabel(resource.source)} · {formatFileSize(resource.sizeBytes)}</span>
                <div className="record-actions">
                  <button type="button" disabled={isBusy} onClick={() => void handleIndexResource(resource)}>
                    索引此教材
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form className="compact-form" onSubmit={(event) => void handleIndex(event)}>
        <fieldset>
          <legend>导入教材</legend>
          <label>
            <span>教材 PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={isBusy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedFile(file);
                if (file && !title.trim()) {
                  setTitle(file.name.replace(/\.pdf$/i, ""));
                }
              }}
            />
          </label>
          <label>
            <span>教材名称</span>
            <input
              disabled={isBusy}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={isBusy}>建立本地索引</button>
          </div>
          {progress ? (
            <div className="progress-block" aria-live="polite">
              <progress max={progress.total} value={progress.current} />
              <span>{progress.label}</span>
            </div>
          ) : null}
        </fieldset>
      </form>

      <form className="compact-form" onSubmit={(event) => void handleSearch(event)}>
        <fieldset className="compact-fieldset">
          <label>
            <span>教材检索问题</span>
            <input
              disabled={isBusy}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button type="submit" disabled={isBusy}>检索教材</button>
        </fieldset>
      </form>

      <div className="result-grid">
        <section>
          <h2>已索引教材</h2>
          {textbooks.length === 0 ? (
            <p className="empty-state">暂无教材索引。</p>
          ) : (
            <ul className="record-list">
              {textbooks.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.sourceName}</span>
                  <span>{item.pageCount} 页 · {item.itemCount} 个视觉条目</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>检索结果</h2>
          {searchResults.length === 0 ? (
            <p className="empty-state">输入问题后会显示相关教材页和图形。</p>
          ) : (
            <ul className="record-list">
              {searchResults.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>第 {item.pageNumber} 页 · {item.kind} · 相似度 {item.score.toFixed(2)}</span>
                  <span>{item.imagePath}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

function createPdfFileFromBase64(dataBase64: string, fileName: string): File {
  const binary = atob(dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: "application/pdf" });
}

function getSourceLabel(source: TextbookResource["source"]): string {
  return source === "library" ? "本地目录" : "资源包";
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
