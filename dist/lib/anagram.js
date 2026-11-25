/**
 * Shared search for Anagram Solver and Unscramble Words.
 * Words come from ENABLE. Common words (a lower SCOWL level) are listed
 * first inside each length. Offensive words from the single-word
 * LDNOOBW list are removed and counted.
 */

export const NO_WORDS =
  "No words found. Try removing a letter or adding a ? wildcard.";
export const MAX_LETTERS = 15;
export const MAX_WILDCARDS = 2;
export const PAGE_SIZE = 500;

export function cleanLetters(raw) {
  const text = String(raw)
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .normalize("NFKC")
    .normalize("NFC")
    .toLowerCase();
  let letters = "";
  let wild = 0;
  for (const ch of text) {
    if (ch >= "a" && ch <= "z") letters += ch;
    else if (ch === "?" || ch === "*") wild++;
  }
  return { letters, wild };
}

export function suggestTool(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const prepared = trimmed
    .replace(/[\u00A0\u3000]/g, " ")
    .normalize("NFKC");
  const morseOnly =
    /^[\s.\-_/|]+$/.test(prepared) && /[.\-]/.test(prepared) && !/[a-z0-9]/i.test(prepared);
  if (morseOnly) {
    return {
      href: "/",
      label: "Morse Code Translator",
      text: "This looks like Morse code. Open the Morse Code Translator to read the dots and dashes.",
    };
  }
  const digits = prepared.replace(/\D/g, "");
  if (/^[\d\s.\-|]+$/.test(prepared) && digits.length >= 81) {
    return {
      href: "/sudoku-solver/",
      label: "Sudoku Solver",
      text: "This looks like a sudoku puzzle. Open the Sudoku Solver and paste it there.",
    };
  }
  return null;
}

function countsOf(letters) {
  const counts = Array(26).fill(0);
  for (const ch of letters) counts[ch.charCodeAt(0) - 97]++;
  return counts;
}

function keyFromCounts(counts) {
  let key = "";
  for (let i = 0; i < 26; i++) {
    if (counts[i]) key += String.fromCharCode(97 + i).repeat(counts[i]);
  }
  return key;
}

function eachSubset(letterCounts, visit) {
  const present = [];
  for (let i = 0; i < 26; i++) if (letterCounts[i]) present.push(i);
  const choice = Array(present.length).fill(0);
  function walk(pos) {
    if (pos === present.length) {
      let key = "";
      for (let i = 0; i < present.length; i++) {
        if (choice[i]) key += String.fromCharCode(97 + present[i]).repeat(choice[i]);
      }
      if (key) visit(key);
      return;
    }
    const max = letterCounts[present[pos]];
    for (let n = 0; n <= max; n++) {
      choice[pos] = n;
      walk(pos + 1);
    }
  }
  walk(0);
}

export function canMake(word, letters, wild) {
  const counts = countsOf(letters);
  let need = 0;
  for (const ch of word) {
    const index = ch.charCodeAt(0) - 97;
    if (counts[index] > 0) counts[index]--;
    else if (++need > wild) return false;
  }
  return true;
}

export function wildcardMask(word, letters) {
  const counts = countsOf(letters);
  const mask = [];
  for (const ch of word) {
    const index = ch.charCodeAt(0) - 97;
    if (counts[index] > 0) {
      counts[index]--;
      mask.push(false);
    } else mask.push(true);
  }
  return mask;
}

export function createIndex(words, levels, offensiveList) {
  const byKey = new Map();
  const levelOf = new Map();
  const offensive = offensiveList instanceof Set ? offensiveList : new Set(offensiveList);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const key = keyFromCounts(countsOf(word));
    let bucket = byKey.get(key);
    if (!bucket) byKey.set(key, (bucket = []));
    bucket.push(word);
    levelOf.set(word, levels[i] || 0);
  }
  return { byKey, levelOf, offensive, words };
}

function sortGrouped(words, levelOf) {
  return words.slice().sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length;
    const left = levelOf.get(a) || 999;
    const right = levelOf.get(b) || 999;
    if (left !== right) return left - right;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}

export function search(index, raw, { mode = "all", minLength = 3 } = {}) {
  const hint = suggestTool(raw);
  const { letters, wild } = cleanLetters(raw);
  if (letters.length > MAX_LETTERS) {
    return {
      ok: false,
      error: "Use 15 letters or fewer. Remove a few letters and try again.",
    };
  }
  if (wild > MAX_WILDCARDS) {
    return {
      ok: false,
      error: "Use at most 2 wildcards (? or *). Remove the extra wildcard and try again.",
    };
  }
  if (!letters && !wild) {
    if (hint) return { ok: false, error: hint.text, hint };
    return { ok: true, words: [], hidden: 0, emptyInput: true };
  }
  const target = letters.length + wild;
  if (target < minLength) {
    const error =
      mode === "all"
        ? `Use all letters makes a ${target}-letter word, which is shorter than Shortest word. Lower Shortest word or add letters.`
        : "Shortest word is higher than the number of letters you have. Lower Shortest word or add letters.";
    return { ok: false, error };
  }
  const found = new Set();
  if (mode === "all" && wild === 0) {
    const key = keyFromCounts(countsOf(letters));
    for (const word of index.byKey.get(key) || []) found.add(word);
  } else if (mode === "all") {
    const base = countsOf(letters);
    const keys = new Set();
    const addExtra = (extras) => {
      const counts = base.slice();
      for (const ch of extras) counts[ch.charCodeAt(0) - 97]++;
      keys.add(keyFromCounts(counts));
    };
    if (wild === 1) {
      for (let i = 0; i < 26; i++) addExtra(String.fromCharCode(97 + i));
    } else {
      for (let i = 0; i < 26; i++) {
        for (let j = 0; j < 26; j++) {
          addExtra(String.fromCharCode(97 + i) + String.fromCharCode(97 + j));
        }
      }
    }
    for (const key of keys) {
      for (const word of index.byKey.get(key) || []) found.add(word);
    }
  } else if (wild === 0) {
    eachSubset(countsOf(letters), (key) => {
      if (key.length < minLength) return;
      for (const word of index.byKey.get(key) || []) found.add(word);
    });
  } else {
    for (const word of index.words) {
      if (word.length < minLength || word.length > target) continue;
      if (canMake(word, letters, wild)) found.add(word);
    }
  }
  let hidden = 0;
  const kept = [];
  for (const word of found) {
    if (word.length < minLength) continue;
    if (index.offensive.has(word)) {
      hidden++;
      continue;
    }
    kept.push(word);
  }
  const ordered = sortGrouped(kept, index.levelOf);
  return {
    ok: true,
    words: ordered.map((word) => ({
      word,
      length: word.length,
      mask: wild ? wildcardMask(word, letters) : null,
    })),
    hidden,
    emptyInput: false,
  };
}

export function hiddenMessage(count) {
  if (!count) return "";
  return count === 1 ? "1 offensive word hidden" : `${count} offensive words hidden`;
}

export function sortByLengthThenAlpha(words) {
  return words.slice().sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}
