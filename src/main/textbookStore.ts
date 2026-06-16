import { join } from "node:path";
import type { TextbookRecord } from "../shared/types.js";
import { readJsonFile, writeJsonFile } from "./jsonStore.js";

type TextbookFile = {
  textbooks: TextbookRecord[];
};

function createEmptyTextbooks(): TextbookFile {
  return { textbooks: [] };
}

function replaceById(records: TextbookRecord[], record: TextbookRecord): TextbookRecord[] {
  return [record, ...records.filter((item) => item.id !== record.id)];
}

function sortByUpdatedAtDescending(records: TextbookRecord[]): TextbookRecord[] {
  return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createTextbookStore(baseDir: string) {
  const filePath = join(baseDir, "textbooks.json");

  async function loadTextbooks(): Promise<TextbookFile> {
    return readJsonFile(filePath, createEmptyTextbooks());
  }

  async function saveTextbooks(textbooks: TextbookFile): Promise<void> {
    await writeJsonFile(filePath, textbooks);
  }

  return {
    async upsert(record: TextbookRecord): Promise<void> {
      const textbooks = await loadTextbooks();
      await saveTextbooks({
        textbooks: replaceById(textbooks.textbooks, record)
      });
    },

    async list(): Promise<TextbookRecord[]> {
      const textbooks = await loadTextbooks();
      return sortByUpdatedAtDescending(textbooks.textbooks);
    }
  };
}
