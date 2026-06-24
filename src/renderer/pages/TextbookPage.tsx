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
  const [selectedSearchResult, setSelectedSearchResult] = useState<TextbookSearchResult | undefined>();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [searchFeedback, setSearchFeedback] = useState("");
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
      setSelectedSearchResult(undefined);
      setStatus({ tone: "success", text: results.length > 0 ? "教材检索完成。" : "没有找到相关教材页。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "教材检索失败。") });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRefineSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (searchResults.length === 0) return;

    const feedback = searchFeedback.trim();
    if (!feedback) {
      setStatus({ tone: "error", text: "请先输入修改要求。" });
      return;
    }

    setIsBusy(true);
    setStatus({ tone: "muted", text: "正在根据修改要求继续检索..." });

    try {
      const results = await api.searchTextbooks({
        query: createTextbookRefinementQuery(query, searchResults, feedback),
        limit: 6
      });
      setSearchResults(results);
      setSelectedSearchResult(undefined);
      setSearchFeedback("");
      setStatus({ tone: "success", text: results.length > 0 ? "教材检索已按修改要求更新。" : "没有找到相关教材页。" });
    } catch (error) {
      setStatus({ tone: "error", text: getErrorMessage(error, "继续检索失败。") });
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
                  {item.imageDataUrl ? (
                    <img
                      className="result-thumbnail"
                      src={item.imageDataUrl}
                      alt={`教材结果预览：${item.title} ${formatSearchResultLocation(item)}`}
                    />
                  ) : (
                    <div className="result-thumbnail result-thumbnail-empty">图片预览不可用</div>
                  )}
                  <strong>{item.title}</strong>
                  <span>{formatSearchResultLocation(item)} · {item.kind} · {formatSearchScore(item)}</span>
                  {item.rankingMessage ? <span>{item.rankingMessage}</span> : null}
                  <span>{item.imagePath}</span>
                  <div className="record-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setSelectedSearchResult(item)}
                    >
                      查看图片
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {searchResults.length > 0 ? (
        <section className="result-section" aria-labelledby="textbook-refinement-title">
          <h2 id="textbook-refinement-title">二次检索</h2>
          <form className="refinement-form" onSubmit={(event) => void handleRefineSearch(event)}>
            <label>
              <span>教材检索修改要求</span>
              <textarea
                rows={3}
                disabled={isBusy}
                value={searchFeedback}
                onChange={(event) => setSearchFeedback(event.target.value)}
                placeholder="例如：只看含图形的页面、偏向例题、排除练习答案页"
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="secondary-button" disabled={isBusy}>根据要求继续检索</button>
            </div>
          </form>
        </section>
      ) : null}

      {selectedSearchResult ? (
        <section className="result-section">
          <h2>结果图片预览</h2>
          {selectedSearchResult.imageDataUrl ? (
            <img
              className="result-preview-image"
              src={selectedSearchResult.imageDataUrl}
              alt={`放大预览：${selectedSearchResult.title} ${formatSearchResultLocation(selectedSearchResult)}`}
            />
          ) : (
            <p className="empty-state">图片预览不可用。</p>
          )}
          <dl className="metadata-list">
            <div>
              <dt>教材</dt>
              <dd>{selectedSearchResult.title}</dd>
            </div>
            <div>
              <dt>位置</dt>
              <dd>{formatSearchResultLocation(selectedSearchResult)} · {selectedSearchResult.kind}</dd>
            </div>
            <div>
              <dt>得分</dt>
              <dd>{formatSearchScore(selectedSearchResult)}</dd>
            </div>
            <div>
              <dt>路径</dt>
              <dd>{selectedSearchResult.imagePath}</dd>
            </div>
          </dl>
        </section>
      ) : null}

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

function formatSearchScore(item: TextbookSearchResult): string {
  const rerankScore = typeof item.rerankScore === "number" ? ` · 重排 ${item.rerankScore.toFixed(2)}` : "";
  return `相似度 ${item.score.toFixed(2)}${rerankScore}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function createTextbookRefinementQuery(
  query: string,
  results: TextbookSearchResult[],
  feedback: string
): string {
  const resultSummary = results.slice(0, 5).map((item, index) => {
    return `${index + 1}. ${item.title} ${formatSearchResultLocation(item)} ${item.kind} ${formatSearchScore(item)}`;
  }).join("\n");

  return [
    "请基于上一次教材检索结果继续检索，优先满足补充要求。",
    `原问题：${query.trim()}`,
    `补充要求：${feedback}`,
    "上一次教材检索结果：",
    resultSummary
  ].join("\n\n");
}
