/**
 * Crossword helper for batch 1 of the letter pattern.
 * It matches letters against ENABLE. It does not read clue sentences.
 */

export const MAX_LENGTH = 28;
export const PAGE_SIZE = 300;

const BLANK = new Set(["?", "_", ".", "*"]);

export function normalizePattern(raw) {
  const text = String(raw)
    .replace(/[\u00A0\u3000]/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
  let pattern = "";
  for (const ch of text) {
    if (ch >= "a" && ch <= "z") pattern += ch;
    else if (BLANK.has(ch)) pattern += "?";
  }
  return pattern;
}

export function findPattern(words, levelOf, offensive, raw) {
  const pattern = normalizePattern(raw);
  if (!pattern) {
    return { ok: true, pattern, words: [], hidden: 0, total: 0, empty: true };
  }
  if (pattern.length > MAX_LENGTH) {
    return {
      ok: false,
      error: "There is no word that long. ENABLE stops at 28 letters.",
    };
  }
  if (pattern.length < 2) {
    return { ok: false, error: "Type at least 2 letters. One box is too short for this list." };
  }
  const known = [...pattern].filter((ch) => ch !== "?").length;
  if (!known && pattern.length > 3) {
    return {
      ok: false,
      error: "Add at least one letter you know. A line of only question marks is allowed for 2 or 3 letters.",
    };
  }
  const matches = [];
  for (const word of words) {
    if (word.length !== pattern.length) continue;
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== "?" && pattern[i] !== word[i]) {
        ok = false;
        break;
      }
    }
    if (ok) matches.push(word);
  }
  const set = offensive instanceof Set ? offensive : new Set(offensive);
  const hiddenList = matches.filter((word) => set.has(word));
  const shown = matches.filter((word) => !set.has(word));
  shown.sort((a, b) => {
    const left = levelOf.get(a) || 999;
    const right = levelOf.get(b) || 999;
    if (left !== right) return left - right;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return {
    ok: true,
    pattern,
    words: shown,
    hidden: hiddenList.length,
    total: matches.length,
    empty: false,
  };
}
