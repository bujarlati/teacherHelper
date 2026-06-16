import type { TextbookIndexItem } from "../shared/types";

type ProgressCallback = (progress: { current: number; total: number; label: string }) => void;

export async function renderPdfFileToIndexItems(
  file: File,
  onProgress?: ProgressCallback
): Promise<TextbookIndexItem[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const items: TextbookIndexItem[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.({ current: pageNumber, total: pdf.numPages, label: `渲染第 ${pageNumber} 页` });
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("无法创建 PDF 渲染画布。");
    }

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    items.push({
      kind: "page",
      pageNumber,
      imageDataUrl: canvas.toDataURL("image/png")
    });

    for (const cropRect of createCropRects(canvas.width, canvas.height)) {
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropRect.width;
      cropCanvas.height = cropRect.height;
      const cropContext = cropCanvas.getContext("2d");
      if (!cropContext) {
        throw new Error("无法创建教材切块画布。");
      }
      cropContext.drawImage(
        canvas,
        cropRect.x,
        cropRect.y,
        cropRect.width,
        cropRect.height,
        0,
        0,
        cropRect.width,
        cropRect.height
      );
      items.push({
        kind: "crop",
        pageNumber,
        imageDataUrl: cropCanvas.toDataURL("image/png"),
        cropRect
      });
    }
  }

  return items;
}

function createCropRects(width: number, height: number) {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  return [
    { x: 0, y: 0, width: halfWidth, height: halfHeight },
    { x: halfWidth, y: 0, width: width - halfWidth, height: halfHeight },
    { x: 0, y: halfHeight, width: halfWidth, height: height - halfHeight },
    { x: halfWidth, y: halfHeight, width: width - halfWidth, height: height - halfHeight }
  ];
}
