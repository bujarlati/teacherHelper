import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { TextbookRecord, TextbookSearchResult } from "../../shared/types";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

export function TextbookPage(): ReactElement {
  const [textbooks, setTextbooks] = useState<TextbookRecord[]>([]);
  const [searchResults, setSearchResults] = useState<TextbookSearchResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "请选择教材 PDF 建立本地索引。" });

  useEffect(() => {
    void refreshTextbooks();
  }, []);

  async function refreshTextbooks(): Promise<void> {
    try {
      setTextbooks(await api.listTextbooks());
    } catch {
      setStatus({ tone: "error", text: "读取教材索引失败。" });
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
    setStatus({ tone: "muted", text: "正在渲染教材 PDF..." });

    try {
      const { renderPdfFileToIndexItems } = await import("../pdfRenderer");
      const items = await renderPdfFileToIndexItems(selectedFile, setProgress);
      setStatus({ tone: "muted", text: "正在写入本地向量库..." });
      const record = await api.indexTextbook({
        title: nextTitle,
        sourceName: selectedFile.name,
        items
      });
      setTextbooks((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setStatus({ tone: "success", text: `教材索引完成：${record.itemCount} 个视觉条目。` });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "教材索引失败。") });
    } finally {
      setIsBusy(false);
      setProgress(undefined);
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
