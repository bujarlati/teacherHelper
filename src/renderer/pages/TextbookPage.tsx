import { FormEvent, useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { TextbookIndexItem, TextbookRecord, TextbookSearchResult, TextbookSource } from "../../shared/types";
import { api } from "../api";

type StatusTone = "muted" | "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
};

export function TextbookPage(): ReactElement {
  const [textbooks, setTextbooks] = useState<TextbookRecord[]>([]);
  const [searchResults, setSearchResults] = useState<TextbookSearchResult[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | undefined>();
  const [status, setStatus] = useState<StatusMessage>({ tone: "muted", text: "请选择一个或多个教材 PDF 建立本地教材库。" });

  useEffect(() => {
    void refreshTextbooks();
  }, []);

  useEffect(() => {
    if (!selectedTextbookId && textbooks.length > 0) {
      setSelectedTextbookId(textbooks[0].id);
    }
  }, [selectedTextbookId, textbooks]);

  const selectedTextbook = textbooks.find((item) => item.id === selectedTextbookId);

  async function refreshTextbooks(): Promise<void> {
    try {
      setTextbooks(await api.listTextbooks());
    } catch {
      setStatus({ tone: "error", text: "读取教材库失败。" });
    }
  }

  async function handleIndex(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      setStatus({ tone: "error", text: "请先选择教材 PDF。" });
      return;
    }

    const nextTitle = title.trim() || createDefaultLibraryTitle(selectedFiles);
    setIsBusy(true);
    setStatus({ tone: "muted", text: "正在渲染教材 PDF..." });

    try {
      const { renderPdfFileToIndexItems } = await import("../pdfRenderer");
      const items: TextbookIndexItem[] = [];
      let pageOffset = 0;

      for (const file of selectedFiles) {
        const renderedItems = await renderPdfFileToIndexItems(file, (nextProgress) => {
          setProgress({
            ...nextProgress,
            label: `${file.name}：${nextProgress.label}`
          });
        });
        const pageCount = getRenderedPageCount(renderedItems);
        items.push(...renderedItems.map((item) => ({
          ...item,
          pageNumber: item.pageNumber + pageOffset,
          sourceName: file.name,
          sourcePageNumber: item.pageNumber
        })));
        pageOffset += pageCount;
      }

      setStatus({ tone: "muted", text: "正在写入本地向量库..." });
      const record = await api.indexTextbook({
        title: nextTitle,
        sourceNames: selectedFiles.map((file) => file.name),
        items
      });
      setTextbooks((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setSelectedTextbookId(record.id);
      setStatus({ tone: "success", text: `教材库索引完成：${record.itemCount} 个视觉条目。` });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "教材库索引失败。") });
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
          <legend>导入教材库</legend>
          <label>
            <span>教材 PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={isBusy}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setSelectedFiles(files);
                if (files.length > 0 && !title.trim()) {
                  setTitle(createDefaultLibraryTitle(files));
                }
              }}
            />
          </label>
          <label>
            <span>教材库名称</span>
            <input
              disabled={isBusy}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {selectedFiles.length > 0 ? (
            <p className="field-note">已选择 {selectedFiles.length} 个 PDF：{selectedFiles.map((file) => file.name).join("、")}</p>
          ) : null}
          <div className="form-actions">
            <button type="submit" disabled={isBusy}>建立本地教材库</button>
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
          <h2>已建立教材库</h2>
          {textbooks.length === 0 ? (
            <p className="empty-state">暂无教材库。</p>
          ) : (
            <ul className="record-list">
              {textbooks.map((item) => (
                <li key={item.id} className={item.id === selectedTextbookId ? "selected-record" : undefined}>
                  <strong>{item.title}</strong>
                  <span>{formatSourceSummary(item)}</span>
                  <span>{item.pageCount} 页 · {item.itemCount} 个视觉条目</span>
                  <div className="record-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setSelectedTextbookId(item.id)}
                    >
                      查看教材库
                    </button>
                  </div>
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
                  <span>{formatSearchResultLocation(item)} · {item.kind} · 相似度 {item.score.toFixed(2)}</span>
                  <span>{item.imagePath}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="result-section">
        <h2>教材库预览</h2>
        {!selectedTextbook ? (
          <p className="empty-state">选择一个已建立的教材库后，可以查看它包含的 PDF、页数和索引条目。</p>
        ) : (
          <>
            <dl className="metadata-list">
              <div>
                <dt>名称</dt>
                <dd>{selectedTextbook.title}</dd>
              </div>
              <div>
                <dt>PDF</dt>
                <dd>{getTextbookSources(selectedTextbook).length} 个</dd>
              </div>
              <div>
                <dt>规模</dt>
                <dd>{selectedTextbook.pageCount} 页 · {selectedTextbook.itemCount} 个视觉条目</dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>{selectedTextbook.updatedAt}</dd>
              </div>
            </dl>
            <ul className="record-list">
              {getTextbookSources(selectedTextbook).map((source) => (
                <li key={source.name}>
                  <strong>{source.name}</strong>
                  <span>{source.pageCount} 页 · {source.itemCount} 个视觉条目</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </section>
  );
}

function createDefaultLibraryTitle(files: File[]): string {
  if (files.length === 1) {
    return files[0].name.replace(/\.pdf$/i, "");
  }

  return `${files[0].name.replace(/\.pdf$/i, "")} 等 ${files.length} 个 PDF`;
}

function getRenderedPageCount(items: TextbookIndexItem[]): number {
  return Math.max(0, ...items.filter((item) => item.kind === "page").map((item) => item.pageNumber));
}

function getTextbookSources(record: TextbookRecord): TextbookSource[] {
  if (record.sources?.length) {
    return record.sources;
  }

  return [{
    name: record.sourceName,
    pageCount: record.pageCount,
    itemCount: record.itemCount
  }];
}

function formatSourceSummary(record: TextbookRecord): string {
  const sources = getTextbookSources(record);
  const sourceText = sources.map((source) => source.name).join("、");
  return `${sources.length} 个 PDF · ${sourceText}`;
}

function formatSearchResultLocation(item: TextbookSearchResult): string {
  const sourcePage = item.sourcePageNumber ? ` · ${item.sourceName} 第 ${item.sourcePageNumber} 页` : "";
  return `第 ${item.pageNumber} 页${sourcePage}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
