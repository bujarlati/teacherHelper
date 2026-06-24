# RAG Preview And VL Rerank Design

## Context

The `codex/textbook-library` branch supports a local textbook library built from one or more PDF files. The current query flow embeds the Chinese question, searches Qdrant, and returns results containing local `imagePath` values. In the UI, those paths are displayed as text only, so teachers cannot quickly inspect the matching textbook page or cropped figure.

SiliconFlow documents `POST /v1/rerank` for reranking documents by relevance to a query, including multimodal text, image, and video content. The model list endpoint also supports `sub_type=reranker`, so the app can treat reranker models as a dedicated model class.

Sources:

- https://docs.siliconflow.cn/cn/api-reference/rerank/create-rerank
- https://docs.siliconflow.cn/en/api-reference/models/get-model-list

## Goals

1. Show image previews directly in the textbook search results.
2. Add a configurable reranker model with default model name `Qwen/Qwen3-VL-Reranker-8B`.
3. Improve ranking by retrieving more Qdrant candidates than the visible result count, reranking them with the SiliconFlow VL reranker, and returning the top results.
4. Keep search usable when reranking is not configured or fails.

## Non-Goals

- Do not change the PDF indexing pipeline.
- Do not re-index existing textbook libraries.
- Do not store full PDF files or downloaded textbook resources in the repository.
- Do not build a separate RAG answer generation workflow in this change.

## User Experience

The `教材索引` page keeps the existing search form. When search results arrive, each result card shows:

- textbook title and source/page location,
- vector/rerank score summary,
- a thumbnail preview of the matched page or crop,
- the local image path as secondary diagnostic text.

Clicking a result opens an in-page preview area with a larger image, title, source PDF, page number, kind (`page` or `crop`), scores, and path. If the image cannot be loaded, the card shows a readable failure message instead of a broken-only image.

## Settings

Extend `AppSettings` with:

```ts
rerankerModel: {
  apiKey: string;
  modelName: string;
}
```

Default:

```ts
modelName: "Qwen/Qwen3-VL-Reranker-8B"
```

The settings page adds a `重排序模型` section. The API key defaults to the embedding API key when the user has not entered a reranker key, so users with one SiliconFlow key can configure fewer fields. The saved settings still keep an explicit reranker config to make the feature understandable.

## Search Flow

1. Embed the user query with `settings.embeddingModel`.
2. Search Qdrant with a candidate limit of `max(limit * 3, limit)`, capped to a small safe maximum such as 24.
3. Convert Qdrant payloads into `TextbookSearchResult` objects.
4. If `settings.rerankerModel.modelName` and an API key are available, read candidate images from disk and send a multimodal rerank request to SiliconFlow:
   - `query`: user question,
   - `documents`: one document per candidate, containing the candidate image and concise text metadata,
   - `top_n`: requested visible limit,
   - `return_documents`: false.
5. Reorder candidates by returned rerank indices and attach `rerankScore`.
6. If reranking is unavailable or fails, return the Qdrant order and attach a `rankingStatus` message indicating vector fallback.

## API And Types

`TextbookSearchResult` gains:

- `imageDataUrl?: string` for renderer-safe preview,
- `rerankScore?: number`,
- `rankingSource: "qdrant" | "reranker"`,
- `rankingMessage?: string`.

The main process reads local result images and returns data URLs. The renderer never reads arbitrary file paths directly.

`createSiliconFlowClient` gains:

```ts
rerank(input: {
  apiKey: string;
  modelName: string;
  query: string;
  documents: Array<string | { text?: string; image?: string } | Array<{ text?: string; image?: string }>>;
  topN: number;
  instruction?: string;
}): Promise<Array<{ index: number; relevanceScore: number }>>;
```

## Error Handling

- Missing reranker key/model: skip rerank and return vector results.
- Reranker timeout or invalid response: return vector results and display a concise fallback message.
- Missing image file: keep the result but omit `imageDataUrl`, and show a preview failure note in the UI.
- Invalid Qdrant payload still fails loudly, preserving current behavior.

## Testing

Add or update tests for:

- SiliconFlow rerank request body and response parsing.
- Textbook search reranking order, score attachment, and vector fallback on reranker failure.
- Image data URL loading from local search result paths.
- Settings schema defaults and settings page reranker fields.
- Textbook page result thumbnails and selected large preview.

Run the existing full verification suite before committing implementation:

- `npm run test:run`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`
