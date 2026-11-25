/**
 * Shared ENABLE / SCOWL / LDNOOBW loader.
 * Batch 2 tools (word search, cryptogram, crossword) should call
 * loadWordIndex() instead of fetching another copy.
 * ENABLE has no single-letter words. Crossword and cryptogram need
 * EXTRA_SINGLE_LETTERS ("a" and "i") added on top of this list.
 */

import { createIndex } from "./anagram.js";

export const EXTRA_SINGLE_LETTERS = ["a", "i"];

export const DATA_URLS = {
  words: "/data/enable1.txt",
  levels: "/data/levels.bin",
  offensive: "/data/offensive.txt",
};

export function encodeLevels(words, levelByWord) {
  const out = new Uint8Array(words.length);
  for (let i = 0; i < words.length; i++) out[i] = levelByWord.get(words[i]) || 0;
  return out;
}

export function parseLevelTsv(text) {
  const map = new Map();
  for (const line of String(text).split(/\n/)) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    map.set(line.slice(0, tab), Number(line.slice(tab + 1)));
  }
  return map;
}

export function splitWords(text) {
  return String(text).replace(/^\uFEFF/, "").trim().split(/\n/).filter(Boolean);
}

export function indexFromParts(wordsText, levelsBytes, offensiveText) {
  const words = splitWords(wordsText);
  const levels = levelsBytes instanceof Uint8Array ? levelsBytes : new Uint8Array(levelsBytes);
  const offensive = splitWords(offensiveText);
  return createIndex(words, levels, offensive);
}

export async function loadWordIndex(fetchImpl = globalThis.fetch) {
  const [wordsRes, levelsRes, offensiveRes] = await Promise.all([
    fetchImpl(DATA_URLS.words),
    fetchImpl(DATA_URLS.levels),
    fetchImpl(DATA_URLS.offensive),
  ]);
  if (!wordsRes.ok || !levelsRes.ok || !offensiveRes.ok) {
    throw new Error("word list request failed");
  }
  const wordsText = await wordsRes.text();
  const levelsBytes = new Uint8Array(await levelsRes.arrayBuffer());
  const offensiveText = await offensiveRes.text();
  return indexFromParts(wordsText, levelsBytes, offensiveText);
}

export const WORD_LIST_LOAD_ERROR =
  "The word list did not load. Check your connection and press Find words again.";
