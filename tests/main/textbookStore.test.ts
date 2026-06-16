import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTextbookStore } from "../../src/main/textbookStore";
import type { TextbookRecord } from "../../src/shared/types";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("createTextbookStore", () => {
  it("upserts and lists indexed textbooks by updated time", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "teacherhelper-textbooks-"));
    const store = createTextbookStore(tempDir);
    const first: TextbookRecord = {
      id: "book-1",
      title: "七年级数学",
      sourceName: "local.pdf",
      collectionName: "teacherhelper_textbook_visual",
      pageCount: 2,
      itemCount: 6,
      status: "indexed",
      createdAt: "2026-06-15T01:00:00.000Z",
      updatedAt: "2026-06-15T01:00:00.000Z"
    };
    const second: TextbookRecord = {
      ...first,
      id: "book-2",
      title: "八年级数学",
      updatedAt: "2026-06-15T02:00:00.000Z"
    };

    await store.upsert(first);
    await store.upsert(second);
    await store.upsert({ ...first, itemCount: 8, updatedAt: "2026-06-15T03:00:00.000Z" });

    await expect(store.list()).resolves.toEqual([
      { ...first, itemCount: 8, updatedAt: "2026-06-15T03:00:00.000Z" },
      second
    ]);
  });
});
